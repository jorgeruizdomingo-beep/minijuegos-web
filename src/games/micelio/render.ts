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

type Segmento = { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; nivel: number; nace: number; lado: number; raiz: number }
type Hilo = { x: number; y: number; ang: number; largo: number; fase: number; nace: number }
type Pulso = { seg: number; t: number; v: number }
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; color: string }
type Gota = { x: number; y: number; v: number }

const MAX_SEGMENTOS = 420
const MAX_HILOS = 320
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
  private hilos: Hilo[] = [] // pelusa de micelio alrededor de las raíces
  private raices = 0 // raíces nacidas desde la superficie, para repartirlas por el ancho
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
    const objetivo = Math.min(MAX_SEGMENTOS, Math.floor(escala(j.cantidad('hifa')) * 14 + escala(j.cantidad('micelio')) * 6))
    if (objetivo < this.segmentos.length) {
      // Tras soltar esporas la red vuelve a empezar.
      this.segmentos = []
      this.puntas = []
      this.pulsos = []
      this.hilos = []
      this.raices = 0
    }
    // Crece unos pocos segmentos por fotograma para que se vea brotar.
    for (let k = 0; k < 3 && this.segmentos.length < objetivo; k++) this.crecer()
    // El micelio es una pelusa blanca que envuelve las raíces: tantos hilos como micelio haya.
    const hilosObjetivo = this.segmentos.length ? Math.min(MAX_HILOS, Math.floor(escala(j.cantidad('micelio')) * 24)) : 0
    if (hilosObjetivo < this.hilos.length) this.hilos.length = hilosObjetivo
    for (let k = 0; k < 6 && this.hilos.length < hilosObjetivo; k++) this.tejer()
  }

  private crecer() {
    const sueloN = 0.36
    if (this.segmentos.length === 0 || this.puntas.length === 0 || Math.random() < 0.05) {
      // Nueva raíz desde la superficie. Se reparten por todo el ancho: la primera en el
      // centro y las siguientes alternando a ambos lados (secuencia áurea).
      const k = this.raices++
      const x = 0.1 + 0.8 * ((k * 0.618 + 0.5) % 1)
      this.anadir(x, sueloN, Math.PI / 2 + (Math.random() - 0.5) * 0.5, 0, k % 2 ? 1 : -1, k)
      return
    }
    // Primero se elige una raíz al azar y luego una de sus puntas: así todas crecen parejas
    // y ninguna acapara la red por tener más puntas.
    const raiz = Math.floor(Math.random() * this.raices)
    const suyas = this.puntas.filter((k) => this.segmentos[k].raiz === raiz)
    const i = suyas.length ? suyas[Math.floor(Math.random() * suyas.length)] : this.puntas[Math.floor(Math.random() * this.puntas.length)]
    const s = this.segmentos[i]
    const base = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
    // Cada ramificación sale hacia el lado contrario de la anterior, y todas tienden a
    // volver a la vertical: así ningún lado se queda sin raíces.
    const lado = -s.lado
    let ang = base + lado * (0.35 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.3
    ang += (Math.PI / 2 - ang) * 0.12
    ang = Math.max(Math.PI / 2 - 1.35, Math.min(Math.PI / 2 + 1.35, ang))
    this.anadir(s.x2, s.y2, ang, s.nivel + 1, lado, s.raiz)
    // Las puntas se ramifican: a veces la punta original deja de crecer.
    if (Math.random() < 0.45) this.puntas.splice(this.puntas.indexOf(i), 1)
  }

  private anadir(x: number, y: number, ang: number, nivel: number, lado: number, raiz: number) {
    const largo = 0.03 + Math.random() * 0.045
    let x2 = x + Math.cos(ang) * largo
    let y2 = y + Math.sin(ang) * largo * 1.15
    x2 = Math.min(0.98, Math.max(0.02, x2))
    y2 = Math.min(0.97, Math.max(0.38, y2))
    // Punto de control a un lado del segmento: las raíces se curvan en vez de ir rectas.
    const nx = -(y2 - y)
    const ny = x2 - x
    const curva = (Math.random() - 0.5) * 0.5
    this.segmentos.push({ x1: x, y1: y, x2, y2, cx: (x + x2) / 2 + nx * curva, cy: (y + y2) / 2 + ny * curva, nivel, nace: this.tiempo, lado, raiz })
    const i = this.segmentos.length - 1
    // Al llegar al fondo o a un borde, la punta deja de crecer.
    if (y2 < 0.96 && x2 > 0.03 && x2 < 0.97) this.puntas.push(i)
  }

  /** Un hilo de micelio nace pegado a una raíz y se queda temblando a su alrededor. */
  private tejer() {
    const s = this.segmentos[Math.floor(Math.random() * this.segmentos.length)]
    const t = Math.random()
    const x = s.x1 + (s.x2 - s.x1) * t + (Math.random() - 0.5) * 0.03
    const y = s.y1 + (s.y2 - s.y1) * t + (Math.random() - 0.5) * 0.03
    this.hilos.push({ x, y: Math.max(0.37, y), ang: Math.random() * Math.PI * 2, largo: 0.012 + Math.random() * 0.025, fase: Math.random() * Math.PI * 2, nace: this.tiempo })
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
    this.dibujarTierra()

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

  /** Tierra con piedrecitas y una franja oscura bajo la hierba. */
  private dibujarTierra() {
    const { ctx, ancho, alto } = this
    const suelo = this.suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
    for (let i = 0; i < 70; i++) {
      const x = ((i * 0.618 + 0.13) % 1) * ancho
      const y = suelo + 12 + ((i * 0.7548776662 + 0.31) % 1) * (alto - suelo - 16)
      const r = 1.5 + ((i * 7) % 4)
      ctx.beginPath()
      ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    const franja = ctx.createLinearGradient(0, suelo, 0, suelo + 22)
    franja.addColorStop(0, 'rgba(20, 12, 6, 0.55)')
    franja.addColorStop(1, 'rgba(20, 12, 6, 0)')
    ctx.fillStyle = franja
    ctx.fillRect(0, suelo, ancho, 22)
  }

  private dibujarRed(dt: number, j: Incremental) {
    const { ctx, ancho, alto } = this
    const a = this.aspecto
    const brillo = Math.min(1, 0.45 + escala(j.cantidad('micelio')) / 16) * (a.luz ? 1.25 : 1)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // Dos pasadas: una sombra oscura y ancha debajo y la raíz clara encima, para que
    // destaque sobre la tierra; las mejoras de hifa engordan las raíces.
    for (const pasada of [0, 1]) {
      for (const s of this.segmentos) {
        const edad = Math.min(1, (this.tiempo - s.nace) / 0.6)
        const grosor = Math.max(0.7, (2.8 + a.grosor * 0.5) * Math.pow(0.86, s.nivel))
        if (pasada === 0) {
          ctx.strokeStyle = 'rgba(10, 6, 3, 0.45)'
          ctx.lineWidth = grosor + 2.2
        } else {
          const alfa = (0.95 - Math.min(0.45, s.nivel * 0.035)) * brillo
          ctx.strokeStyle = a.luz ? `rgba(205, 245, 225, ${Math.min(1, alfa)})` : `rgba(236, 226, 196, ${alfa})`
          ctx.lineWidth = grosor
        }
        ctx.beginPath()
        ctx.moveTo(s.x1 * ancho, s.y1 * alto)
        if (edad < 1) {
          ctx.lineTo((s.x1 + (s.x2 - s.x1) * edad) * ancho, (s.y1 + (s.y2 - s.y1) * edad) * alto)
        } else {
          ctx.quadraticCurveTo(s.cx * ancho, s.cy * alto, s.x2 * ancho, s.y2 * alto)
        }
        ctx.stroke()
      }
    }

    // Micelio: un halo blanco y suave alrededor de las raíces, más denso cuanto más micelio,
    // y filamentos finos y curvos que salen de ellas.
    if (this.hilos.length) {
      const densidad = Math.min(1, this.hilos.length / MAX_HILOS)
      ctx.strokeStyle = a.luz ? `rgba(200, 255, 235, ${0.05 + 0.1 * densidad})` : `rgba(255, 252, 240, ${0.05 + 0.1 * densidad})`
      ctx.lineWidth = 9 + 9 * densidad
      ctx.beginPath()
      for (const s of this.segmentos) {
        if (this.tiempo - s.nace < 0.6) continue
        ctx.moveTo(s.x1 * ancho, s.y1 * alto)
        ctx.quadraticCurveTo(s.cx * ancho, s.cy * alto, s.x2 * ancho, s.y2 * alto)
      }
      ctx.stroke()
      ctx.lineWidth = 0.8
      ctx.strokeStyle = a.luz ? 'rgba(220, 255, 240, 0.5)' : 'rgba(250, 248, 240, 0.45)'
      ctx.beginPath()
      for (const h of this.hilos) {
        const edad = Math.min(1, (this.tiempo - h.nace) / 0.8)
        const ang = h.ang + Math.sin(this.tiempo * 1.2 + h.fase) * 0.15
        const l = h.largo * edad
        const x0 = h.x * ancho
        const y0 = h.y * alto
        const x1 = (h.x + Math.cos(ang) * l) * ancho
        const y1 = (h.y + Math.sin(ang) * l) * alto
        // Curva suave: el punto de control se desvía a un lado.
        const cx = (x0 + x1) / 2 - (y1 - y0) * 0.35
        const cy = (y0 + y1) / 2 + (x1 - x0) * 0.35
        ctx.moveTo(x0, y0)
        ctx.quadraticCurveTo(cx, cy, x1, y1)
      }
      ctx.stroke()
      // Pequeñas perlas en las puntas de algunos filamentos.
      ctx.fillStyle = a.luz ? 'rgba(220, 255, 240, 0.8)' : 'rgba(255, 253, 245, 0.7)'
      for (let i = 0; i < this.hilos.length; i += 4) {
        const h = this.hilos[i]
        const ang = h.ang + Math.sin(this.tiempo * 1.2 + h.fase) * 0.15
        ctx.beginPath()
        ctx.arc((h.x + Math.cos(ang) * h.largo) * ancho, (h.y + Math.sin(ang) * h.largo) * alto, 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Pulsos de nutrientes recorriendo la red: más producción, más pulsos.
    const objetivo = Math.min(MAX_PULSOS, Math.floor(escala(j.produccionTotal()) * 2.5))
    if (this.segmentos.length && this.pulsos.length < objetivo && Math.random() < 0.3) {
      this.pulsos.push({ seg: Math.floor(Math.random() * this.segmentos.length), t: 0, v: 1 + Math.random() })
    }
    ctx.fillStyle = this.lluvia.fase === 'lloviendo' ? '#8fd3ff' : a.luz ? '#b7ffe0' : '#d6ff8f'
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = a.luz ? 10 : 6
    this.pulsos = this.pulsos.filter((p) => p.t < 1 && p.seg < this.segmentos.length)
    for (const p of this.pulsos) {
      p.t += p.v * dt
      const s = this.segmentos[p.seg]
      // Van hacia la superficie: del extremo al origen del segmento, siguiendo la curva.
      const u = 1 - p.t
      const x = ((1 - u) * (1 - u) * s.x1 + 2 * (1 - u) * u * s.cx + u * u * s.x2) * ancho
      const y = ((1 - u) * (1 - u) * s.y1 + 2 * (1 - u) * u * s.cy + u * u * s.y2) * alto
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
    if (a.arbolMadre) this.arbol(ancho * 0.5, suelo * 0.95, 18, ['#1f4a2a', '#27573a', '#2f6b45'])
    for (let i = 0; i < arboles; i++) {
      const x = ((i * 0.618 + 0.09) % 1) * ancho
      posiciones.push(x)
      const h = suelo * (0.55 + ((i * 37) % 10) / 30)
      this.arbol(x, h, 8, i % 2 ? ['#1d3a24', '#24452c', '#2c5233'] : ['#223f28', '#2a4f32', '#33603b'])
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

  /** Abeto de tres pisos con tronco sombreado y un lado de la copa más claro. */
  private arbol(x: number, h: number, tronco: number, verdes: readonly [string, string, string]) {
    const { ctx } = this
    const suelo = this.suelo
    ctx.fillStyle = '#3b2a1c'
    ctx.fillRect(x - tronco / 2, suelo - h * 0.5, tronco, h * 0.5)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(x + tronco / 6, suelo - h * 0.5, tronco / 3, h * 0.5)
    const pisos = [
      [1, 0.38],
      [0.72, 0.3],
      [0.45, 0.22],
    ] as const
    pisos.forEach(([k, ancho], n) => {
      const cima = suelo - h * (0.35 + 0.65 * (1 - k) + k * 0.65)
      const base = suelo - h * 0.35 * (1 - k) - h * 0.1
      ctx.fillStyle = verdes[n]
      ctx.beginPath()
      ctx.moveTo(x, cima)
      ctx.lineTo(x - h * ancho * k, base)
      ctx.lineTo(x + h * ancho * k, base)
      ctx.closePath()
      ctx.fill()
      // Lado iluminado.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
      ctx.beginPath()
      ctx.moveTo(x, cima)
      ctx.lineTo(x - h * ancho * k, base)
      ctx.lineTo(x, base)
      ctx.closePath()
      ctx.fill()
    })
  }

  private dibujarSetas(j: Incremental) {
    const suelo = this.suelo
    const asp = this.aspecto
    const ancho = this.ancho
    // Anillos de hadas: círculos de setas vistos en perspectiva, con un halo en la hierba.
    const anillos = Math.min(4, Math.ceil(escala(j.cantidad('anillo'))))
    const radio = Math.min(34, ancho * 0.075)
    const centros: number[] = []
    for (let a = 0; a < anillos; a++) centros.push(((a * 0.27 + 0.62) % 1) * ancho)

    const setas = Math.min(16, Math.ceil(escala(j.cantidad('seta')) * 2))
    for (let i = 0; i < setas; i++) {
      const x = ((i * 0.382 + 0.17) % 1) * ancho
      // No se dibujan encima de un anillo.
      if (centros.some((c) => Math.abs(c - x) < radio * (asp.anilloDoble ? 1.9 : 1.3))) continue
      // Las mejoras de seta las hacen más grandes.
      this.seta(x, suelo, (0.8 + ((i * 7) % 5) / 8) * (1 + asp.setaGrande * 0.2), i % 3 === 0 ? '#c0392b' : '#c9a36b', i % 3 === 0)
    }
    // Flores (nodo del árbol) entre las setas.
    if (asp.flores) {
      for (let i = 0; i < 14; i++) {
        const x = ((i * 0.236 + 0.05) % 1) * ancho
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
    for (const [a, cx] of centros.entries()) {
      this.anillo(cx, radio, 10, 0.62, a)
      if (asp.anilloDoble) this.anillo(cx, radio * 1.5, 14, 0.5, a + 10)
    }
  }

  /** Un anillo de hadas: halo luminoso en la hierba, setas en elipse (las de atrás más pequeñas) y chispas. */
  private anillo(cx: number, r: number, n: number, s: number, semilla: number) {
    const { ctx } = this
    const suelo = this.suelo
    const ry = r * 0.3
    const latido = 0.5 + 0.5 * Math.sin(this.tiempo * 1.4 + semilla)
    // Halo en la hierba.
    ctx.save()
    ctx.strokeStyle = `rgba(190, 255, 170, ${0.25 + 0.25 * latido})`
    ctx.lineWidth = 3
    ctx.shadowColor = '#b8ff9a'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.ellipse(cx, suelo + 1, r * 1.08, ry * 1.1, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    // Setas de atrás hacia delante para que se tapen bien.
    const setas: { x: number; y: number; k: number }[] = []
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + semilla
      setas.push({ x: cx + Math.cos(ang) * r, y: suelo + 1 + Math.sin(ang) * ry, k })
    }
    setas.sort((p, q) => p.y - q.y)
    for (const p of setas) {
      const profundidad = (p.y - suelo) / ry // -1 atrás, +1 delante
      this.seta(p.x, p.y, s * (0.78 + 0.22 * profundidad), p.k % 4 === 0 ? '#d9c7a0' : '#efe4c8', false)
    }
    // Chispas que giran alrededor del anillo.
    ctx.fillStyle = `rgba(234, 255, 208, ${0.5 + 0.5 * latido})`
    for (let i = 0; i < 6; i++) {
      const t = this.tiempo * 0.9 + i * 1.05 + semilla
      const x = cx + Math.cos(t) * r * 1.1
      const y = suelo - 4 - 9 * Math.abs(Math.sin(t * 1.3 + i))
      ctx.beginPath()
      ctx.arc(x, y, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** Seta con pie que se estrecha, sombra en el pie, sombrero con brillo y, si procede, lunares. */
  private seta(x: number, base: number, s: number, color: string, lunares: boolean) {
    const { ctx } = this
    const alto = 14 * s
    // Pie.
    ctx.fillStyle = '#efe6d2'
    ctx.beginPath()
    ctx.moveTo(x - 3 * s, base)
    ctx.lineTo(x + 3 * s, base)
    ctx.lineTo(x + 2.2 * s, base - alto)
    ctx.lineTo(x - 2.2 * s, base - alto)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(90, 70, 40, 0.3)'
    ctx.fillRect(x + 0.8 * s, base - alto, 1.6 * s, alto)
    // Sombrero con lado iluminado.
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(x, base - alto, 11 * s, 7 * s, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.beginPath()
    ctx.ellipse(x - 3 * s, base - alto - 1.5 * s, 5 * s, 3.5 * s, -0.4, Math.PI, 0)
    ctx.fill()
    // Láminas bajo el sombrero.
    ctx.fillStyle = 'rgba(70, 50, 30, 0.35)'
    ctx.fillRect(x - 10 * s, base - alto - 0.5 * s, 20 * s, 1.4 * s)
    if (lunares) {
      ctx.fillStyle = '#fff6e8'
      for (const [dx, dy, r] of [[-5, -2.5, 1.6], [1, -4.5, 1.9], [6, -2, 1.3]] as const) {
        ctx.beginPath()
        ctx.arc(x + dx * s, base - alto + dy * s, r * s, 0, Math.PI * 2)
        ctx.fill()
      }
    }
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
