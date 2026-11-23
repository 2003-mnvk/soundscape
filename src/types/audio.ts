export type AudioStatus = 'idle' | 'requesting' | 'active' | 'interrupted' | 'denied' | 'error'

export interface AudioState {
  status: AudioStatus
  message: string
  canStart: boolean
}

export interface AudioLevels {
  volume: number
  bass: number
  mid: number
  treble: number
}

export interface AudioFeatures extends AudioLevels {
  sampleRate: number
  fftSize: number
  /** Borrowed frame buffer, updated in place. Values are in [-1, 1]. */
  waveform: Readonly<Float32Array>
  /** Borrowed frame buffer, updated in place. Values are in [0, 1]. */
  spectrum: Readonly<Float32Array>
}
