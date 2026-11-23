import type { AudioFeatures, AudioState, AudioStatus } from '../types/audio.js'
import { bandEnergy, frequencyBins, normalizeDecibels, normalizeWaveform, SILENT_LEVELS, smoothLevel } from './features.js'

const FFT_SIZE = 4096
const IDLE_MESSAGE = 'Microphone off'
const EMPTY_FEATURES: AudioFeatures = {
  ...SILENT_LEVELS,
  sampleRate: 0,
  fftSize: 0,
  waveform: new Float32Array(0),
  spectrum: new Float32Array(0),
}

interface Session {
  context: AudioContext
  controller: AbortController
  stream?: MediaStream
  source?: MediaStreamAudioSourceNode
  analyser?: AnalyserNode
  start: Promise<void>
}

function describeError(error: unknown): { status: AudioStatus; message: string } {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { status: 'denied', message: 'Microphone access denied. Check your browser permissions and try again.' }
    case 'NotFoundError':
      return { status: 'error', message: 'No microphone found. Connect an input device and try again.' }
    case 'NotReadableError':
      return { status: 'error', message: 'The microphone is unavailable. Check your device and try again.' }
    default:
      return { status: 'error', message: 'Could not start the microphone. Try again.' }
  }
}

export class AudioEngine {
  private state: AudioState = { status: 'idle', message: IDLE_MESSAGE, canStart: true }
  private readonly listeners = new Set<() => void>()
  private session?: Session
  private permissionPending = false
  private closing?: Promise<void>
  private features = EMPTY_FEATURES
  private sample?: (now: number) => void

  getState = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Call directly from the user's activation handler. */
  start(): Promise<void> {
    if (this.session) return this.session.start
    if (this.permissionPending || this.closing) return Promise.resolve()

    if (!window.isSecureContext) {
      this.publish('error', 'Microphone access requires HTTPS or localhost.')
      return Promise.resolve()
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.AudioContext !== 'function') {
      this.publish('error', 'Microphone input is unavailable in this browser.')
      return Promise.resolve()
    }

    let context: AudioContext
    try {
      context = new window.AudioContext()
    } catch (error) {
      const { status, message } = describeError(error)
      this.publish(status, message)
      return Promise.resolve()
    }

    const controller = new AbortController()
    const session: Session = { context, controller, start: Promise.resolve() }
    this.session = session
    session.start = this.initialize(session)
    if (this.session === session) this.publish('requesting', 'Waiting for microphone access…')
    return session.start
  }

  stop(): Promise<void> {
    return this.release('idle', IDLE_MESSAGE)
  }

  /** Samples the analyser on demand, at most once per animation timestamp. */
  getFeatures(now = performance.now()): AudioFeatures {
    if (this.session?.context.state !== 'running') return EMPTY_FEATURES
    this.sample?.(now)
    return this.features
  }

  private async initialize(session: Session) {
    const { context, controller } = session
    const cancelled = new Promise<void>((resolve) => {
      controller.signal.addEventListener('abort', () => resolve(), { once: true })
    })
    try {
      const resume = context.resume()
      const permission = this.requestStream(session)
      await Promise.race([Promise.all([permission, resume]), cancelled])
      if (this.session !== session || !session.stream) return

      const analyser = context.createAnalyser()
      session.analyser = analyser
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.65
      session.source = context.createMediaStreamSource(session.stream)
      session.source.connect(analyser)
      this.prepareSampler(analyser, context.sampleRate)
      const syncState = () => {
        if (this.session !== session) return
        if (context.state === 'closed') {
          void this.release('error', 'The audio session ended. Start the microphone again.')
        } else if (context.state === 'running') {
          this.publish('active', 'Microphone active')
        } else {
          this.publish('interrupted', 'Microphone interrupted. Waiting for audio to resume.')
        }
      }
      context.addEventListener('statechange', syncState, { signal: controller.signal })
      syncState()
    } catch (error) {
      if (this.session !== session) return
      const { status, message } = describeError(error)
      await this.release(status, message)
    }
  }

  private async requestStream(session: Session) {
    this.permissionPending = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (this.session !== session) {
        for (const track of stream.getTracks()) track.stop()
        return
      }
      session.stream = stream
      const onEnded = () => {
        if (this.session === session) void this.release('error', 'Microphone disconnected. Reconnect it and try again.')
      }
      const tracks = stream.getAudioTracks()
      if (!tracks.some((track) => track.readyState === 'live')) {
        onEnded()
        return
      }
      for (const track of tracks) {
        track.addEventListener('ended', onEnded, { signal: session.controller.signal })
      }
    } finally {
      this.permissionPending = false
      if (!this.session) this.refreshAvailability()
    }
  }

  private release(status: AudioStatus, message: string): Promise<void> {
    const session = this.session
    this.session = undefined
    this.sample = undefined
    this.features = EMPTY_FEATURES

    if (session) {
      session.controller.abort()
      for (const track of session.stream?.getTracks() ?? []) track.stop()
      session.source?.disconnect()
      session.analyser?.disconnect()
      const { context } = session
      this.closing = (context.state === 'closed' ? Promise.resolve() : context.close())
        .catch(() => { /* The context may already be closed. */ })
        .finally(() => {
          this.closing = undefined
          this.refreshAvailability()
        })
    }

    this.publish(status, message)
    return this.closing ?? Promise.resolve()
  }

  private publish(status: AudioStatus, message: string) {
    if (status === 'idle' && this.permissionPending) {
      message = 'Microphone off. Dismiss the browser prompt before starting again.'
    }
    const canStart = !this.session && !this.permissionPending && !this.closing
    if (status === this.state.status && message === this.state.message && canStart === this.state.canStart) return
    this.state = { status, message, canStart }
    for (const listener of this.listeners) listener()
  }

  private refreshAvailability() {
    const { status, message } = this.state
    this.publish(status, status === 'idle' ? IDLE_MESSAGE : message)
  }

  private prepareSampler(analyser: AnalyserNode, sampleRate: number) {
    const { fftSize, frequencyBinCount } = analyser
    const waveform = new Float32Array(fftSize)
    const spectrum = new Float32Array(frequencyBinCount)
    const decibels = new Float32Array(frequencyBinCount)
    const bass = frequencyBins(20, 250, sampleRate, fftSize)
    const mid = frequencyBins(250, 2000, sampleRate, fftSize)
    const treble = frequencyBins(2000, 8000, sampleRate, fftSize)
    const features = { ...SILENT_LEVELS, waveform, spectrum, sampleRate, fftSize }
    let lastSample: number | undefined
    this.features = features

    this.sample = (now) => {
      if (lastSample !== undefined && now - lastSample < 1000 / 120) return
      const elapsed = lastSample === undefined ? 1000 / 60 : now - lastSample
      lastSample = now

      analyser.getFloatTimeDomainData(waveform)
      analyser.getFloatFrequencyData(decibels)
      for (let index = 0; index < spectrum.length; index++) {
        spectrum[index] = normalizeDecibels(decibels[index]!)
      }

      features.volume = smoothLevel(features.volume, normalizeWaveform(waveform), elapsed)
      features.bass = smoothLevel(features.bass, bandEnergy(decibels, bass), elapsed)
      features.mid = smoothLevel(features.mid, bandEnergy(decibels, mid), elapsed)
      features.treble = smoothLevel(features.treble, bandEnergy(decibels, treble), elapsed)
    }
  }
}
