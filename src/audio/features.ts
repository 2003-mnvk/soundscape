import type { AudioLevels } from '../types/audio.js'

export const SILENT_LEVELS: Readonly<AudioLevels> = { volume: 0, bass: 0, mid: 0, treble: 0 }

const floorDb = -80
const ceilingDb = -12

export function normalizeDecibels(db: number) {
  if (Number.isNaN(db)) return 0
  return Math.max(0, Math.min(1, (db - floorDb) / (ceilingDb - floorDb)))
}

export function normalizeWaveform(waveform: Float32Array) {
  let squares = 0
  for (let index = 0; index < waveform.length; index++) {
    const raw = waveform[index]!
    const sample = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0
    waveform[index] = sample
    squares += sample * sample
  }
  return waveform.length ? Math.sqrt(squares / waveform.length) : 0
}

export interface BinRange {
  start: number
  end: number
}

export function frequencyBins(minHz: number, maxHz: number, sampleRate: number, fftSize: number): BinRange {
  const hzPerBin = sampleRate / fftSize
  const binCount = fftSize / 2
  return {
    start: Math.min(binCount, Math.ceil(minHz / hzPerBin)),
    end: Math.min(binCount, Math.ceil(maxHz / hzPerBin)),
  }
}

export function bandEnergy(decibels: Float32Array, { start, end }: BinRange) {
  let power = 0
  for (let index = start; index < end; index++) {
    const db = decibels[index]!
    if (Number.isFinite(db)) power += 10 ** (db / 10)
  }
  return normalizeDecibels(10 * Math.log10(power))
}

export function smoothLevel(previous: number, next: number, elapsedMs: number) {
  const timeConstantMs = next > previous ? 65 : 220
  return next + (previous - next) * Math.exp(-elapsedMs / timeConstantMs)
}
