import { Mic, MicOff, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { StudioSettings } from '../settings/visualizationSettings'
import type { AudioState } from '../types/audio'
import { AudioMeters } from './AudioMeters'
import { ArtworkExport } from './ArtworkExport'
import type { ComponentProps } from 'react'
import { SettingsPanel } from './SettingsPanel'

interface ControlToolbarProps extends AudioState {
  engine: AudioEngine
  artworkExport: ComponentProps<typeof ArtworkExport>
  settings: StudioSettings
  supportsDensity: boolean
  onSettingsChange: <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => void
  onSettingsReset: () => void
}

export function ControlToolbar({
  engine, status, message, canStart, settings, supportsDensity, onSettingsChange, onSettingsReset, artworkExport,
}: ControlToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const active = status === 'active'
  const requesting = status === 'requesting'
  const canStop = active || status === 'interrupted' || requesting
  const MicIcon = canStop ? MicOff : Mic
  const label = requesting ? 'Cancel Microphone' : canStop ? 'Stop Microphone' : 'Start Microphone'

  return (
    <section className="controls" aria-label="Visualizer controls">
      <div className="control-dock">
        <button
          className="mic-button"
          type="button"
          disabled={!canStop && !canStart}
          aria-describedby="controls-status"
          onClick={() => { void (canStop ? engine.stop() : engine.start()) }}
        >
          <MicIcon size={17} aria-hidden="true" /> {label}
        </button>
        <div className="control-icons">
          <button
            className="settings-toggle"
            type="button"
            aria-expanded={settingsOpen}
            aria-controls="visualization-settings"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <SlidersHorizontal size={17} aria-hidden="true" /> Settings
          </button>
          <ArtworkExport {...artworkExport} />
        </div>
      </div>
      <p id="controls-status" role="status" data-status={status}>{message}</p>
      <div id="visualization-settings" className="settings-disclosure" hidden={!settingsOpen}>
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            supportsDensity={supportsDensity}
            onChange={onSettingsChange}
            onReset={onSettingsReset}
          />
        )}
      </div>
      {active && <AudioMeters engine={engine} />}
    </section>
  )
}
