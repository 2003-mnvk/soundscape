import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { SILENT_LEVELS } from '../audio/features'
import type { AudioLevels } from '../types/audio'

const meters = [
  { key: 'volume', label: 'Volume' },
  { key: 'bass', label: 'Bass' },
  { key: 'mid', label: 'Midrange' },
  { key: 'treble', label: 'Treble' },
] as const

export function AudioMeters({ engine }: { engine: AudioEngine }) {
  const [levels, setLevels] = useState<AudioLevels>(SILENT_LEVELS)

  useEffect(() => {
    function update() {
      if (document.hidden) return
      const { volume, bass, mid, treble } = engine.getFeatures()
      const next = {
        volume: Math.round(volume * 100),
        bass: Math.round(bass * 100),
        mid: Math.round(mid * 100),
        treble: Math.round(treble * 100),
      }
      setLevels((previous) => (
        meters.every(({ key }) => next[key] === previous[key]) ? previous : next
      ))
    }

    update()
    const timer = window.setInterval(update, 50)
    return () => window.clearInterval(timer)
  }, [engine])

  return (
    <div className="audio-meters" role="group" aria-label="Live microphone levels">
      {meters.map(({ key, label }) => (
        <div className="audio-meter" key={key}>
          <div className="audio-meter-label">
            <span>{label}</span>
            <span aria-hidden="true">{levels[key]}%</span>
          </div>
          <meter aria-label={label} min={0} max={100} value={levels[key]} />
        </div>
      ))}
    </div>
  )
}
