import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { Visualizer } from '../types/visualizer'
import type { VisualizationSettings } from '../settings/visualizationSettings'
import { mountVisualization } from '../visualizers/visualizationHost'
import type { PngScale } from '../visualizers/pngExport'

export function useVisualizerCanvas(createVisualizer: () => Visualizer, engine: AudioEngine, paused: boolean, settings: VisualizationSettings) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<ReturnType<typeof mountVisualization> | null>(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    query.addEventListener('change', sync)
    sync()
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      setStatus('unavailable')
      return
    }

    setStatus('loading')
    const host = mountVisualization(canvas, context, createVisualizer(), (now) => engine.getFeatures(now), () => setStatus('ready'))
    hostRef.current = host
    return () => {
      host.dispose()
      hostRef.current = null
    }
  }, [createVisualizer, engine])

  useEffect(() => {
    hostRef.current?.setPlaying(!paused && !reducedMotion)
  }, [createVisualizer, engine, paused, reducedMotion])

  useEffect(() => {
    hostRef.current?.setSettings(settings)
  }, [createVisualizer, engine, settings])

  function capture(scale: PngScale) {
    return hostRef.current?.capture(scale) ?? Promise.reject(new Error('The visualizer is not ready.'))
  }

  return { ref, status, reducedMotion, capture }
}
