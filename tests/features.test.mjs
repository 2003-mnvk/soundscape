import assert from 'node:assert/strict'
import test from 'node:test'
import { bandEnergy, frequencyBins, normalizeDecibels, normalizeWaveform, smoothLevel } from '../.test-output/audio/features.js'

test('waveform clips to normalized amplitudes and returns RMS', () => {
  assert.equal(normalizeWaveform(new Float32Array(8)), 0)
  const waveform = Float32Array.of(-2, 2, -0.5, 0.5)
  assert.equal(normalizeWaveform(waveform), Math.sqrt(2.5 / 4))
  assert.deepEqual([...waveform], [-1, 1, -0.5, 0.5])
})

test('band ranges use the real FFT resolution, with exclusive upper boundaries', () => {
  assert.deepEqual(frequencyBins(20, 250, 48000, 4096), { start: 2, end: 22 })
  assert.deepEqual(frequencyBins(20, 250, 44100, 4096), { start: 2, end: 24 })
  assert.deepEqual(frequencyBins(250, 2000, 8000, 1024), { start: 32, end: 256 })
  assert.deepEqual(frequencyBins(2000, 8000, 8000, 1024), { start: 256, end: 512 })
})

test('synthetic bass, midrange and treble peaks affect only their own bands', () => {
  const ranges = [[20, 250], [250, 2000], [2000, 8000]]
  const bins = new Float32Array(2048)
  for (const [expectedBand, hz] of [100, 1000, 5000].entries()) {
    bins.fill(-Infinity)
    bins[Math.round(hz * 4096 / 48000)] = -30
    for (const [band, [low, high]] of ranges.entries()) {
      const energy = bandEnergy(bins, frequencyBins(low, high, 48000, 4096))
      assert.equal(energy, band === expectedBand ? normalizeDecibels(-30) : 0)
    }
  }
})

test('spectrum normalization clamps and smoothing depends on elapsed time', () => {
  assert.equal(normalizeDecibels(-Infinity), 0)
  assert.equal(normalizeDecibels(-46), 0.5)
  assert.equal(normalizeDecibels(0), 1)
  const first = smoothLevel(0, 1, 20)
  assert.ok(first > 0 && first < 1)
  assert.ok(Math.abs(smoothLevel(first, 1, 20) - smoothLevel(0, 1, 40)) < 1e-12)
  assert.ok(1 - smoothLevel(1, 0, 20) < first)
})

test('non-finite analyser samples do not contaminate an entire audio frame', () => {
  const waveform = Float32Array.of(NaN, Infinity, -Infinity, 0.5)
  assert.equal(normalizeWaveform(waveform), 0.25)
  assert.deepEqual([...waveform], [0, 0, 0, 0.5])
  assert.equal(normalizeDecibels(NaN), 0)
  assert.equal(bandEnergy(Float32Array.of(NaN, -Infinity, -30), { start: 0, end: 3 }), normalizeDecibels(-30))
})
