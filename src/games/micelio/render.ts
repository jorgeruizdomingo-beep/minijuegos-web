/**
 * Escena en canvas: bajo tierra crece una red de hifas; en la superficie brotan
 * setas, anillos de hadas y árboles según la cadena. También gestiona el evento
 * de lluvia: una nube que, si se pincha, multiplica la producción un rato.
 */
import type { Escena } from '../../core/arranque'
import { toast } from '../../core/arranque'
import { sonidos } from '../../core/sonido'
import type { Incremental } from '../../core/incremental'
import { LLUVIA } from './data'

type Segmento = { x1: number; y1: number; x2: number; y2: number; nivel: number; nace: number }
type Pulso = { seg: number; t: number; v: number }
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; color: string }
type Gota = { x: number; y: number; v: number }

const MAX_SEGMENTOS = 420
const MAX_PULSOS = 60

// Los recuentos crecen sin límite: la escena usa su logaritmo para no saturarse.
const escala = (n: number) => Math.log2(1 + Math.max(0, n))

export class EscenaMicelio implements Escena {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private juego: Incremental
  private ancho = 0
  private alto = 0
  private dpr = 1
  private tiempo = 0
  // La red se guarda en coordenadas normalizadas [0,1] para sobrevivir a los cambios de tamaño.
  private segmentos: Segmento[] = []
  private puntas: number[] = [] // índices de segmentos desde los que se puede seguir creciendo
  private pulsos: Pulso[] = []
  private particulas: Particula[] = []
  private gotas: Gota[] = []
  private lluvia: { fase: 'espera' | 'nube' | 'lloviendo'; resta: number; x: number; rocio: boolean } = {
    fase: 'espera',
    resta: LLUVIA.esperaMinSeg,
    x: 0.5,
    rocio: false,
  }
  // Aspecto del mapa: lo fija cambio() a partir de eslabones, mejoras, nodos del árbol y esporas.
  private aspecto = {
    luz: false, // nodo Bioluminiscencia
    flores: false, // nodo Claro de flores
    arbolMadre: false, // nodo Árbol madre
    nubeLarga: false,
    rocio: false,
    lluviaDoble: false,
    grosor: 0, // mejoras de hifa compradas (0-3): raíces más gruesas
    setaGrande: 0, // mejoras de seta compradas (0-3)
    anilloDoble: false, // mejora 'Anillo de anillos'
    bosqueDenso: false, // mejora 'Bosque primario'
    estrellas: 0, // esporas: el cielo se llena de estrellas
    aurora: false, // 10 esporas o más
  }

