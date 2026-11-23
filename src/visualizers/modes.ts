import type { Visualizer } from '../types/visualizer.js'
import { CircularSpectrum } from './circularSpectrum.js'
import { createParticleBloom } from './particleBloom.js'
import { WaveformFlow } from './waveformFlow.js'

export const visualizationModes = [
  { id: 'particle-bloom', label: 'Particle Bloom', create: createParticleBloom },
  { id: 'waveform-flow', label: 'Waveform Flow', create: () => new WaveformFlow() },
  { id: 'circular-spectrum', label: 'Circular Spectrum', create: () => new CircularSpectrum() },
] as const satisfies readonly { id: string; label: string; create: () => Visualizer }[]

export type VisualizationMode = (typeof visualizationModes)[number]
