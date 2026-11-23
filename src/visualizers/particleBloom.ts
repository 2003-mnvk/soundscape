import type { CanvasDimensions, Visualizer, VisualizerFrame } from '../types/visualizer.js'
import type { ParticleDensity, VisualizationSettings } from '../settings/visualizationSettings.js'
import { createRandom } from '../utils/random.js'

const TAU = Math.PI * 2
const DENSITY = {
  low: { min: 260, max: 1050, area: 510 },
  medium: { min: 480, max: 1800, area: 300 },
  high: { min: 680, max: 2300, area: 220 },
} satisfies Record<ParticleDensity, { min: number; max: number; area: number }>
const GLOW_SIZE = 48

interface Particle {
  angle: number
  phase: number
  lane: number
  drift: number
  size: number
  light: number
  age: number
  life: number
  glow: boolean
}

export class ParticleBloom implements Visualizer {
  private context?: CanvasRenderingContext2D
  private halo?: CanvasGradient
  private palette?: VisualizationSettings['palette']
  private sprites: HTMLCanvasElement[] = []
  private particles: Particle[] = []
  private random = createRandom(57)
  private count = 0
  private density?: ParticleDensity
  private time = 0
  private bass = 0
  private volume = 0
  private mid = 0
  private treble = 0

  initialize(context: CanvasRenderingContext2D) {
    this.context = context
    this.random = createRandom(57)
    this.time = this.bass = this.volume = this.mid = this.treble = 0
  }

  resize({ width, height }: Readonly<CanvasDimensions>) {
    this.density = undefined
    this.updateHalo(width, height)
  }

  private updatePopulation(width: number, height: number, density: ParticleDensity) {
    if (this.density === density) return
    this.density = density
    const { min, max, area } = DENSITY[density]
    this.count = Math.min(max, Math.max(min, Math.round(width * height / area)))
    while (this.particles.length < this.count) {
      const particle: Particle = { angle: 0, phase: 0, lane: 0, drift: 0, size: 0, light: 0, age: 0, life: 0, glow: false }
      this.seed(particle)
      particle.age = particle.life * this.random()
      this.particles.push(particle)
    }
  }

  private updateHalo(width: number, height: number) {
    if (!this.context) return
    const halo = this.context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.min(width * 0.46, height * 0.78))
    halo.addColorStop(0, (this.palette?.[1] ?? '#a855f7') + '32')
    halo.addColorStop(0.48, (this.palette?.[0] ?? '#22d3ee') + '0e')
    halo.addColorStop(1, '#08090d00')
    this.halo = halo
  }

  render({ audio, deltaSeconds, dimensions, settings }: Readonly<VisualizerFrame>, target = this.context) {
    const ctx = target
    if (!ctx) return
    const { width, height } = dimensions

    if (settings.palette !== this.palette) {
      this.palette = settings.palette
      this.sprites = settings.palette.map(makeGlow)
      this.updateHalo(width, height)
    }

    this.updatePopulation(width, height, settings.particleDensity)
    const alpha = 1 - Math.exp(-deltaSeconds * 8)
    const gain = settings.sensitivity
    this.bass += (Math.min(1, audio.bass * gain) - this.bass) * alpha
    this.volume += (Math.min(1, audio.volume * gain * 3) - this.volume) * alpha
    this.mid += (Math.min(1, audio.mid * gain) - this.mid) * alpha
    this.treble += (Math.min(1, audio.treble * gain) - this.treble) * alpha
    const motionDelta = deltaSeconds * settings.motionSpeed
    this.time += motionDelta * (0.32 + this.mid * 0.18)

    const scale = Math.min(width * 0.38, height * 0.66)
    const expansion = 1 + this.bass * 0.30
    const tilt = -0.33 + Math.sin(this.time * 0.36) * 0.12
    const sinTilt = Math.sin(tilt)
    const cosTilt = Math.cos(tilt)
    const centerX = width * 0.5
    const centerY = height * 0.50

    ctx.clearRect(0, 0, width, height)
    if (this.halo) {
      ctx.fillStyle = this.halo
      ctx.fillRect(0, 0, width, height)
    }
    ctx.globalCompositeOperation = 'lighter'

    for (let index = 0; index < this.count; index++) {
      const particle = this.particles[index]!
      particle.age += motionDelta
      if (particle.age >= particle.life) this.seed(particle)
      const life = particle.age / particle.life
      const fade = Math.min(1, life * 7, (1 - life) * 5)
      const angle = particle.angle + this.time * particle.drift
      const twist = particle.phase + this.time + angle * 3
      const braid = Math.sin(angle * 3 + particle.lane + this.time * 0.65)
      const orbit = (0.74 + braid * 0.16 + Math.cos(twist) * (0.07 + this.mid * 0.025)) * expansion
      const x = Math.cos(angle) * orbit
      const y = Math.sin(angle) * orbit * 0.62 + Math.sin(twist) * 0.085
      const px = centerX + (x * cosTilt - y * sinTilt) * scale
      const py = centerY + (x * sinTilt + y * cosTilt) * scale
      const size = particle.size * (1 + this.treble * 0.22)
      const tint = index % settings.palette.length
      const shimmer = 1 - this.treble * 0.24 * (0.5 + 0.5 * Math.sin(particle.phase + this.time * 15))
      const opacity = fade * shimmer * Math.min(1, particle.light * (0.68 + this.volume * 0.85))

      if (particle.glow) {
        const glow = (size + 1) * (5 + this.volume * 2)
        ctx.globalAlpha = opacity * 0.65
        ctx.drawImage(this.sprites[tint]!, px - glow / 2, py - glow / 2, glow, glow)
      }

      ctx.fillStyle = settings.palette[tint]!
      ctx.globalAlpha = opacity
      ctx.fillRect(px - size / 2, py - size / 2, size, size)
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  dispose() {
    this.halo = undefined
    this.context = undefined
    this.palette = undefined
    this.sprites = []
    this.particles = []
    this.count = 0
    this.density = undefined
  }

  private seed(particle: Particle) {
    const random = this.random
    particle.angle = random() * TAU
    particle.phase = random() * TAU
    particle.lane = Math.floor(random() * 3) * TAU / 3
    particle.drift = 0.62 + random() * 0.68
    particle.size = 0.7 + random() ** 3 * 2.1
    particle.light = 0.19 + random() ** 1.5 * 0.81
    particle.age = 0
    particle.life = 5 + random() * 11
    particle.glow = random() > 0.77
  }
}

function makeGlow(color: string) {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = GLOW_SIZE
  const context = sprite.getContext('2d')
  if (!context) return sprite

  const center = GLOW_SIZE / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'transparent')
  context.fillStyle = gradient
  context.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE)
  return sprite
}

export function createParticleBloom() {
  return new ParticleBloom()
}
