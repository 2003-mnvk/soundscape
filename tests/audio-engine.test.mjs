import assert from 'node:assert/strict'
import test from 'node:test'
import { AudioEngine } from '../.test-output/audio/AudioEngine.js'

function mockAudio(t, { secure = true, supported = true, resume = async () => {} } = {}) {
  const stats = { contexts: 0, closed: 0, disconnected: 0, requests: [] }
  const analyser = {
    get frequencyBinCount() { return this.fftSize / 2 },
    getFloatTimeDomainData: (samples) => samples.fill(0.5),
    getFloatFrequencyData: (bins) => {
      bins.fill(-Infinity)
      bins[9] = -24
    },
    disconnect: () => { stats.disconnected++ },
  }
  const context = class extends EventTarget {
    sampleRate = 48000
    state = 'running'
    constructor() { super(); stats.contexts++; stats.current = this }
    resume = resume
    createAnalyser = () => analyser
    createMediaStreamSource = () => ({
      connect: (target) => assert.equal(target, analyser),
      disconnect: () => { stats.disconnected++ },
    })
    close = async () => { stats.closed++ }
  }

  for (const [key, value] of Object.entries({
    window: { isSecureContext: secure, AudioContext: context },
    AudioContext: context,
    navigator: {
      mediaDevices: supported ? {
        getUserMedia: (constraints) => {
          assert.deepEqual(constraints, { audio: true })
          return new Promise((resolve, reject) => { stats.requests.push({ resolve, reject }) })
        },
      } : undefined,
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else delete globalThis[key]
    })
  }

  return stats
}

function mockStream() {
  const track = new EventTarget()
  track.readyState = 'live'
  track.stop = () => { track.readyState = 'ended' }
  return { getTracks: () => [track], getAudioTracks: () => [track], track }
}

test('start shares one request, samples in place, and releases the graph before restarting', async (t) => {
  const stats = mockAudio(t)
  const engine = new AudioEngine()
  assert.equal(stats.contexts, 0)

  const first = engine.start()
  assert.equal(engine.start(), first)
  assert.equal(stats.contexts, 1)
  assert.equal(stats.requests.length, 1)
  assert.equal(engine.getState().status, 'requesting')

  const stream = mockStream()
  stats.requests[0].resolve(stream)
  await first
  assert.equal(engine.getState().status, 'active')
  const features = engine.getFeatures(0)
  assert.equal(features.waveform[0], 0.5)
  assert.equal(features.sampleRate, 48000)
  assert.ok(features.volume > 0)
  assert.ok(features.bass > 0)
  assert.equal(features.mid, 0)
  assert.equal(features.treble, 0)
  assert.equal(engine.getFeatures(16).waveform, features.waveform)

  await Promise.all([engine.stop(), engine.stop()])
  assert.equal(stream.track.readyState, 'ended')
  assert.equal(stats.closed, 1)
  assert.equal(stats.disconnected, 2)
  assert.equal(engine.getFeatures().volume, 0)

  const restart = engine.start()
  assert.equal(stats.contexts, 2)
  const restartedStream = mockStream()
  stats.requests[1].resolve(restartedStream)
  await restart
  restartedStream.track.dispatchEvent(new Event('ended'))
  assert.equal(engine.getState().status, 'error')
  assert.equal(restartedStream.track.readyState, 'ended')
  await engine.stop()
})

test('stop settles startup and disposes of a late stream without opening a second prompt', async (t) => {
  const stats = mockAudio(t, { resume: () => new Promise(() => {}) })
  const engine = new AudioEngine()
  const startup = engine.start()
  await engine.stop()
  await startup
  assert.equal(stats.closed, 1)
  assert.equal(engine.getState().status, 'idle')
  assert.equal(engine.getState().canStart, false)

  await engine.start()
  assert.equal(stats.requests.length, 1)
  const stream = mockStream()
  stats.requests[0].resolve(stream)
  await Promise.resolve()
  assert.equal(stream.track.readyState, 'ended')
  assert.equal(engine.getState().status, 'idle')
  assert.equal(engine.getState().canStart, true)
  assert.equal(stats.disconnected, 0)
})

test('permission denial closes the context and leaves the engine available to retry', async (t) => {
  const stats = mockAudio(t)
  const engine = new AudioEngine()
  const started = engine.start()
  stats.requests[0].reject(new DOMException('Denied', 'NotAllowedError'))
  await started
  assert.equal(engine.getState().status, 'denied')
  assert.equal(engine.getState().canStart, true)
  assert.equal(stats.closed, 1)
})

test('unsupported and insecure pages do not construct an audio context', async (t) => {
  await t.test('insecure page', async (t) => {
    const stats = mockAudio(t, { secure: false })
    const engine = new AudioEngine()
    await engine.start()
    assert.match(engine.getState().message, /HTTPS or localhost/)
    assert.equal(stats.contexts, 0)
  })

  await t.test('unsupported browser', async (t) => {
    const stats = mockAudio(t, { supported: false })
    const engine = new AudioEngine()
    await engine.start()
    assert.match(engine.getState().message, /unavailable/)
    assert.equal(stats.contexts, 0)
  })
})

test('an interrupted context stops returning stale samples and an externally closed context releases its tracks', async (t) => {
  const stats = mockAudio(t)
  const engine = new AudioEngine()
  const started = engine.start()
  const stream = mockStream()
  stats.requests[0].resolve(stream)
  await started
  assert.ok(engine.getFeatures(0).volume > 0)

  stats.current.state = 'suspended'
  stats.current.dispatchEvent(new Event('statechange'))
  assert.equal(engine.getState().status, 'interrupted')
  assert.equal(engine.getFeatures(16).waveform.length, 0)
  assert.equal(stream.track.readyState, 'live')

  stats.current.state = 'running'
  stats.current.dispatchEvent(new Event('statechange'))
  assert.equal(engine.getState().status, 'active')
  assert.ok(engine.getFeatures(32).volume > 0)

  stats.current.state = 'closed'
  stats.current.dispatchEvent(new Event('statechange'))
  assert.equal(engine.getState().status, 'error')
  assert.equal(stream.track.readyState, 'ended')
  assert.equal(stats.disconnected, 2)
  assert.equal(stats.closed, 0)
  await engine.stop()
})
