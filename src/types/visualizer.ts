import type { AudioFeatures } from './audio.js'
import { DEFAULT_STUDIO_SETTINGS, resolveVisualizationSettings } from '../settings/visualizationSettings.js'
import type { VisualizationSettings } from '../settings/visualizationSettings.js'

export interface CanvasDimensions {
  width: number
  height: number
  pixelRatio: number
}


export interface VisualizerFrame {
  audio: AudioFeatures
  deltaSeconds: number
  dimensions: Readonly<CanvasDimensions>
  settings: Readonly<VisualizationSettings>
}

export interface Visualizer {
  initialize(context: CanvasRenderingContext2D): void
  resize(dimensions: Readonly<CanvasDimensions>): void
  render(frame: Readonly<VisualizerFrame>, target?: CanvasRenderingContext2D): void
  dispose(): void
}

export const DEFAULT_VISUALIZATION_SETTINGS = resolveVisualizationSettings(DEFAULT_STUDIO_SETTINGS)
