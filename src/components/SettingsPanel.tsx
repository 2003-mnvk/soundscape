import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { PALETTES, PARTICLE_DENSITIES, RANGES } from '../settings/visualizationSettings'
import type { PaletteId, StudioSettings } from '../settings/visualizationSettings'

interface SettingsPanelProps {
  settings: StudioSettings
  supportsDensity: boolean
  onChange: <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => void
  onReset: () => void
}

const sliders = [
  { key: 'sensitivity', label: 'Sensitivity' },
  { key: 'motionSpeed', label: 'Motion speed' },
] as const

const paletteIds = Object.keys(PALETTES) as PaletteId[]

export function SettingsPanel({ settings, supportsDensity, onChange, onReset }: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-heading">
        <h2 id="settings-title"><SlidersHorizontal size={17} aria-hidden="true" /> Visualization settings</h2>
        <button type="button" className="settings-reset" onClick={onReset}>
          <RotateCcw size={15} aria-hidden="true" /> Reset to defaults
        </button>
      </div>

      <div className="settings-sliders">
        {sliders.map(({ key, label }) => {
          const value = `${settings[key].toFixed(2)}×`
          return (
            <div className="settings-slider" key={key}>
              <div>
                <label htmlFor={key}>{label}</label>
                <span aria-hidden="true">{value}</span>
              </div>
              <input
                id={key}
                type="range"
                {...RANGES[key]}
                value={settings[key]}
                aria-valuetext={value}
                onChange={(event) => onChange(key, event.currentTarget.valueAsNumber)}
              />
            </div>
          )
        })}
      </div>

      <fieldset className="settings-fieldset" disabled={!supportsDensity} aria-describedby="density-availability">
        <legend>Particle density</legend>
        <p id="density-availability">Applies to Particle Bloom only.</p>
        <div className="density-options">
          {PARTICLE_DENSITIES.map((density) => (
            <label className="settings-option density-option" key={density}>
              <input
                type="radio"
                name="particle-density"
                value={density}
                checked={settings.particleDensity === density}
                onChange={() => onChange('particleDensity', density)}
              />
              <span>{density}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Color palette</legend>
        <div className="palette-options">
          {paletteIds.map((id) => (
            <label className="settings-option palette-option" key={id}>
              <input
                type="radio"
                name="color-palette"
                value={id}
                checked={settings.paletteId === id}
                onChange={() => onChange('paletteId', id)}
              />
              <span className="palette-swatches" aria-hidden="true">
                {PALETTES[id].colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
              </span>
              <span>{PALETTES[id].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  )
}
