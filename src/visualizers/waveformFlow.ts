import type { CanvasDimensions, Visualizer, VisualizerFrame } from '../types/visualizer.js'
import type { VisualizationSettings } from '../settings/visualizationSettings.js'

const POINTS = 160
const TRAILS = 4
const TRAIL_INTERVAL = 0.055
const RIBBONS = 3

export class WaveformFlow implements Visualizer {
  private context?: CanvasRenderingContext2D
  private gradients: CanvasGradient[] = []
  private palette?: VisualizationSettings['palette']
  private readonly signal = new Float32Array(POINTS)
  private readonly curves = new Float32Array(POINTS * RIBBONS)
  private readonly history = Array.from({ length: TRAILS }, () => new Float32Array(POINTS * RIBBONS))
  private historyHead = 0
  private historyCount = 0
  private trailTime = 0
  private time = 0
  private volume = 0

  initialize(context: CanvasRenderingContext2D) {
    this.context = context
  }

  resize(_dimensions: Readonly<CanvasDimensions>) {
    this.gradients.length = 0
    this.historyCount = 0
  }

  render({ audio, deltaSeconds, dimensions, settings }: Readonly<VisualizerFrame>, target = this.context) {
    const ctx = target
    if (!ctx) return

    const { width, height } = dimensions
    const span = width * 0.88
    const left = (width - span) / 2
    const xStep = span / (POINTS - 1)
    const center = height * 0.5
    const scale = Math.min(height, width * 0.9)

    if (!this.gradients.length || this.palette !== settings.palette) {
      this.palette = settings.palette
      this.gradients = settings.palette.map((color, index) => {
        const gradient = ctx.createLinearGradient(left, 0, left + span, 0)
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.16, color)
        gradient.addColorStop(0.52, settings.palette[(index + 1) % RIBBONS]!)
        gradient.addColorStop(0.84, color)
        gradient.addColorStop(1, 'transparent')
        return gradient
      })
    }

    this.time += deltaSeconds * settings.motionSpeed
    const response = 1 - Math.exp(-deltaSeconds * 13)
    const input = audio.waveform
    const sampleCount = Math.min(input.length, Math.round(audio.sampleRate * 0.034))
    const latestStart = input.length - sampleCount
    let start = latestStart
    // Align on a rising zero crossing to reduce frame-to-frame phase jumps.
    for (let index = latestStart; index > Math.max(0, latestStart - 300); index--) {
      if (input[index - 1]! <= 0 && input[index]! > 0) {
        start = index
        break
      }
    }

    this.volume += (Math.min(1, audio.volume * settings.sensitivity * 3) - this.volume) * response
    for (let index = 0; index < POINTS; index++) {
      const sampleIndex = start + Math.round(index * (sampleCount - 1) / (POINTS - 1))
      const sample = sampleCount > 2
        ? (input[Math.max(0, sampleIndex - 1)]! + input[sampleIndex]! * 2 + input[Math.min(input.length - 1, sampleIndex + 1)]!) * 0.25
        : 0
      this.signal[index] = this.signal[index]! + (sample - this.signal[index]!) * response

      const fraction = index / (POINTS - 1)
      const taper = Math.sin(fraction * Math.PI)
      for (let ribbon = 0; ribbon < RIBBONS; ribbon++) {
        const phase = ribbon * 1.08
        const wave = Math.sin(fraction * 8.1 - this.time * 0.85 + phase)
        const drift = Math.sin(fraction * 13.5 + this.time * 0.51 - phase) * 0.34
        const live = Math.tanh(this.signal[index]! * settings.sensitivity * 2.1) * (0.23 - ribbon * 0.035)
        const ambient = (wave + drift) * (0.077 + ribbon * 0.016)
        this.curves[ribbon * POINTS + index] = center + scale * ((ambient + live) * taper + (ribbon - 1) * 0.052)
      }
    }

    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (let ribbon = 0; ribbon < RIBBONS; ribbon++) {
      ctx.strokeStyle = this.gradients[ribbon]!
      for (let age = this.historyCount - 1; age >= 0; age--) {
        const trail = this.history[(this.historyHead - 1 - age + TRAILS) % TRAILS]!
        this.trace(ctx, trail, ribbon, left, xStep)
        ctx.globalAlpha = (0.13 + this.volume * 0.11) / (age + 1)
        ctx.lineWidth = 1.15
        ctx.stroke()
      }

      this.trace(ctx, this.curves, ribbon, left, xStep)
      ctx.globalAlpha = 0.047 + this.volume * 0.05
      ctx.lineWidth = 14 + this.volume * 5
      ctx.stroke()
      ctx.globalAlpha = 0.15 + this.volume * 0.09
      ctx.lineWidth = 4.5
      ctx.stroke()
      ctx.globalAlpha = 0.65 + this.volume * 0.3
      ctx.lineWidth = 1.55
      ctx.stroke()
    }
    ctx.restore()

    this.trailTime += deltaSeconds
    if (this.trailTime >= TRAIL_INTERVAL) {
      this.trailTime %= TRAIL_INTERVAL
      this.history[this.historyHead]!.set(this.curves)
      this.historyHead = (this.historyHead + 1) % TRAILS
      this.historyCount = Math.min(TRAILS, this.historyCount + 1)
    }
  }

  dispose() {
    this.context = undefined
    this.gradients.length = 0
    this.palette = undefined
    this.signal.fill(0)
    this.historyHead = this.historyCount = this.trailTime = this.time = this.volume = 0
  }

  private trace(ctx: CanvasRenderingContext2D, values: Float32Array, ribbon: number, left: number, step: number) {
    const offset = ribbon * POINTS
    ctx.beginPath()
    ctx.moveTo(left, values[offset]!)
    for (let index = 1; index < POINTS - 1; index++) {
      const x = left + index * step
      const current = values[offset + index]!
      const next = values[offset + index + 1]!
      ctx.quadraticCurveTo(x, current, x + step * 0.5, (current + next) * 0.5)
    }
    ctx.lineTo(left + (POINTS - 1) * step, values[offset + POINTS - 1]!)
  }
}
