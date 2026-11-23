import assert from 'node:assert/strict'
import test from 'node:test'
import { pngDimensions, renderArtworkPng } from '../.test-output/visualizers/pngExport.js'

test('PNG dimensions round once before scaling and reject empty or excessive sizes', () => {
  assert.deepEqual(pngDimensions(1118.4, 487.7, 1), { pixelWidth: 1118, pixelHeight: 488 })
  assert.deepEqual(pngDimensions(1118.4, 487.7, 2), { pixelWidth: 2236, pixelHeight: 976 })
  assert.throws(() => pngDimensions(0, 480, 1), /not visible/)
  assert.throws(() => pngDimensions(Infinity, 480, 1), /not visible/)
  assert.throws(() => pngDimensions(6000, 3000, 2), /too large/)
})

test('PNG export rejects transparent artwork before encoding a background', async (t) => {
  const target = { setTransform() {} }
  let encoded = false
  const canvas = {
    getContext: () => target,
    toBlob: () => { encoded = true },
  }
  const probe = {
    getContext: () => ({
      drawImage(source) { assert.equal(source, canvas) },
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
    }),
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  let created = 0
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => created++ === 0 ? canvas : probe },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else delete globalThis.document
  })

  const visualizer = {
    render(frame, context) {
      assert.equal(frame.deltaSeconds, 0)
      assert.equal(context, target)
      assert.equal(canvas.width, 800)
    },
  }
  await assert.rejects(renderArtworkPng(visualizer, { dimensions: { width: 400, height: 300 } }, 2), /no artwork/)
  assert.equal(encoded, false)
  assert.equal(canvas.width, 0)
})
