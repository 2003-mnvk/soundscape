import { AudioLines, Maximize, Radio } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { VisualizerStage } from './components/VisualizerStage'
import { ModeSelector } from './components/ModeSelector'
import { ControlToolbar } from './components/ControlToolbar'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useStudioSettings } from './hooks/useStudioSettings'
import { useStageFullscreen } from './hooks/useStageFullscreen'
import { useVisualizerCanvas } from './hooks/useVisualizerCanvas'
import { visualizationModes } from './visualizers/modes'
import type { VisualizationMode } from './visualizers/modes'

export function App() {
  const audio = useAudioEngine()
  const { settings, visualizationSettings, update, reset } = useStudioSettings()
  const [mode, setMode] = useState<VisualizationMode>(visualizationModes[0])

  const [paused, setPaused] = useState(false)
  const canvas = useVisualizerCanvas(mode.create, audio.engine, paused, visualizationSettings)
  const fullscreen = useStageFullscreen()

  return (
    <MotionConfig reducedMotion="user">
      <header className="site-header" inert={fullscreen.active}>
        <div className="shell flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="brand-mark"><AudioLines size={22} aria-hidden="true" /></span>
            <div>
              <p className="wordmark">Sound<span>Scape</span></p>
              <p className="brand-caption">Turn sound into art</p>
            </div>
          </div>
          <button ref={fullscreen.triggerRef} className="fullscreen" type="button" onClick={() => { void fullscreen.toggle() }}>
            <Maximize size={15} aria-hidden="true" /> Fullscreen
          </button>
        </div>
      </header>
      <main className="shell studio">
        <div className="studio-heading" inert={fullscreen.active}>
          <p className="eyebrow"><Radio size={15} aria-hidden="true" /> Visual studio</p>
          <h1>Sound into <span>form.</span></h1>
          <p className="intro">A canvas for exploring the shape of sound.</p>
        </div>
        <VisualizerStage
          mode={mode}
          live={audio.status === 'active'}
          paused={paused}
          onTogglePlayback={() => setPaused(!paused)}
          canvas={canvas}
          fullscreen={fullscreen}
        />
        <div inert={fullscreen.active}>
          <ModeSelector selected={mode} onSelect={setMode} />
          <ControlToolbar
            {...audio}
            settings={settings}
            supportsDensity={mode.id === 'particle-bloom'}
            onSettingsChange={update}
            onSettingsReset={reset}
            artworkExport={{ disabled: canvas.status !== 'ready', modeId: mode.id, capture: canvas.capture }}
          />
        </div>
      </main>
      <footer className="site-footer" inert={fullscreen.active}>
        <div className="shell flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
          <p><strong>SoundScape</strong> <span className="footer-divider">/</span> A generative visual studio</p>
          <p>Built with Web Audio API &amp; Canvas</p>
        </div>
      </footer>
    </MotionConfig>
  )
}
