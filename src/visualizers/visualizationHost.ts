import type { AudioFeatures } from '../types/audio.js'
import type { VisualizationSettings } from '../settings/visualizationSettings.js'
import { DEFAULT_VISUALIZATION_SETTINGS } from '../types/visualizer.js'
import type { Visualizer, VisualizerFrame } from '../types/visualizer.js'
import { renderArtworkPng } from './pngExport.js'
import type { PngScale } from './pngExport.js'

export function mountVisualization(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  visualizer: Visualizer,
  readAudio: (now: number) => AudioFeatures,
  onReady: () => void,
) {
  const dimensions = { width: 0, height: 0, pixelRatio: 0 }
  const input: VisualizerFrame = {
    audio: { ...readAudio(performance.now()) },
    deltaSeconds: 0,
    dimensions,
    settings: DEFAULT_VISUALIZATION_SETTINGS,
  }
  let settings = input.settings
  let painted = false
  let frame: number | undefined
  let previous: number | undefined
  let ready = false
  let playing = false
  let disposed = false

  function syncLoop() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    previous = undefined
    if (playing && !disposed && !document.hidden) frame = requestAnimationFrame(tick)
  }

  visualizer.initialize(context)

  function paint(now: number, deltaSeconds: number) {
    Object.assign(input.audio, readAudio(now))
    input.deltaSeconds = deltaSeconds
    input.settings = settings
    visualizer.render(input)
    painted = true
    if (!ready) {
      ready = true
      onReady()
    }
  }

  function resize() {
    if (disposed) return false
    const { width, height } = canvas.getBoundingClientRect()
    if (width <= 0 || height <= 0) {
      dimensions.width = 0
      dimensions.height = 0
      return false
    }

    // Limit backing-store cost on very dense displays while keeping CSS coordinates.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    if (width === dimensions.width && height === dimensions.height && pixelRatio === dimensions.pixelRatio) return false

    painted = false
    dimensions.width = width
    dimensions.height = height
    dimensions.pixelRatio = pixelRatio
    canvas.width = Math.max(1, Math.round(width * pixelRatio))
    canvas.height = Math.max(1, Math.round(height * pixelRatio))
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    visualizer.resize(dimensions)
    return true
  }

  function refresh() {
    if (resize() && frame === undefined) paint(performance.now(), 0)
  }

  function tick(now: number) {
    frame = undefined
    if (!playing || disposed || document.hidden) return
    if (Math.min(window.devicePixelRatio || 1, 2) !== dimensions.pixelRatio || !dimensions.width) resize()
    const delta = previous === undefined ? 0 : Math.min(Math.max(now - previous, 0) / 1000, 0.05)
    previous = now
    if (dimensions.width) paint(now, delta)
    if (playing && !disposed && frame === undefined) frame = requestAnimationFrame(tick)
  }

  const observer = new ResizeObserver(refresh)
  observer.observe(canvas)
  window.addEventListener('resize', refresh)
  document.addEventListener('visibilitychange', syncLoop)
  refresh()

  return {
    async capture(scale: PngScale): Promise<Blob> {
      if (disposed) throw new Error('The visualizer was closed.')
      resize()
      if (!dimensions.width) throw new Error('The artwork is not visible.')
      if (!painted) paint(performance.now(), 0)
      return renderArtworkPng(visualizer, input, scale)
    },
    setSettings(next: Readonly<VisualizationSettings>) {
      if (disposed || next === settings) return
      settings = next
      if (!playing && dimensions.width) paint(performance.now(), 0)
    },
    setPlaying(next: boolean) {
      if (disposed || next === playing) return
      playing = next
      syncLoop()
      // Resizing clears the backing store before the next frame can repaint.
      if (!next && !painted && dimensions.width) paint(performance.now(), 0)
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (frame !== undefined) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', refresh)
      document.removeEventListener('visibilitychange', syncLoop)
      visualizer.dispose()
    },
  }
}