  constructor(canvas: HTMLCanvasElement, juego: Incremental) {
    this.canvas = canvas
    this.juego = juego
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

  private get suelo() {
    return this.alto * 0.36
  }

  // Al estrenar un eslabón, una sola vez por navegador, se explica qué hace para el de abajo.
  private static CLAVE_AVISOS = 'vjw:micelio:avisos'
  private avisoCadena() {
    let vistos: string[] = []
    try {
      vistos = JSON.parse(localStorage.getItem(EscenaMicelio.CLAVE_AVISOS) ?? '[]')
    } catch {
      vistos = []
    }
    const avisos: Record<string, string> = {
      micelio: '🕸️ El micelio teje hifas solas: mira cómo sube el contador de 🧵 sin comprarlas.',
      seta: '🍄 Cada seta extiende micelio, y ese micelio teje más hifas: la cadena se acelera.',
      anillo: '⭕ Los anillos abren setas nuevas. Comprar arriba tarda en notarse, pero multiplica todo lo de abajo.',
      bosque: '🌳 Los bosques brotan anillos. Desde aquí el crecimiento ya es imparable.',
      red: '🌐 La red de raíces conecta bosques. Es el último eslabón: ahora toca soltar esporas y cosechar trufas.',
    }
    for (const id of Object.keys(avisos)) {
      if (vistos.includes(id) || this.juego.compradas(id) < 1) continue
      vistos.push(id)
      toast(avisos[id], 7000)
      try {
        localStorage.setItem(EscenaMicelio.CLAVE_AVISOS, JSON.stringify(vistos))
      } catch {
        // sin almacenamiento: se repetirá, no pasa nada
      }
      break // uno por compra, para no apilar avisos
    }
  }

  /** El motor lo llama tras cargar, comprar, coger un nodo o soltar esporas. */
  cambio(motivo: 'carga' | 'edificio' | 'mejora' | 'nodo' | 'prestigio' = 'carga') {
    const j = this.juego
    const a = this.aspecto
    if (motivo === 'edificio') this.avisoCadena()
    a.luz = j.tieneDesbloqueo('luz')
    a.flores = j.tieneDesbloqueo('flores')
    a.arbolMadre = j.tieneNodo('arbol_madre')
    a.nubeLarga = j.tieneDesbloqueo('nube_larga')
    a.rocio = j.tieneDesbloqueo('rocio')
    a.lluviaDoble = j.tieneDesbloqueo('lluvia_doble')
    a.grosor = ['hifa_1', 'hifa_2', 'hifa_3'].filter((id) => j.tieneMejora(id)).length
    a.setaGrande = ['seta_1', 'seta_2', 'seta_3'].filter((id) => j.tieneMejora(id)).length
    a.anilloDoble = j.tieneMejora('anillo_3')
    a.bosqueDenso = j.tieneMejora('bosque_3')
    a.estrellas = Math.min(80, j.estado.prestigio * 4)
    a.aurora = j.estado.prestigio >= 10
  }

  /** La red sigue a las hifas y al micelio; el total de edificios no se usa. */
  poblacion(_n: number) {
    const j = this.juego
    const objetivo = Math.min(MAX_SEGMENTOS, Math.floor(escala(j.cantidad('hifa')) * 14 + escala(j.cantidad('micelio')) * 10))
    if (objetivo < this.segmentos.length) {
      // Tras soltar esporas la red vuelve a empezar.
      this.segmentos = []
      this.puntas = []
      this.pulsos = []
    }
    // Crece unos pocos segmentos por fotograma para que se vea brotar.
    for (let k = 0; k < 3 && this.segmentos.length < objetivo; k++) this.crecer()
  }

  private crecer() {
    const sueloN = 0.36
    if (this.segmentos.length === 0 || this.puntas.length === 0 || Math.random() < 0.04) {
      // Nueva raíz desde la superficie, cerca del centro.
      const x = 0.5 + (Math.random() - 0.5) * 0.5 * Math.min(1, 0.3 + this.segmentos.length / 120)
      this.anadir(x, sueloN, Math.PI / 2 + (Math.random() - 0.5) * 0.8, 0)
      return
    }
    const i = this.puntas[Math.floor(Math.random() * this.puntas.length)]
    const s = this.segmentos[i]
    const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) + (Math.random() - 0.5) * 1.3
    this.anadir(s.x2, s.y2, ang, s.nivel + 1)
    // Las puntas se ramifican: a veces la punta original deja de crecer.
    if (Math.random() < 0.45) this.puntas.splice(this.puntas.indexOf(i), 1)
  }

  private anadir(x: number, y: number, ang: number, nivel: number) {
    const largo = 0.03 + Math.random() * 0.045
    let x2 = x + Math.cos(ang) * largo
    let y2 = y + Math.sin(ang) * largo * 1.4
    x2 = Math.min(0.98, Math.max(0.02, x2))
    y2 = Math.min(0.98, Math.max(0.38, y2))
    this.segmentos.push({ x1: x, y1: y, x2, y2, nivel, nace: this.tiempo })
    this.puntas.push(this.segmentos.length - 1)
  }

