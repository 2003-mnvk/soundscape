import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_STUDIO_SETTINGS,
  readStudioSettings,
  resolveVisualizationSettings,
  saveStudioSettings,
} from '../settings/visualizationSettings'
import type { StudioSettings } from '../settings/visualizationSettings'

export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(() => {
    try {
      return readStudioSettings(window.localStorage)
    } catch {
      return { ...DEFAULT_STUDIO_SETTINGS }
    }
  })

  useEffect(() => {
    try {
      saveStudioSettings(window.localStorage, settings)
    } catch {
      // The current session still works when browser storage is unavailable.
    }
  }, [settings])

  const visualizationSettings = useMemo(() => resolveVisualizationSettings(settings), [settings])

  function update<K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) {
    setSettings((previous) => previous[key] === value ? previous : { ...previous, [key]: value })
  }

  return { settings, visualizationSettings, update, reset: () => setSettings(DEFAULT_STUDIO_SETTINGS) }
}
