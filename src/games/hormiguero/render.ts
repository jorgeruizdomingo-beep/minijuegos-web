/**
 * Escena en canvas: hormigas caminando entre el nido y la miga.
 * Es puramente decorativo: el número de hormigas refleja la colonia.
 */

type Hormiga = {
  t: number // posición en el camino [0,1]
  v: number // velocidad (unidades de t por segundo)
  dir: 1 | -1
  carril: number // desplazamiento lateral
  carga: boolean // lleva una miga
}

type Particula = { x: number; y: number; vx: number; vy: number; vida: number }

const MAX_HORMIGAS = 140

import type { Escena } from '../../core/arranque'

export class EscenaHormiguero implements Escena {
  private ctx: CanvasRenderingContext2D
  private hormigas: Hormiga[] = []
  private particulas: Particula[] = []
  private ancho = 0
  private alto = 0
  private dpr = 1
  private tiempo = 0
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.redimensionar()
    new ResizeObserver(() => this.redimensionar()).observe(canvas)
  }

  private redimensionar() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.ancho = Math.max(1, Math.floor(r.width))
    this.alto = Math.max(1, Math.floor(r.height))
    this.canvas.width = this.ancho * this.dpr
    this.canvas.height = this.alto * this.dpr
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /** Ajusta la población visible al tamaño de la colonia. */
  poblacion(n: number) {
    const objetivo = Math.min(MAX_HORMIGAS, 3 + Math.floor(Math.sqrt(n) * 4))
    while (this.hormigas.length < objetivo) {
      this.hormigas.push({
        t: Math.random(),
        v: 0.08 + Math.random() * 0.1,
        dir: Math.random() < 0.5 ? 1 : -1,
        carril: (Math.random() - 0.5) * 36,
        carga: Math.random() < 0.5,
      })
    }
    if (this.hormigas.length > objetivo) this.hormigas.length = objetivo
  }

  /** Explosión de migas al hacer clic. */
  clic(x: number, y: number, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 60 + Math.random() * 120
      this.particulas.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, vida: 0.7 + Math.random() * 0.3 })
    }
  }

  // Camino curvo del nido (abajo) a la miga (arriba).
  private punto(t: number, carril: number): [number, number] {
    const x0 = this.ancho * 0.5
    const y0 = this.alto - 28
    const x1 = this.ancho * 0.5
    const y1 = 54
    const cx = this.ancho * 0.5 + Math.sin(t * Math.PI) * this.ancho * 0.25
    const u = 1 - t
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1
    const y = u * u * y0 + 2 * u * t * (y0 + y1) / 2 + t * t * y1
    // normal aproximada para separar carriles
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx)
    const dy = 2 * u * ((y0 + y1) / 2 - y0) + 2 * t * (y1 - (y0 + y1) / 2)
    const len = Math.hypot(dx, dy) || 1
    return [x + (-dy / len) * carril, y + (dx / len) * carril]
  }

  frame(dt: number) {
    this.tiempo += dt
    const { ctx, ancho, alto } = this
    ctx.clearRect(0, 0, ancho, alto)

    // Suelo
    const g = ctx.createLinearGradient(0, 0, 0, alto)
    g.addColorStop(0, 'rgba(255,255,255,0.02)')
    g.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, ancho, alto)

    // Rastro de feromonas
    ctx.strokeStyle = 'rgba(245,179,66,0.10)'
    ctx.lineWidth = 46
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) {
      const [x, y] = this.punto(i / 40, 0)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Nido
    ctx.fillStyle = '#5a3d2b'
    ctx.beginPath()
    ctx.ellipse(ancho * 0.5, alto - 20, 70, 22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b1a12'
    ctx.beginPath()
    ctx.ellipse(ancho * 0.5, alto - 24, 20, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    // Miga grande (objetivo de clic) con pulso
    const pulso = 1 + Math.sin(this.tiempo * 3) * 0.03
    ctx.save()
    ctx.translate(ancho * 0.5, 50)
    ctx.scale(pulso, pulso)
    ctx.fillStyle = '#d9a35a'
    ctx.beginPath()
    ctx.moveTo(-34, 10)
    ctx.lineTo(-20, -18)
    ctx.lineTo(8, -24)
    ctx.lineTo(34, -6)
    ctx.lineTo(26, 18)
    ctx.lineTo(-10, 22)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#b8803f'
    for (const [px, py] of [[-12, -4], [10, 2], [2, 12], [18, -10]] as const) {
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Hormigas
    for (const h of this.hormigas) {
      h.t += h.v * h.dir * dt
      if (h.t >= 1) { h.t = 1; h.dir = -1; h.carga = true }
      if (h.t <= 0) { h.t = 0; h.dir = 1; h.carga = false }
      const [x, y] = this.punto(h.t, h.carril)
      const [x2, y2] = this.punto(Math.min(1, Math.max(0, h.t + 0.01 * h.dir)), h.carril)
      const ang = Math.atan2(y2 - y, x2 - x)
      this.dibujarHormiga(x, y, ang, h.carga, h.t * 40)
    }

    // Partículas
    this.particulas = this.particulas.filter((p) => p.vida > 0)
    for (const p of this.particulas) {
      p.vida -= dt
      p.vy += 300 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = Math.max(0, p.vida)
      ctx.fillStyle = '#e7b86e'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private dibujarHormiga(x: number, y: number, ang: number, carga: boolean, fase: number) {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    // patas
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    const osc = Math.sin(fase * 6 + this.tiempo * 20) * 2
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(-3, 0); ctx.lineTo(-6, s * (4 + osc))
      ctx.moveTo(0, 0); ctx.lineTo(0, s * (5 - osc))
      ctx.moveTo(3, 0); ctx.lineTo(6, s * (4 + osc))
      ctx.stroke()
    }
    // cuerpo (3 segmentos)
    ctx.fillStyle = '#1f1f1f'
    for (const [cx, r] of [[-4, 2.6], [0, 1.8], [4, 2.2]] as const) {
      ctx.beginPath()
      ctx.ellipse(cx, 0, r + 0.4, r, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (carga) {
      ctx.fillStyle = '#e7b86e'
      ctx.beginPath()
      ctx.arc(7, 0, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}
