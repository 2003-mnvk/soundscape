import { AudioWaveform, CircleDot, Orbit } from 'lucide-react'
import { visualizationModes } from '../visualizers/modes'
import type { VisualizationMode } from '../visualizers/modes'

const icons = {
  'particle-bloom': Orbit,
  'waveform-flow': AudioWaveform,
  'circular-spectrum': CircleDot,
}

interface ModeSelectorProps {
  selected: VisualizationMode
  onSelect: (mode: VisualizationMode) => void
}

export function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
  return (
    <section className="modes" aria-labelledby="modes-title">
      <h2 id="modes-title" className="section-label">Visualization modes</h2>
      <ul className="mode-grid">
        {visualizationModes.map((mode) => {
          const Icon = icons[mode.id]
          const active = selected.id === mode.id

          return (
            <li key={mode.id}>
              <button
                className={active ? 'mode-card active' : 'mode-card'}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(mode)}
              >
                <span className="mode-icon"><Icon size={20} aria-hidden="true" /></span>
                <strong>{mode.label}</strong>
                {active && <span className="active-dot" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
