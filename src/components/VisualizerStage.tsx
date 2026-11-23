import { Eye, EyeOff, Minimize, Pause, Play, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { useStageFullscreen } from '../hooks/useStageFullscreen'
import type { useVisualizerCanvas } from '../hooks/useVisualizerCanvas'
import { ARTWORK_BACKGROUND } from '../visualizers/artworkBackground'
import type { VisualizationMode } from '../visualizers/modes'

interface VisualizerStageProps {
  mode: VisualizationMode
  live: boolean
  paused: boolean
  onTogglePlayback: () => void
  canvas: ReturnType<typeof useVisualizerCanvas>
  fullscreen: ReturnType<typeof useStageFullscreen>
}

export function VisualizerStage({ mode, live, paused, onTogglePlayback, canvas, fullscreen }: VisualizerStageProps) {
  const [showControls, setShowControls] = useState(false)
  const playbackLabel = paused ? 'Resume animation' : 'Pause animation'
  const hideChrome = fullscreen.active && !showControls

  useEffect(() => {
    if (!fullscreen.active) setShowControls(false)
  }, [fullscreen.active])

  return (
    <motion.section
      ref={fullscreen.stageRef}
      className="stage"
      style={{ backgroundImage: ARTWORK_BACKGROUND }}
      data-immersive={fullscreen.active}
      data-fallback={fullscreen.fallback}
      aria-label={mode.label + ' visualizer'}
      initial={canvas.reducedMotion ? false : { opacity: 0.65 }}
      animate={{ opacity: 1 }}
      transition={{ duration: canvas.reducedMotion ? 0 : 0.55 }}
    >
      <canvas ref={canvas.ref} aria-hidden="true" />
      <div className="stage-guides" aria-hidden="true"><i /><i /><i /><i /></div>
      {fullscreen.active && (
        <div className="immersive-actions">
          <button ref={fullscreen.exitRef} className="immersive-button" type="button" onClick={() => { setShowControls(false); void fullscreen.toggle() }}>
            <Minimize size={16} aria-hidden="true" /> Exit fullscreen
          </button>
          <button
            className="immersive-button"
            type="button"
            aria-expanded={showControls}
            aria-controls="stage-playback-controls stage-input-status"
            onClick={() => setShowControls(!showControls)}
          >
            {showControls ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            {showControls ? 'Hide controls' : 'Show controls'}
          </button>
        </div>
      )}
      <div className="stage-top" id="stage-input-status" hidden={hideChrome}>
        <div className="demo-badge" data-live={live}><span /> {live ? 'Live Audio' : 'Demo Mode'}</div>
        <div className="stage-engine">Canvas 2D</div>
      </div>
      {canvas.status !== 'ready' && (
        <div className="stage-state" role="status">
          <Sparkles size={24} aria-hidden="true" />
          {canvas.status === 'loading' ? 'Preparing the canvas…' : 'Canvas 2D is unavailable on this device.'}
        </div>
      )}
      <div className="stage-bottom" id="stage-playback-controls" hidden={hideChrome}>
        <div>
          <p className="stage-title">{mode.label}</p>
          <p className="stage-caption">{live ? 'Microphone input' : 'Ambient animation'}</p>
        </div>
        {canvas.reducedMotion ? <p className="stage-caption">Still preview</p> : (
          <button
            type="button"
            className="playback"
            aria-label={playbackLabel}
            title={playbackLabel}
            onClick={onTogglePlayback}
            disabled={canvas.status !== 'ready'}
          >
            {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
      {fullscreen.active && fullscreen.message && <p className="immersive-status" role="status">{fullscreen.message}</p>}
    </motion.section>
  )
}
