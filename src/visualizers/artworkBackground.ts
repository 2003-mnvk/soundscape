const CENTER = '#14132a'
const EDGE = '#090a12'
const CENTER_X = 0.5
const CENTER_Y = 0.48
const RADIUS_X = 0.53
const RADIUS_Y = 0.54

export const ARTWORK_BACKGROUND = `radial-gradient(ellipse ${RADIUS_X * 100}% ${RADIUS_Y * 100}% at ${CENTER_X * 100}% ${CENTER_Y * 100}%, ${CENTER}, ${EDGE})`

export function compositeArtworkBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save()
  context.globalCompositeOperation = 'destination-over'
  context.translate(width * CENTER_X, height * CENTER_Y)
  context.scale(width * RADIUS_X, height * RADIUS_Y)
  const background = context.createRadialGradient(0, 0, 0, 0, 0, 1)
  background.addColorStop(0, CENTER)
  background.addColorStop(1, EDGE)
  context.fillStyle = background
  context.fillRect(-CENTER_X / RADIUS_X, -CENTER_Y / RADIUS_Y, 1 / RADIUS_X, 1 / RADIUS_Y)
  context.restore()
}
