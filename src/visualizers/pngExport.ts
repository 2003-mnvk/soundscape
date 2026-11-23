import type { Visualizer, VisualizerFrame } from '../types/visualizer.js'
import { compositeArtworkBackground } from './artworkBackground.js'

export type PngScale = 1 | 2

export function pngDimensions(width: number, height: number, scale: PngScale) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The artwork is not visible.')
  }
  const pixelWidth = Math.max(1, Math.round(width)) * scale
  const pixelHeight = Math.max(1, Math.round(height)) * scale
  if (pixelWidth > 16384 || pixelHeight > 16384 || pixelWidth * pixelHeight > 40_000_000) {
    throw new Error('The export is too large. Try 1× or resize the window.')
  }
  return { pixelWidth, pixelHeight }
}

function containsArtwork(canvas: HTMLCanvasElement) {
  // Downsample before reading pixels so large exports do not require a full-size readback.
  const probe = document.createElement('canvas')
  probe.width = probe.height = 32
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  context.drawImage(canvas, 0, 0, probe.width, probe.height)
  const { data } = context.getImageData(0, 0, probe.width, probe.height)
  return data.some((value, index) => index % 4 === 3 && value > 0)
}

export async function renderArtworkPng(visualizer: Visualizer, frame: VisualizerFrame, scale: PngScale): Promise<Blob> {
  const { width, height } = frame.dimensions
  const { pixelWidth, pixelHeight } = pngDimensions(width, height, scale)
  const canvas = document.createElement('canvas')
  canvas.width = pixelWidth
  canvas.height = pixelHeight

  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No export canvas context.')

    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    visualizer.render({ ...frame, deltaSeconds: 0, dimensions: { width, height, pixelRatio: scale } }, context)
    if (!containsArtwork(canvas)) throw new Error('The export has no artwork.')
    compositeArtworkBackground(context, width, height)
    // A failed canvas allocation can leave a context that silently ignores drawing.
    if (context.getImageData(0, 0, 1, 1).data[3] !== 255) throw new Error('The export canvas could not be rendered.')

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob?.size && blob.type === 'image/png') resolve(blob)
        else reject(new Error('PNG encoding failed.'))
      }, 'image/png')
    })
  } finally {
    canvas.width = canvas.height = 0
  }
}

export function downloadArtwork(blob: Blob, modeId: string, scale: PngScale) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = `soundscape-${modeId}-${timestamp}-${scale}x.png`
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    // Give browsers time to start reading the blob after the anchor click.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
