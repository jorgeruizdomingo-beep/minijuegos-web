/**
 * Escena en canvas: hormigas caminando entre el nido y la miga.
 * Es puramente decorativa, pero refleja la colonia: cuántas hormigas hay,
 * qué edificios se han comprado (hojas, grano, hongos, túneles, reina...).
 */

import type { Escena } from '../../core/arranque'
import type { Incremental } from '../../core/incremental'

type Hormiga = {
  t: number // posición en el camino [0,1]
  v: number // velocidad (unidades de t por segundo)
  dir: 1 | -1
  carril: number // desplazamiento lateral
  carga: boolean // lleva algo de vuelta al nido
  hoja: boolean // lo que lleva es una hoja (si hay cortadoras)
  fase: number // desfase de la animación de patas
}

type Exploradora = { x: number; y: number; ang: number; giro: number; v: number; fase: number }

type Particula = { x: number; y: number; vx: number; vy: number; vida: number; r: number; color: string }

const MAX_HORMIGAS = 120
const MAX_EXPLORADORAS = 8

export class EscenaHormiguero implements Escena {
  private ctx: CanvasRenderingContext2D
  private juego: Incremental
  private hormigas: Hormiga[] = []
  private exploradoras: Exploradora[] = []
  private particulas: Particula[] = []
  private estrellas: { x: number; y: number; f: number }[] = []
  private luciernagas: { x: number; y: number; ang: number; f: number }[] = []
  private ancho = 0
  private alto = 0
  private dpr = 1
  private tiempo = 0
  private impacto = 0 // 1 justo tras un clic, decae a 0 (aplasta la miga)
  private impulso = 0 // 1 justo tras un clic, decae: las hormigas aprietan el paso
  // Lo que el motor avisa que ha cambiado (nodos del árbol, mejoras, vidas): ver cambio().
  private desbloqueos = new Set<string>()
  private vidas = 0
  private mejoras = { hongosLuminosos: false, hojasGigantes: false, turnosNoche: false, redSubterranea: false, menteColmena: false }
  private abejas: { ang: number; r: number; v: number }[] = [{ ang: 0, r: 60, v: 1.1 }, { ang: 2.5, r: 80, v: -0.8 }]
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, juego: Incremental) {
    this.canvas = canvas
    this.juego = juego
    this.ctx = canvas.getContext('2d')!
    this.redimensionar()
    new ResizeObserver(() => this.redimensionar()).observe(canvas)
    for (let i = 0; i < 40; i++) this.estrellas.push({ x: Math.random(), y: Math.random() * 0.55, f: Math.random() * 6 })
    for (let i = 0; i < 14; i++) this.luciernagas.push({ x: Math.random(), y: 0.25 + Math.random() * 0.6, ang: Math.random() * 7, f: Math.random() * 7 })
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

  /** 0 = pleno día, 1 = noche cerrada. Ciclo de cuatro minutos. */
  private noche() {
    const fase = (this.tiempo % 240) / 240
    return 0.5 - 0.5 * Math.cos(fase * Math.PI * 2)
  }

  private n(id: string) {
    return this.juego.cantidad(id)
  }

  /** El motor avisa de compras, nodos y prestigio: la escena relee lo que cambia el mapa. */
  cambio() {
    const j = this.juego
    this.desbloqueos = new Set(j.desbloqueos())
    this.vidas = j.estado.vidas
    this.mejoras = {
      hongosLuminosos: j.tieneMejora('hongos_3'),
      hojasGigantes: j.tieneMejora('cortadora_3'),
      turnosNoche: j.tieneMejora('global_3'),
      redSubterranea: j.tieneMejora('tunel_3'),
      menteColmena: j.tieneMejora('global_4'),
    }
  }

  private tiene(clave: string) {
    return this.desbloqueos.has(clave)
  }

  /** Ajusta la población visible al tamaño de la colonia. */
  poblacion(n: number) {
    const objetivo = Math.min(MAX_HORMIGAS, 3 + Math.floor(Math.sqrt(n) * 4))
    while (this.hormigas.length < objetivo) {
      this.hormigas.push({
        t: Math.random(),
        v: 0.08 + Math.random() * 0.1,
        dir: Math.random() < 0.5 ? 1 : -1,
        carril: (Math.random() - 0.5) * 50,
        carga: Math.random() < 0.5,
        hoja: false,
        fase: Math.random() * 40,
      })
    }
    if (this.hormigas.length > objetivo) this.hormigas.length = objetivo

    const exploradoras = Math.min(MAX_EXPLORADORAS, Math.ceil(Math.sqrt(this.n('exploradora'))))
    while (this.exploradoras.length < exploradoras) {
      this.exploradoras.push({
        x: this.ancho * 0.5,
        y: this.alto - 30,
        ang: -Math.PI / 2 + (Math.random() - 0.5),
        giro: 0,
        v: 22 + Math.random() * 14,
        fase: Math.random() * 40,
      })
    }
    if (this.exploradoras.length > exploradoras) this.exploradoras.length = exploradoras
  }

  /** Explosión de migas al hacer clic. */
  clic(x: number, y: number, n = 12) {
    this.impacto = 1
    this.impulso = 1
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 60 + Math.random() * 140
      this.particulas.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 90,
        vida: 0.6 + Math.random() * 0.4,
        r: 2 + Math.random() * 2.5,
        color: Math.random() < 0.7 ? '#e7b86e' : '#f5d79a',
      })
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
    this.impacto = Math.max(0, this.impacto - dt * 5)
    this.impulso = Math.max(0, this.impulso - dt * 1.5)
    const { ctx, ancho, alto } = this

    ctx.clearRect(0, 0, ancho, alto)
    this.dibujarFondo()
    this.dibujarRastro()
    this.dibujarEdificios()
    this.dibujarNido()
    this.dibujarMiga()

    // Hormigas del rastro: con más producción van más deprisa.
    const hayHojas = this.n('cortadora') > 0
    const prisa = 1 + Math.min(1.2, Math.log10(this.juego.produccionTotal() + 1) / 6) + this.impulso * 1.5
    for (const h of this.hormigas) {
      h.t += h.v * prisa * h.dir * dt
      if (h.t >= 1) { h.t = 1; h.dir = -1; h.carga = true; h.hoja = hayHojas && Math.random() < 0.4 }
      if (h.t <= 0) { h.t = 0; h.dir = 1; h.carga = false }
      const [x, y] = this.punto(h.t, h.carril)
      const [x2, y2] = this.punto(Math.min(1, Math.max(0, h.t + 0.01 * h.dir)), h.carril)
      const ang = Math.atan2(y2 - y, x2 - x)
      this.dibujarHormiga(x, y, ang, h.carga ? (h.hoja ? 'hoja' : 'miga') : null, h.fase + h.t * 40)
    }

    // Exploradoras: vagan por el suelo buscando rutas
    for (const e of this.exploradoras) {
      if (Math.random() < dt * 1.5) e.giro = (Math.random() - 0.5) * 4
      e.ang += e.giro * dt
      e.x += Math.cos(e.ang) * e.v * dt
      e.y += Math.sin(e.ang) * e.v * dt
      // Rebotar suavemente en los bordes (y no subir a la zona de la miga)
      if (e.x < 10 || e.x > ancho - 10 || e.y < 90 || e.y > alto - 10) {
        e.ang = Math.atan2(alto * 0.6 - e.y, ancho * 0.5 - e.x) + (Math.random() - 0.5)
        e.x = Math.min(ancho - 10, Math.max(10, e.x))
        e.y = Math.min(alto - 10, Math.max(90, e.y))
      }
      this.dibujarHormiga(e.x, e.y, e.ang, null, e.fase + this.tiempo * 3)
    }

    this.dibujarNoche(dt)

    // Partículas
    this.particulas = this.particulas.filter((p) => p.vida > 0)
    for (const p of this.particulas) {
      p.vida -= dt
      p.vy += 320 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida * 1.5))
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private dibujarFondo() {
    const { ctx, ancho, alto } = this
    const g = ctx.createLinearGradient(0, 0, 0, alto)
    g.addColorStop(0, 'rgba(255,255,255,0.02)')
    g.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, ancho, alto)

    // Estrellas de noche; con la colonia cósmica, también de día.
    const estrellas = Math.max(this.noche(), this.n('cosmica') > 0 ? 1 : 0)
    if (estrellas > 0.05) {
      for (const s of this.estrellas) {
        const a = (0.35 + 0.35 * Math.sin(this.tiempo * 1.5 + s.f)) * estrellas
        ctx.fillStyle = `rgba(220,230,255,${a})`
        ctx.beginPath()
        ctx.arc(s.x * ancho, s.y * alto, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** Velo azulado de noche y luciérnagas sobre la escena. */
  private dibujarNoche(dt: number) {
    const { ctx, ancho, alto } = this
    const n = this.noche()
    if (n < 0.03) return
    ctx.fillStyle = `rgba(8,12,40,${0.32 * n})`
    ctx.fillRect(0, 0, ancho, alto)
    // Farolillo de resina: luz cálida sobre el nido y el arranque del rastro.
    if (this.tiene('faro')) {
      const g = ctx.createRadialGradient(ancho * 0.5, alto - 30, 10, ancho * 0.5, alto - 30, 170)
      g.addColorStop(0, `rgba(255,190,80,${0.28 * n})`)
      g.addColorStop(1, 'rgba(255,190,80,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, ancho, alto)
    }
    // Turnos de noche (mejora): las hormigas del rastro llevan una chispa de luz.
    if (this.mejoras.turnosNoche) {
      ctx.fillStyle = `rgba(255,220,150,${0.7 * n})`
      for (const h of this.hormigas) {
        const [x, y] = this.punto(h.t, h.carril)
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill()
      }
    }
    for (const l of this.luciernagas) {
      l.ang += (Math.random() - 0.5) * dt * 4
      l.x += (Math.cos(l.ang) * 14 * dt) / ancho
      l.y += (Math.sin(l.ang) * 10 * dt) / alto
      if (l.x < 0.02 || l.x > 0.98) l.ang = Math.PI - l.ang
      if (l.y < 0.2 || l.y > 0.9) l.ang = -l.ang
      const brillo = Math.max(0, Math.sin(this.tiempo * 2.5 + l.f)) * n
      if (brillo < 0.05) continue
      const x = l.x * ancho
      const y = l.y * alto
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9)
      g.addColorStop(0, `rgba(210,255,120,${0.9 * brillo})`)
      g.addColorStop(1, 'rgba(210,255,120,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private dibujarRastro() {
    const { ctx } = this
    // Más feromonas (prestigio) = rastro más marcado.
    const fuerza = Math.min(0.28, 0.10 + this.juego.estado.prestigio * 0.004)
    ctx.strokeStyle = `rgba(245,179,66,${fuerza})`
    ctx.lineWidth = 46
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) {
      const [x, y] = this.punto(i / 40, 0)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Camino empedrado (árbol permanente): piedrecitas fijas a lo largo del rastro.
    if (this.tiene('empedrado')) {
      ctx.fillStyle = 'rgba(190,180,160,0.45)'
      for (let i = 0; i < 60; i++) {
        const t = 0.04 + (i / 60) * 0.9
        const carril = ((i * 7919) % 36) - 18
        const [x, y] = this.punto(t, carril)
        ctx.beginPath()
        ctx.ellipse(x, y, 2.5 + (i % 3), 1.8 + (i % 2), i, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** Decorados que aparecen al comprar edificios. */
  private dibujarEdificios() {
    const { ctx, ancho, alto } = this
    const suelo = alto - 14

    // Metrópolis: torres de tierra al fondo, en las esquinas.
    const metropoli = this.n('metropoli')
    if (metropoli > 0) {
      const torres = Math.min(6, 2 + Math.floor(Math.log10(metropoli + 1) * 2))
      ctx.fillStyle = 'rgba(90,61,43,0.55)'
      for (let i = 0; i < torres; i++) {
        const lado = i % 2 === 0 ? 1 : -1
        const x = ancho * 0.5 + lado * (ancho * 0.26 + (i >> 1) * 26)
        const h = 60 + ((i * 37) % 50)
        const base = suelo - 30
        ctx.fillRect(x - 9, base - h, 18, h)
        ctx.fillStyle = 'rgba(245,179,66,0.35)'
        for (let w = 0; w < h / 14; w++) ctx.fillRect(x - 4, base - h + 8 + w * 14, 3, 4)
        ctx.fillStyle = 'rgba(90,61,43,0.55)'
      }
    }

    // Túneles: montículos secundarios unidos al nido por líneas punteadas.
    const tuneles = this.n('tunel')
    if (tuneles > 0) {
      const montes = Math.min(this.mejoras.redSubterranea ? 6 : 4, Math.ceil(Math.log10(tuneles + 1) * 2))
      ctx.setLineDash([3, 5])
      ctx.strokeStyle = 'rgba(120,85,60,0.6)'
      ctx.lineWidth = 2
      for (let i = 0; i < montes; i++) {
        const lado = i % 2 === 0 ? -1 : 1
        // Al fondo (más arriba y más pequeños), para no pisar el grano y los hongos.
        const x = ancho * 0.5 + lado * (ancho * 0.5 - 70 - (i >> 1) * 50)
        const y = suelo - 18
        ctx.beginPath()
        ctx.moveTo(ancho * 0.5, suelo - 6)
        ctx.quadraticCurveTo((ancho * 0.5 + x) / 2, y + 12, x, y)
        ctx.stroke()
        ctx.fillStyle = '#4a3122'
        ctx.beginPath()
        ctx.ellipse(x, y, 20, 7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2b1a12'
        ctx.beginPath()
        ctx.ellipse(x, y - 2, 6, 3, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.setLineDash([])
    }

    // Hormigueros aliados: pequeños nidos con banderín en los extremos.
    if (this.n('aliado') > 0) {
      for (const lado of [-1, 1]) {
        const x = ancho * 0.5 + lado * (ancho * 0.5 - 26)
        ctx.fillStyle = '#5a3d2b'
        ctx.beginPath()
        ctx.ellipse(x, suelo - 2, 20, 8, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#c9c9c9'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(x, suelo - 8); ctx.lineTo(x, suelo - 30); ctx.stroke()
        ctx.fillStyle = '#5fd38d'
        ctx.beginPath()
        ctx.moveTo(x, suelo - 30)
        ctx.lineTo(x + lado * 12, suelo - 26)
        ctx.lineTo(x, suelo - 22)
        ctx.closePath()
        ctx.fill()
      }
    }

    // Granero: montón de grano a la derecha del nido.
    const granero = this.n('granero')
    if (granero > 0) {
      const r = 10 + Math.min(14, Math.log10(granero + 1) * 7)
      ctx.fillStyle = '#c99a4a'
      ctx.beginPath()
      ctx.moveTo(ancho * 0.5 + 88 - r, suelo)
      ctx.quadraticCurveTo(ancho * 0.5 + 88, suelo - r * 1.6, ancho * 0.5 + 88 + r, suelo)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#a97b34'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.arc(ancho * 0.5 + 88 + (i - 2.5) * r * 0.3, suelo - 3 - (i % 3) * r * 0.3, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Jardín de hongos: setas a la izquierda del nido.
    const hongos = this.n('hongos')
    if (hongos > 0) {
      const setas = Math.min(5, 1 + Math.floor(Math.log10(hongos + 1) * 2))
      for (let i = 0; i < setas; i++) {
        const x = ancho * 0.5 - 84 - i * 16
        const h = 12 + ((i * 7) % 9)
        const brillo = 0.6 + 0.4 * Math.sin(this.tiempo * 2 + i)
        ctx.fillStyle = '#e8dcc8'
        ctx.fillRect(x - 2.5, suelo - h, 5, h)
        ctx.fillStyle = this.mejoras.hongosLuminosos ? `rgba(120,200,255,${brillo})` : '#c8524a'
        ctx.beginPath()
        ctx.ellipse(x, suelo - h, 9, 6, 0, Math.PI, 0)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.beginPath(); ctx.arc(x - 3, suelo - h - 2, 1.3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + 3, suelo - h - 3, 1, 0, Math.PI * 2); ctx.fill()
      }
    }

    // Cortadoras: hojas apiladas junto al nido.
    const cortadora = this.n('cortadora')
    if (cortadora > 0) {
      const hojas = Math.min(6, 1 + Math.floor(Math.log10(cortadora + 1) * 2))
      for (let i = 0; i < hojas; i++) {
        this.dibujarHoja(ancho * 0.5 + 44 + (i % 3) * 7, suelo - 3 - Math.floor(i / 3) * 4, -0.4 + i * 0.25, this.mejoras.hojasGigantes ? 8 : 6)
      }
    }
  }

  private dibujarNido() {
    const { ctx, ancho, alto } = this
    const total = this.juego.totalEdificios()
    const escala = 1 + Math.min(0.6, Math.log10(total + 1) * 0.2)
    const cx = ancho * 0.5
    const cy = alto - 20
    // Terrazas: cada colonia fundada (hasta tres) deja un anillo más alrededor del nido.
    for (let i = Math.min(3, this.vidas); i >= 1; i--) {
      ctx.fillStyle = i % 2 ? '#4e3424' : '#5a3d2b'
      ctx.beginPath()
      ctx.ellipse(cx, cy + 2 * i, (70 + 16 * i) * escala, (22 + 5 * i) * escala, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#5a3d2b'
    ctx.beginPath()
    ctx.ellipse(cx, cy, 70 * escala, 22 * escala, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6b4a35'
    ctx.beginPath()
    ctx.ellipse(cx, cy - 6 * escala, 40 * escala, 12 * escala, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b1a12'
    ctx.beginPath()
    ctx.ellipse(cx, cy - 4 * escala, 20, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    // Estandarte (árbol permanente): mástil con banderín ondeando junto a la entrada.
    if (this.tiene('estandarte')) {
      const bx = cx + 30 * escala
      const by = cy - 2 * escala
      ctx.strokeStyle = '#d8c8a8'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 34); ctx.stroke()
      const onda = Math.sin(this.tiempo * 4) * 3
      ctx.fillStyle = '#ff7a59'
      ctx.beginPath()
      ctx.moveTo(bx, by - 34)
      ctx.lineTo(bx + 18, by - 30 + onda)
      ctx.lineTo(bx, by - 24)
      ctx.closePath()
      ctx.fill()
    }

    // Jardín real (árbol permanente): flores en el borde delantero del nido y abejas de visita.
    if (this.tiene('jardin')) this.dibujarJardin(cx, cy, escala)

    // Farolillo de resina (árbol permanente): poste con luz a la izquierda de la entrada.
    if (this.tiene('faro')) {
      const fx = cx - 34 * escala
      const fy = cy - 2 * escala
      ctx.strokeStyle = '#8a6a4a'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 30); ctx.stroke()
      const brillo = 0.6 + 0.4 * this.noche() + Math.sin(this.tiempo * 6) * 0.08
      ctx.fillStyle = `rgba(255,190,80,${brillo})`
      ctx.beginPath()
      ctx.ellipse(fx, fy - 34, 5, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5a3d2b'
      ctx.fillRect(fx - 4, fy - 43, 8, 3)
    }

    // Reina secundaria: una corona corona el nido.
    if (this.n('reina') > 0) {
      const y = cy - 22 * escala
      ctx.fillStyle = '#f5b342'
      ctx.beginPath()
      ctx.moveTo(cx - 10, y)
      ctx.lineTo(cx - 10, y - 9)
      ctx.lineTo(cx - 5, y - 4)
      ctx.lineTo(cx, y - 11)
      ctx.lineTo(cx + 5, y - 4)
      ctx.lineTo(cx + 10, y - 9)
      ctx.lineTo(cx + 10, y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#ff7a59'
      ctx.beginPath(); ctx.arc(cx, y - 4, 1.8, 0, Math.PI * 2); ctx.fill()
    }
  }

  private dibujarJardin(cx: number, cy: number, escala: number) {
    const { ctx } = this
    const colores = ['#ff7a9a', '#ffd166', '#c084fc', '#ff9f43', '#f8f8f8']
    for (let i = 0; i < 10; i++) {
      const ang = 0.15 + (i / 9) * (Math.PI - 0.3) // arco delantero del nido
      const x = cx + Math.cos(ang) * (62 + (i % 2) * 8) * escala
      const y = cy + Math.sin(ang) * 18 * escala + 2
      ctx.strokeStyle = '#4f9a4f'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 9); ctx.stroke()
      ctx.fillStyle = colores[i % colores.length]
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + this.tiempo * 0.3
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * 3, y - 9 + Math.sin(a) * 3, 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#ffe066'
      ctx.beginPath(); ctx.arc(x, y - 9, 1.5, 0, Math.PI * 2); ctx.fill()
    }
    // Abejas que dan vueltas al nido
    for (const b of this.abejas) {
      b.ang += b.v * 0.016
      const x = cx + Math.cos(b.ang) * b.r * escala
      const y = cy - 30 - Math.sin(b.ang) * 18 + Math.sin(this.tiempo * 9) * 2
      ctx.fillStyle = '#f5c518'
      ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#222'
      ctx.fillRect(x - 1, y - 2.5, 1.2, 5)
      ctx.fillRect(x + 1.5, y - 2.5, 1.2, 5)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath(); ctx.ellipse(x - 1, y - 3, 3, 1.5, -0.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  /**
   * Objetivo de clic con pulso; se aplasta al hacer clic. Lo que hay arriba
   * crece con la colonia: una miga, luego una galleta y al final una tarta.
   */
  private dibujarMiga() {
    const { ctx, ancho } = this
    const pulso = 1 + Math.sin(this.tiempo * 3) * 0.03
    const sq = this.impacto * this.impacto
    const historico = this.juego.estado.historico
    ctx.save()
    ctx.translate(ancho * 0.5, 50)
    ctx.scale(pulso * (1 + 0.18 * sq), pulso * (1 - 0.22 * sq))
    // Mente colmena (mejora): aura que respira alrededor de la comida.
    if (this.mejoras.menteColmena) {
      const a = 0.12 + 0.08 * Math.sin(this.tiempo * 2)
      const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 70)
      g.addColorStop(0, `rgba(192,132,252,${a})`)
      g.addColorStop(1, 'rgba(192,132,252,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill()
    }
    // Halo al golpear
    if (sq > 0.01) {
      ctx.strokeStyle = `rgba(245,179,66,${0.5 * sq})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 44 + (1 - sq) * 30, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4
    if (historico >= 1e9) this.dibujarTarta()
    else if (historico >= 1e6) this.dibujarGalleta()
    else this.dibujarMigaSuelta()
    ctx.restore()
  }

  private dibujarMigaSuelta() {
    const { ctx } = this
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
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#b8803f'
    for (const [px, py] of [[-12, -4], [10, 2], [2, 12], [18, -10]] as const) {
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,240,200,0.35)'
    ctx.beginPath()
    ctx.moveTo(-18, -14)
    ctx.lineTo(6, -20)
    ctx.lineTo(-4, -8)
    ctx.closePath()
    ctx.fill()
  }

  private dibujarGalleta() {
    const { ctx } = this
    ctx.fillStyle = '#c98b4a'
    ctx.beginPath()
    ctx.arc(0, 0, 32, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    // Un mordisco
    ctx.fillStyle = '#3a2a1e'
    ctx.beginPath()
    ctx.arc(26, -18, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#dca065'
    ctx.beginPath()
    ctx.arc(-4, -3, 25, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4a2c1a'
    for (const [px, py] of [[-14, -8], [8, -12], [-2, 6], [14, 8], [-18, 10], [6, 20]] as const) {
      ctx.beginPath()
      ctx.ellipse(px, py, 3.5, 2.8, 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private dibujarTarta() {
    const { ctx } = this
    // Porción vista de lado: base, bizcocho, crema, bizcocho, cobertura
    ctx.fillStyle = '#e8c27a'
    ctx.beginPath()
    ctx.moveTo(-36, 22)
    ctx.lineTo(36, 22)
    ctx.lineTo(36, -6)
    ctx.lineTo(0, -30)
    ctx.lineTo(-36, -6)
    ctx.closePath()
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#f7e6ee'
    ctx.fillRect(-36, 2, 72, 6)
    ctx.fillStyle = '#c0392b'
    ctx.beginPath()
    ctx.moveTo(-36, -6)
    ctx.lineTo(0, -30)
    ctx.lineTo(36, -6)
    ctx.lineTo(36, -2)
    ctx.lineTo(0, -26)
    ctx.lineTo(-36, -2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#b22222'
    ctx.beginPath()
    ctx.arc(0, -32, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(-2, -34, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  private dibujarHoja(x: number, y: number, ang: number, r: number) {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.fillStyle = '#5fb55f'
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2f7a2f'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke()
    ctx.restore()
  }

  private dibujarHormiga(x: number, y: number, ang: number, carga: 'miga' | 'hoja' | null, fase: number) {
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
    // antenas
    ctx.beginPath()
    ctx.moveTo(5, -1); ctx.lineTo(8, -3.5)
    ctx.moveTo(5, 1); ctx.lineTo(8, 3.5)
    ctx.stroke()
    if (carga === 'miga') {
      ctx.fillStyle = '#e7b86e'
      ctx.beginPath()
      ctx.arc(7, 0, 2.6, 0, Math.PI * 2)
      ctx.fill()
    } else if (carga === 'hoja') {
      this.dibujarHoja(8, 0, Math.PI / 2 + Math.sin(fase) * 0.2, this.mejoras.hojasGigantes ? 7 : 5)
    }
    ctx.restore()
  }
}
