import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_STUDIO_SETTINGS,
  PALETTES,
  SETTINGS_STORAGE_KEY,
  readStudioSettings,
  resolveVisualizationSettings,
  saveStudioSettings,
  validateStudioSettings,
} from '../.test-output/settings/visualizationSettings.js'

test('validates each persisted field independently', () => {
  assert.deepEqual(validateStudioSettings(null), DEFAULT_STUDIO_SETTINGS)
  assert.deepEqual(validateStudioSettings(Object.create({ sensitivity: 1.5, paletteId: 'aurora' })), DEFAULT_STUDIO_SETTINGS)
  assert.deepEqual(validateStudioSettings({
    sensitivity: '2', motionSpeed: 9, particleDensity: 'maximum', paletteId: '__proto__',
  }), DEFAULT_STUDIO_SETTINGS)
  assert.deepEqual(validateStudioSettings({
    sensitivity: 2.12, motionSpeed: 0.25, particleDensity: 'high', paletteId: 'aurora',
  }), { sensitivity: 2.1, motionSpeed: 0.25, particleDensity: 'high', paletteId: 'aurora' })
})

test('settings round-trip through storage and resolve palettes for all modes', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.deepEqual(readStudioSettings(storage), DEFAULT_STUDIO_SETTINGS)

  for (const [paletteId, palette] of Object.entries(PALETTES)) {
    const custom = { sensitivity: 3, motionSpeed: 2, particleDensity: 'low', paletteId }
    saveStudioSettings(storage, custom)
    assert.deepEqual(readStudioSettings(storage), custom)
    assert.equal(resolveVisualizationSettings(readStudioSettings(storage)).palette, palette.colors)
  }

  saveStudioSettings(storage, DEFAULT_STUDIO_SETTINGS)
  assert.deepEqual(readStudioSettings(storage), DEFAULT_STUDIO_SETTINGS)
  storage.setItem(SETTINGS_STORAGE_KEY, '{bad JSON')
  assert.deepEqual(readStudioSettings(storage), DEFAULT_STUDIO_SETTINGS)
})
