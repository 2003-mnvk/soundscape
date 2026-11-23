export const PALETTES = {
  'neon-dreams': { label: 'Neon Dreams', colors: ['#22d3ee', '#a855f7', '#ec4899'] },
  'solar-flare': { label: 'Solar Flare', colors: ['#fb923c', '#f43f5e', '#fde047'] },
  'ocean-depths': { label: 'Ocean Depths', colors: ['#4f83ff', '#14b8a6', '#67e8f9'] },
  aurora: { label: 'Aurora', colors: ['#4ade80', '#2dd4bf', '#c084fc'] },
} as const

export const PARTICLE_DENSITIES = ['low', 'medium', 'high'] as const
export const RANGES = {
  sensitivity: { min: 0.5, max: 3, step: 0.05 },
  motionSpeed: { min: 0.25, max: 2, step: 0.05 },
} as const

export type PaletteId = keyof typeof PALETTES
export type ParticleDensity = (typeof PARTICLE_DENSITIES)[number]

export interface StudioSettings {
  sensitivity: number
  motionSpeed: number
  particleDensity: ParticleDensity
  paletteId: PaletteId
}

export type VisualizationSettings = Omit<StudioSettings, 'paletteId'> & {
  palette: readonly [string, string, string]
}

export const DEFAULT_STUDIO_SETTINGS: Readonly<StudioSettings> = {
  sensitivity: 1,
  motionSpeed: 1,
  particleDensity: 'medium',
  paletteId: 'neon-dreams',
}

export function resolveVisualizationSettings({ paletteId, ...settings }: StudioSettings): VisualizationSettings {
  return { ...settings, palette: PALETTES[paletteId].colors }
}

export function validateStudioSettings(value: unknown): StudioSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STUDIO_SETTINGS }
  const candidate = value as Partial<Record<keyof StudioSettings, unknown>>
  const read = (key: keyof StudioSettings) => Object.hasOwn(candidate, key) ? candidate[key] : undefined
  const paletteId = read('paletteId')
  const particleDensity = read('particleDensity')

  function readRange(field: keyof typeof RANGES) {
    const entry = read(field)
    const { min, max, step } = RANGES[field]
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < min || entry > max) {
      return DEFAULT_STUDIO_SETTINGS[field]
    }
    return Number((min + Math.round((entry - min) / step) * step).toFixed(2))
  }

  return {
    sensitivity: readRange('sensitivity'),
    motionSpeed: readRange('motionSpeed'),
    paletteId: typeof paletteId === 'string' && Object.hasOwn(PALETTES, paletteId)
      ? paletteId as PaletteId
      : DEFAULT_STUDIO_SETTINGS.paletteId,
    particleDensity: PARTICLE_DENSITIES.find((density) => density === particleDensity)
      ?? DEFAULT_STUDIO_SETTINGS.particleDensity,
  }
}

export const SETTINGS_STORAGE_KEY = 'soundscape.visualization-settings.v1'

export function readStudioSettings(storage: Pick<Storage, 'getItem'>): StudioSettings {
  const saved = storage.getItem(SETTINGS_STORAGE_KEY)
  if (saved !== null) {
    try {
      return validateStudioSettings(JSON.parse(saved))
    } catch {
      // A partially written or outdated value is safe to replace with defaults.
    }
  }
  return { ...DEFAULT_STUDIO_SETTINGS }
}

export function saveStudioSettings(storage: Pick<Storage, 'setItem'>, settings: StudioSettings) {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
