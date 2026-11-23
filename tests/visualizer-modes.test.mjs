import assert from 'node:assert/strict'
import test from 'node:test'
import { CircularSpectrum } from '../.test-output/visualizers/circularSpectrum.js'
import { WaveformFlow } from '../.test-output/visualizers/waveformFlow.js'
import { DEFAULT_VISUALIZATION_SETTINGS } from '../.test-output/types/visualizer.js'

const dimensions = { width: 900, height: 450, pixelRatio: 2 }
const audio = {
  sampleRate: 48000,
  fftSize: 4096,
  volume: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  waveform: new Float32Array(4096),
  spectrum: new Float32Array(2048),
}

function recorder() {
  const strokes = []
  const gradient = { addColorStop() {} }
  let coordinates = []
  const context = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    clearRect: () => { strokes.length = 0 },
    save() {},
    restore() {},
    translate() {},
    fillRect() {},
    beginPath: () => { coordinates = [] },
    moveTo: (x, y) => coordinates.push(x, y),
    lineTo: (x, y) => coordinates.push(x, y),
    quadraticCurveTo: (...points) => coordinates.push(...points),
    arc() {},
    stroke() { strokes.push({ points: coordinates, color: this.strokeStyle, width: this.lineWidth }) },
  }
  return { context, strokes }
}

function prepare(visualizer) {
  const { context, strokes } = recorder()
  visualizer.initialize(context)
  visualizer.resize(dimensions)
  return {
    draw(input, deltaSeconds = 1 / 60) {
      visualizer.render({ audio: input, deltaSeconds, dimensions, settings: DEFAULT_VISUALIZATION_SETTINGS })
      return strokes.slice()
    },
  }
}

test('Waveform Flow uses sample shape, with trails and curved coordinates that remain finite', () => {
  const waveform = Float32Array.from(audio.waveform, (_, index) => Math.sin(index * 0.018) * 0.35)
  const silent = new WaveformFlow()
  const live = new WaveformFlow()
  const ambient = prepare(silent)
  const reactive = prepare(live)
  const initial = ambient.draw(audio)
  let first
  let second
  for (let frame = 0; frame < 24; frame++) {
    first = ambient.draw(audio)
    second = reactive.draw({ ...audio, waveform, volume: 0.23 })
  }
  assert.ok(first.length > initial.length)
  assert.notDeepEqual(first.at(-1).points, initial.at(-1).points)
  assert.notDeepEqual(second.at(-1).points, first.at(-1).points)
  assert.ok(second.every(({ points }) => points.every(Number.isFinite)))
  live.dispose()
  silent.dispose()
})

test('Circular Spectrum isolates bins to their frequency sectors and eases toward peaks', () => {
  const spectrum = audio.spectrum.slice()
  const bin = Math.round(1000 * audio.fftSize / audio.sampleRate)
  spectrum[bin] = 1
  const ambient = prepare(new CircularSpectrum())
  const reactive = prepare(new CircularSpectrum())
  const lengths = (strokes, color) => {
    const points = strokes.filter((stroke) => stroke.color === color).at(-1).points
    const bars = []
    for (let index = 0; index < points.length; index += 4) {
      bars.push(Math.hypot(points[index + 2] - points[index], points[index + 3] - points[index + 1]))
    }
    return bars
  }
  const [bass, mid, treble] = DEFAULT_VISUALIZATION_SETTINGS.palette
  const idle = ambient.draw(audio)
  const early = reactive.draw({ ...audio, spectrum })
  for (const color of [bass, treble]) assert.deepEqual(lengths(early, color), lengths(idle, color))
  const peak = (strokes) => Math.max(...lengths(strokes, mid))
  assert.ok(peak(early) > peak(idle))
  let later
  for (let frame = 0; frame < 40; frame++) later = reactive.draw({ ...audio, spectrum })
  assert.ok(peak(later) > peak(early) + 25)
  const released = reactive.draw(audio)
  assert.ok(peak(released) > peak(idle))
})
