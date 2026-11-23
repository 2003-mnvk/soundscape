import type { CanvasDimensions, Visualizer, VisualizerFrame } from '../types/visualizer.js'
import type { VisualizationSettings } from '../settings/visualizationSettings.js'

const BARS_PER_BAND = 32
const TAU = Math.PI * 2
const GUIDE_RINGS = [0.74, 0.88, 1.31, 1.75]
const BANDS = [[20, 250], [250, 2000], [2000, 8000]] as const

export class CircularSpectrum implements Visualizer {
  private context?: CanvasRenderingContext2D
  private halo?: CanvasGradient
  private palette?: VisualizationSettings['palette']
  private readonly levels = new Float32Array(BARS_PER_BAND * BANDS.length)
  private readonly firstBins = new Uint32Array(this.levels.length)
  private readonly endBins = new Uint32Array(this.levels.length)
  private readonly angles = new Float32Array(this.levels.length)
  private sampleRate = -1
  private fftSize = -1
  private time = 0
  private volume = 0

  initialize(context: CanvasRenderingContext2D) {
    this.context = context
    for (let index = 0; index < this.angles.length; index++) {
      this.angles[index] = -Math.PI / 2 + TAU * (index + 0.5) / this.angles.length
    }
  }

  resize(_dimensions: Readonly<CanvasDimensions>) {
    this.halo = undefined
  }

  private updateHalo({ width, height }: Readonly<CanvasDimensions>, color: string) {
    const ctx = this.context
    if (!ctx) return
    const size = Math.min(width, height)
    const halo = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, size * 0.45)
    halo.addColorStop(0, color + '44')
    halo.addColorStop(0.55, color + '15')
    halo.addColorStop(1, 'transparent')
    this.halo = halo
  }

  render({ audio, deltaSeconds, dimensions, settings }: Readonly<VisualizerFrame>, target = this.context) {
    const ctx = target
    if (!ctx) return
    if (!this.halo || this.palette !== settings.palette) {
      this.palette = settings.palette
      this.updateHalo(dimensions, settings.palette[1])
    }
    if (!this.halo) return
    if (this.sampleRate !== audio.sampleRate || this.fftSize !== audio.fftSize) {
      this.mapBins(audio.sampleRate, audio.fftSize)
    }

    const { width, height } = dimensions
    const size = Math.min(width, height)
    const radius = size * 0.215
    const cx = width / 2
    const cy = height / 2
    this.time += deltaSeconds * settings.motionSpeed
    this.volume += (Math.min(1, audio.volume * settings.sensitivity * 3) - this.volume) * (1 - Math.exp(-deltaSeconds * 7))

    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.globalAlpha = 0.76 + this.volume * 0.24
    ctx.fillStyle = this.halo
    ctx.fillRect(0, 0, width, height)
    ctx.translate(cx, cy)
    ctx.lineWidth = 1
    ctx.strokeStyle = '#9994bf'
    for (const ring of GUIDE_RINGS) {
      ctx.globalAlpha = ring < 1 ? 0.25 : 0.17
      ctx.beginPath()
      ctx.arc(0, 0, radius * ring, 0, TAU)
      ctx.stroke()
    }

    for (let band = 0; band < BANDS.length; band++) {
      const first = band * BARS_PER_BAND
      const end = first + BARS_PER_BAND
      const attack = 1 - Math.exp(-deltaSeconds * (8 + band * 6))
      const release = 1 - Math.exp(-deltaSeconds * (4 + band * 3))
      const reach = size * (0.19 - band * 0.021)
      const color = settings.palette[band]!
      const bandLevel = band === 0 ? audio.bass : band === 1 ? audio.mid : audio.treble
      const inner = radius + Math.min(1, bandLevel * settings.sensitivity) * size * 0.014

      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let index = first; index < end; index++) {
        let peak = 0
        for (let bin = this.firstBins[index]!; bin < this.endBins[index]! && bin < audio.spectrum.length; bin++) {
          peak = Math.max(peak, audio.spectrum[bin]!)
        }
        const target = Math.min(1, peak * settings.sensitivity) ** 1.6
        const old = this.levels[index]!
        const level = old + (target - old) * (target > old ? attack : release)
        this.levels[index] = level

        const theta = this.angles[index]!
        const ambient = 0.5 + 0.5 * Math.sin(theta * (band + 3) - this.time * (0.85 + band * 0.37))
        const outer = inner + size * (0.015 + ambient * 0.021) + reach * level
        const x = Math.cos(theta)
        const y = Math.sin(theta)
        ctx.moveTo(inner * x, inner * y)
        ctx.lineTo(outer * x, outer * y)
      }

      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.13 + this.volume * 0.1
      ctx.lineWidth = Math.max(2.5, size * 0.013)
      ctx.stroke()
      ctx.globalAlpha = 0.72 + this.volume * 0.24
      ctx.lineWidth = Math.max(1.2, size * 0.005)
      ctx.stroke()
    }
    ctx.restore()
  }

  dispose() {
    this.context = undefined
    this.halo = undefined
    this.palette = undefined
    this.levels.fill(0)
    this.time = this.volume = 0
  }

  private mapBins(sampleRate: number, fftSize: number) {
    this.sampleRate = sampleRate
    this.fftSize = fftSize
    const binCount = fftSize / 2
    const resolution = sampleRate ? fftSize / sampleRate : 0

    for (let band = 0; band < BANDS.length; band++) {
      const [low, high] = BANDS[band]!
      const ratio = high / low
      const limit = Math.min(binCount, Math.ceil(high * resolution))
      const minimum = Math.ceil(low * resolution)
      for (let index = 0; index < BARS_PER_BAND; index++) {
        const firstHz = low * ratio ** (index / BARS_PER_BAND)
        const endHz = low * ratio ** ((index + 1) / BARS_PER_BAND)
        const first = Math.max(minimum, Math.min(limit - 1, Math.floor(firstHz * resolution)))
        const slot = band * BARS_PER_BAND + index
        this.firstBins[slot] = first
        // Neighboring low-end bars can share a bin where FFT resolution is limited.
        this.endBins[slot] = Math.min(limit, Math.max(first + 1, Math.ceil(endHz * resolution)))
      }
    }
  }
}
