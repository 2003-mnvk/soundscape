import assert from 'node:assert/strict'
import test from 'node:test'
import { ParticleBloom } from '../.test-output/visualizers/particleBloom.js'
import { mountVisualization } from '../.test-output/visualizers/visualizationHost.js'
import { DEFAULT_VISUALIZATION_SETTINGS } from '../.test-output/types/visualizer.js'

const silence = {
  volume: 0, bass: 0, mid: 0, treble: 0,
  sampleRate: 48000, fftSize: 4096,
  waveform: new Float32Array(4096), spectrum: new Float32Array(2048),
}

function replaceGlobal(t, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key)
  Object.defineProperty(globalThis, key, { configurable: true, value })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous)
    else delete globalThis[key]
  })
}

test('silence drifts, bass expands the bloom, volume brightens it, and density adapts', (t) => {
  const gradient = { addColorStop() {} }
  const context = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    points: [],
    clearRect() { this.points.length = 0 },
    createRadialGradient: () => gradient,
    fillRect(x, y, width, height) {
      if (this.globalCompositeOperation === 'lighter') this.points.push({ x, y, width, height, alpha: this.globalAlpha })
    },
    drawImage() {},
  }
  replaceGlobal(t, 'document', {
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => gradient, fillRect() {} }) }),
  })
  const dimensions = { width: 1100, height: 480, pixelRatio: 1 }
  const frames = (audio) => {
    const bloom = new ParticleBloom()
    bloom.initialize(context)
    bloom.resize(dimensions)
    const input = { audio, deltaSeconds: 1 / 60, dimensions, settings: DEFAULT_VISUALIZATION_SETTINGS }
    bloom.render(input)
    const first = [...context.points]
    for (let frame = 0; frame < 60; frame++) bloom.render(input)
    return { bloom, first, later: [...context.points] }
  }
  const ambient = frames(silence)
  assert.notDeepEqual(ambient.first, ambient.later)
  const live = frames({ ...silence, bass: 0.9, volume: 0.5 })
  assert.equal(live.later.length, ambient.later.length)
  assert.ok(live.later.length <= 1800)
  const average = (points, read) => points.reduce((sum, point) => sum + read(point), 0) / points.length
  const radius = ({ x, y, width, height }) => Math.hypot(x + width / 2 - 550, y + height / 2 - 240)
  assert.ok(average(live.later, radius) > average(ambient.later, radius) * 1.2)
  assert.ok(average(live.later, (point) => point.alpha) > average(ambient.later, (point) => point.alpha) * 1.4)

  const mobile = { width: 320, height: 300, pixelRatio: 2 }
  live.bloom.resize(mobile)
  live.bloom.render({ audio: silence, deltaSeconds: 0, dimensions: mobile, settings: DEFAULT_VISUALIZATION_SETTINGS })
  assert.ok(context.points.length < live.later.length / 2)
  live.bloom.dispose()
  ambient.bloom.dispose()
})

test('the host handles live and idle input, DPR resize, pause, and StrictMode-style remount', (t) => {
  const viewport = new EventTarget()
  viewport.devicePixelRatio = 1
  const pending = new Map()
  let nextId = 0
  let observedResize
  let disconnects = 0
  replaceGlobal(t, 'window', viewport)
  const visibility = new EventTarget()
  visibility.hidden = false
  replaceGlobal(t, 'document', visibility)
  replaceGlobal(t, 'requestAnimationFrame', (callback) => {
    pending.set(++nextId, callback)
    return nextId
  })
  replaceGlobal(t, 'cancelAnimationFrame', (id) => pending.delete(id))
  replaceGlobal(t, 'ResizeObserver', class {
    constructor(callback) { observedResize = callback }
    observe() {}
    disconnect() { disconnects++ }
  })
  const advance = (now) => {
    assert.equal(pending.size, 1)
    const [[id, callback]] = pending
    pending.delete(id)
    callback(now)
  }

  let width = 900
  const canvas = { getBoundingClientRect: () => ({ width, height: 420 }) }
  const transforms = []
  const context = { setTransform: (...args) => transforms.push(args) }
  const rendered = []
  let disposals = 0
  let resizes = 0
  let ready = 0
  let audio = { ...silence, sampleRate: 0 }
  const visualizer = {
    initialize: (ctx) => assert.equal(ctx, context),
    resize: () => { resizes++ },
    render: ({ audio, deltaSeconds, dimensions }) => rendered.push({ audio, deltaSeconds, width: dimensions.width }),
    dispose: () => { disposals++ },
  }
  const mount = () => mountVisualization(canvas, context, visualizer, () => audio, () => { ready++ })
  const host = mount()
  assert.equal(ready, 1)
  host.setPlaying(true)
  host.setPlaying(true)
  advance(1000)
  audio = { ...silence, bass: 0.9 }
  advance(2000)
  assert.equal(rendered.at(-1).audio.bass, 0.9)
  assert.equal(rendered.at(-1).deltaSeconds, 0.05)
  audio = silence
  advance(2016)
  assert.equal(rendered.at(-1).audio.sampleRate, 48000)
  assert.equal(rendered.at(-1).audio.bass, 0)
  audio = { ...silence, sampleRate: 0 }
  advance(2032)
  assert.equal(rendered.at(-1).audio.sampleRate, 0)

  width = 400
  viewport.devicePixelRatio = 3
  observedResize()
  assert.equal(canvas.width, 800)
  assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0])
  advance(2048)
  assert.equal(rendered.at(-1).width, 400)
  assert.equal(resizes, 2)

  visibility.hidden = true
  visibility.dispatchEvent(new Event('visibilitychange'))
  assert.equal(pending.size, 0)
  visibility.hidden = false
  visibility.dispatchEvent(new Event('visibilitychange'))
  advance(5000)
  assert.equal(rendered.at(-1).deltaSeconds, 0)

  width = 370
  observedResize()
  host.setPlaying(false)
  assert.equal(pending.size, 0)
  assert.equal(rendered.at(-1).width, 370)
  width = 320
  observedResize()
  assert.equal(rendered.at(-1).width, 320)
  host.setPlaying(true)
  host.dispose()
  assert.equal(pending.size, 0)
  const remount = mount()
  remount.setPlaying(true)
  advance(3000)
  assert.equal(rendered.at(-1).deltaSeconds, 0)
  remount.dispose()
  assert.equal(disposals, 2)
  assert.equal(disconnects, 2)
  assert.equal(pending.size, 0)
})