  clic(x: number, y: number) {
    // ¿Ha pinchado la nube?
    if (this.lluvia.fase === 'nube') {
      const cx = this.lluvia.x * this.ancho
      const cy = this.alto * 0.12 + 6
      if (Math.hypot(x - cx, y - cy) < 64) {
        this.empezarLluvia()
        return
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 40 + Math.random() * 90
      this.particulas.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, vida: 0.8 + Math.random() * 0.4, color: '#c8f7a8' })
    }
    // Un clic manda un pulso por la red.
    if (this.segmentos.length) this.pulsos.push({ seg: Math.floor(Math.random() * this.segmentos.length), t: 0, v: 2.5 })
  }

  // Parámetros de la lluvia según las mejoras compradas.
  private get visibleSeg() {
    const base = this.juego.tieneMejora('lluvia_1') ? LLUVIA.visibleSegMejorada : LLUVIA.visibleSeg
    return this.aspecto.nubeLarga ? base * 2 : base
  }
  private get duracionSeg() {
    const base = this.juego.tieneMejora('lluvia_2') ? LLUVIA.duracionSegMejorada : LLUVIA.duracionSeg
    return this.aspecto.lluviaDoble ? base * 2 : base
  }
  private get multLluvia() {
    return this.juego.tieneMejora('lluvia_3') ? LLUVIA.multMejorado : LLUVIA.mult
  }

  private empezarLluvia(rocio = false) {
    this.lluvia.fase = 'lloviendo'
    this.lluvia.rocio = rocio
    this.lluvia.resta = this.duracionSeg
    // El rocío (nodo del árbol) da la mitad del bonus sin pinchar la nube.
    const mult = rocio ? 1 + (this.multLluvia - 1) / 2 : this.multLluvia
    this.juego.multiplicadorTemporal = mult
    if (!rocio) sonidos.mejora()
    toast(rocio ? `💧 Rocío: producción x${mult} durante ${this.duracionSeg} s` : `🌧️ ¡Lluvia! Producción x${mult} durante ${this.duracionSeg} s`, 3000)
  }

  private actualizarLluvia(dt: number) {
    const l = this.lluvia
    l.resta -= dt
    if (l.resta > 0) return
    if (l.fase === 'espera') {
      l.fase = 'nube'
      l.resta = this.visibleSeg
      l.x = 0.2 + Math.random() * 0.6
    } else if (l.fase === 'nube' && this.aspecto.rocio) {
      // La nube se va sin pincharla, pero con Rocío llueve igual, a media fuerza.
      this.empezarLluvia(true)
      return
    } else {
      // La nube se va (sin pinchar) o la lluvia termina: vuelta a esperar.
      if (l.fase === 'lloviendo') this.juego.multiplicadorTemporal = 1
      l.fase = 'espera'
      l.resta = LLUVIA.esperaMinSeg + Math.random() * (LLUVIA.esperaMaxSeg - LLUVIA.esperaMinSeg)
    }
  }

  frame(dt: number) {
    this.tiempo += dt
    this.actualizarLluvia(dt)
    const { ctx, ancho, alto } = this
    const suelo = this.suelo
    const j = this.juego
    ctx.clearRect(0, 0, ancho, alto)

    // Cielo de bosque al anochecer y tierra.
    const cielo = ctx.createLinearGradient(0, 0, 0, suelo)
    const lloviendo = this.lluvia.fase === 'lloviendo'
    cielo.addColorStop(0, lloviendo ? '#1b2330' : '#1a2b2a')
    cielo.addColorStop(1, lloviendo ? '#26333a' : '#2b3b2e')
    ctx.fillStyle = cielo
    ctx.fillRect(0, 0, ancho, suelo)
    this.dibujarCielo()
    const tierra = ctx.createLinearGradient(0, suelo, 0, alto)
    tierra.addColorStop(0, '#3a2b1f')
    tierra.addColorStop(1, '#140f0b')
    ctx.fillStyle = tierra
    ctx.fillRect(0, suelo, ancho, alto - suelo)

    this.dibujarBosque(j)
    this.dibujarRed(dt, j)

    // Hierba sobre la línea del suelo.
    ctx.strokeStyle = '#4f7a3a'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x < ancho; x += 7) {
      const h = 4 + ((x * 13) % 7)
      ctx.moveTo(x, suelo + 1)
      ctx.lineTo(x + Math.sin(this.tiempo * 1.5 + x) * 1.5, suelo - h)
    }
    ctx.stroke()

    this.dibujarSetas(j)
    this.dibujarLluvia(dt)

    // Partículas de esporas del clic.
    this.particulas = this.particulas.filter((p) => p.vida > 0)
    for (const p of this.particulas) {
      p.vida -= dt
      p.vy += 60 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida))
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /** Estrellas por cada espora y una aurora a partir de diez: el cielo cuenta las vidas. */
  private dibujarCielo() {
    const { ctx, ancho } = this
    const a = this.aspecto
    const suelo = this.suelo
    if (a.aurora) {
      const g = ctx.createLinearGradient(0, 0, ancho, suelo * 0.5)
      const f = this.tiempo * 0.3
      g.addColorStop(0, `rgba(80, 220, 160, ${0.08 + 0.05 * Math.sin(f)})`)
      g.addColorStop(0.5, `rgba(120, 120, 255, ${0.1 + 0.05 * Math.sin(f + 2)})`)
      g.addColorStop(1, `rgba(80, 220, 160, ${0.08 + 0.05 * Math.sin(f + 4)})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, ancho, suelo * 0.6)
    }
    ctx.fillStyle = '#fff6d5'
    for (let i = 0; i < a.estrellas; i++) {
      const x = ((i * 0.618 + 0.05) % 1) * ancho
      const y = ((i * 0.7548776662 + 0.1) % 1) * suelo * 0.55 // constante distinta a la de x para que no formen una línea
      const parpadeo = 0.5 + 0.5 * Math.sin(this.tiempo * 2 + i)
      ctx.globalAlpha = 0.4 + 0.6 * parpadeo
      ctx.fillRect(x, y, 2, 2)
    }
    ctx.globalAlpha = 1
  }

  private dibujarRed(dt: number, j: Incremental) {
    const { ctx, ancho, alto } = this
    const a = this.aspecto
    const brillo = Math.min(1, 0.35 + escala(j.cantidad('micelio')) / 14) * (a.luz ? 1.3 : 1)
    ctx.lineCap = 'round'
    for (const s of this.segmentos) {
      const edad = Math.min(1, (this.tiempo - s.nace) / 0.6)
      const x2 = s.x1 + (s.x2 - s.x1) * edad
      const y2 = s.y1 + (s.y2 - s.y1) * edad
      ctx.strokeStyle = a.luz
        ? `rgba(200, 240, 220, ${Math.min(1, (0.75 - Math.min(0.45, s.nivel * 0.04)) * brillo)})`
        : `rgba(232, 226, 200, ${(0.75 - Math.min(0.45, s.nivel * 0.04)) * brillo})`
      // Las mejoras de hifa engordan las raíces.
      ctx.lineWidth = Math.max(0.8, 2.6 + a.grosor * 0.7 - s.nivel * 0.25)
      ctx.beginPath()
      ctx.moveTo(s.x1 * ancho, s.y1 * alto)
      ctx.lineTo(x2 * ancho, y2 * alto)
      ctx.stroke()
    }

    // Pulsos de nutrientes recorriendo la red: más producción, más pulsos.
    const objetivo = Math.min(MAX_PULSOS, Math.floor(escala(j.produccionTotal()) * 2.5))
    if (this.segmentos.length && this.pulsos.length < objetivo && Math.random() < 0.3) {
      this.pulsos.push({ seg: Math.floor(Math.random() * this.segmentos.length), t: 0, v: 1 + Math.random() })
    }
    ctx.fillStyle = this.lluvia.fase === 'lloviendo' ? '#8fd3ff' : a.luz ? '#b7ffe0' : '#d6ff8f'
    if (a.luz) {
      ctx.shadowColor = '#b7ffe0'
      ctx.shadowBlur = 8
    }
    this.pulsos = this.pulsos.filter((p) => p.t < 1 && p.seg < this.segmentos.length)
    for (const p of this.pulsos) {
      p.t += p.v * dt
      const s = this.segmentos[p.seg]
      // Van hacia la superficie: del extremo al origen del segmento.
      const x = (s.x2 + (s.x1 - s.x2) * p.t) * ancho
      const y = (s.y2 + (s.y1 - s.y2) * p.t) * alto
      ctx.globalAlpha = Math.sin(p.t * Math.PI)
      ctx.beginPath()
      ctx.arc(x, y, a.luz ? 3 : 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  private dibujarBosque(j: Incremental) {
    const { ctx, ancho } = this
    const suelo = this.suelo
    const a = this.aspecto
    const arboles = Math.min(a.bosqueDenso ? 11 : 7, Math.ceil(escala(j.cantidad('bosque')) * 1.5))
    const posiciones: number[] = []
    if (a.arbolMadre) {
      // Árbol madre en el centro: tronco ancho y tres pisos de copa.
      const x = ancho * 0.5
      const h = suelo * 0.95
      ctx.fillStyle = '#4a3523'
      ctx.fillRect(x - 9, suelo - h * 0.5, 18, h * 0.5)
      for (const [k, c] of [[1, '#1f4a2a'], [0.72, '#27573a'], [0.45, '#2f6b45']] as const) {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.moveTo(x, suelo - h * (0.35 + 0.65 * (1 - k) + k * 0.65))
        ctx.lineTo(x - h * 0.38 * k, suelo - h * 0.35 * (1 - k) - h * 0.1)
        ctx.lineTo(x + h * 0.38 * k, suelo - h * 0.35 * (1 - k) - h * 0.1)
        ctx.closePath()
        ctx.fill()
      }
    }
    for (let i = 0; i < arboles; i++) {
      const x = ((i * 0.618 + 0.09) % 1) * ancho
      posiciones.push(x)
      const h = suelo * (0.55 + ((i * 37) % 10) / 30)
      ctx.fillStyle = '#3b2a1c'
      ctx.fillRect(x - 4, suelo - h * 0.45, 8, h * 0.45)
      ctx.fillStyle = i % 2 ? '#24452c' : '#2c5233'
      ctx.beginPath()
      ctx.moveTo(x, suelo - h)
      ctx.lineTo(x - h * 0.28, suelo - h * 0.35)
      ctx.lineTo(x + h * 0.28, suelo - h * 0.35)
      ctx.closePath()
      ctx.fill()
    }
    // Red de raíces: hilos luminosos que unen los árboles por debajo del suelo.
    if (j.cantidad('red') >= 1 && posiciones.length > 1) {
      ctx.strokeStyle = `rgba(143, 211, 255, ${0.25 + 0.15 * Math.sin(this.tiempo * 2)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < posiciones.length - 1; i++) {
        const a = posiciones[i]
        const b = posiciones[i + 1]
        ctx.moveTo(a, suelo + 4)
        ctx.quadraticCurveTo((a + b) / 2, suelo + 40, b, suelo + 4)
      }
      ctx.stroke()
    }
  }

  private dibujarSetas(j: Incremental) {
    const suelo = this.suelo
    const asp = this.aspecto
    const setas = Math.min(16, Math.ceil(escala(j.cantidad('seta')) * 2))
    for (let i = 0; i < setas; i++) {
      const x = ((i * 0.382 + 0.17) % 1) * this.ancho
      // Las mejoras de seta las hacen más grandes.
      this.seta(x, suelo, (0.8 + ((i * 7) % 5) / 8) * (1 + asp.setaGrande * 0.2), i % 3 === 0 ? '#c0392b' : '#c9a36b')
    }
    // Flores (nodo del árbol) entre las setas.
    if (asp.flores) {
      for (let i = 0; i < 14; i++) {
        const x = ((i * 0.236 + 0.05) % 1) * this.ancho
        const osc = Math.sin(this.tiempo * 1.5 + i) * 1.5
        this.ctx.strokeStyle = '#4f7a3a'
        this.ctx.lineWidth = 1.2
        this.ctx.beginPath()
        this.ctx.moveTo(x, suelo)
        this.ctx.lineTo(x + osc, suelo - 11)
        this.ctx.stroke()
        this.ctx.fillStyle = i % 3 === 0 ? '#ff8fb1' : i % 3 === 1 ? '#ffd166' : '#c9a7ff'
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * Math.PI * 2
          this.ctx.beginPath()
          this.ctx.arc(x + osc + Math.cos(ang) * 2.6, suelo - 12 + Math.sin(ang) * 2.6, 1.6, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }
    }
    // Anillos de hadas: círculos de setas pequeñas; 'Anillo de anillos' añade un círculo exterior.
    const anillos = Math.min(4, Math.ceil(escala(j.cantidad('anillo'))))
    for (let a = 0; a < anillos; a++) {
      const cx = ((a * 0.27 + 0.62) % 1) * this.ancho
      for (let k = 0; k < 9; k++) {
        const ang = (k / 9) * Math.PI * 2
        this.seta(cx + Math.cos(ang) * 26, suelo - 2 + Math.sin(ang) * 6, 0.45, '#e8d9b5')
        if (asp.anilloDoble) this.seta(cx + Math.cos(ang + 0.35) * 42, suelo - 2 + Math.sin(ang + 0.35) * 9, 0.35, '#f3ead3')
      }
    }
  }

  private seta(x: number, base: number, s: number, color: string) {
    const { ctx } = this
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(x - 2.5 * s, base - 14 * s, 5 * s, 14 * s)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(x, base - 14 * s, 11 * s, 7 * s, 0, Math.PI, 0)
    ctx.fill()
  }

  private dibujarLluvia(dt: number) {
    const { ctx, ancho, alto } = this
    const l = this.lluvia
    if (l.fase === 'nube') {
      const cx = l.x * ancho
      const cy = alto * 0.12 + Math.sin(this.tiempo * 2) * 3
      const pulso = 1 + Math.sin(this.tiempo * 5) * 0.06
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(pulso, pulso)
      ctx.fillStyle = '#d7dee8'
      for (const [dx, dy, r] of [[-22, 6, 16], [0, -4, 22], [22, 6, 16], [8, 10, 14], [-10, 10, 14]] as const) {
        ctx.beginPath()
        ctx.arc(dx, dy, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      // Anillo que se vacía: cuánto queda antes de que la nube se vaya.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, cy + 2, 34, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(1, l.resta / this.visibleSeg)))
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`¡Pínchala! x${this.multLluvia}`, cx, cy + 52)
    }
    if (l.fase === 'lloviendo') {
      while (this.gotas.length < 90) this.gotas.push({ x: Math.random() * ancho, y: Math.random() * alto, v: 300 + Math.random() * 200 })
    }
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const g of this.gotas) {
      g.y += g.v * dt
      ctx.moveTo(g.x, g.y)
      ctx.lineTo(g.x - 2, g.y - 9)
    }
    ctx.stroke()
    // Las gotas que llegan al suelo vuelven arriba mientras llueve; al parar, desaparecen.
    for (const g of this.gotas) {
      if (g.y > this.suelo + 20 && l.fase === 'lloviendo') {
        g.y = -10
        g.x = Math.random() * ancho
      }
    }
    this.gotas = this.gotas.filter((g) => g.y <= this.suelo + 20)
    if (l.fase === 'lloviendo') {
      ctx.fillStyle = '#8fd3ff'
      ctx.font = '700 13px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${l.rocio ? '💧 Rocío' : '🌧️ Lluvia'} x${this.juego.multiplicadorTemporal} · ${Math.ceil(l.resta)} s`, 10, 20)
    } else if (l.fase === 'espera') {
      // Cuenta atrás discreta: saber cuándo mirar es parte del juego.
      const s = Math.max(0, Math.ceil(l.resta))
      ctx.fillStyle = 'rgba(215, 222, 232, 0.55)'
      ctx.font = '600 12px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`☁️ nube en ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 10, 20)
    }
  }
}
