/**
 * Motor genérico de juego incremental: recurso principal, edificios con coste
 * creciente, mejoras desbloqueables por hitos, prestigio y progreso offline.
 * Cada juego aporta su configuración (datos de balance) y su presentación.
 */
import { borrar, cargar, guardar } from './save'

export type Edificio = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  costeBase: number
  produccion: number // unidades de recurso por segundo por edificio
}

export type EfectoMejora =
  | { tipo: 'click'; mult: number }
  | { tipo: 'edificio'; id: string; mult: number }
  | { tipo: 'global'; mult: number }
  | { tipo: 'clickPorcentajeProd'; porcentaje: number }

export type CondicionMejora =
  | { tipo: 'edificio'; id: string; cantidad: number }
  | { tipo: 'clicks'; cantidad: number }
  | { tipo: 'total'; cantidad: number }

export type Mejora = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  coste: number
  condicion: CondicionMejora
  efecto: EfectoMejora
}

export type Config = {
  claveGuardado: string
  versionGuardado: number
  edificios: Edificio[]
  mejoras: Mejora[]
  crecimientoCoste: number // multiplicador de coste por unidad comprada (p. ej. 1.15)
  prestigio: {
    base: number // recurso histórico necesario para el primer punto; luego raíz cuadrada
    bonus: number // producción extra por punto (0.05 = +5%)
  }
  maxOfflineSeg: number
}

export type Estado = {
  recurso: number
  total: number // en esta vida (se reinicia con el prestigio)
  historico: number // en todas las vidas
  clicks: number
  edificios: Record<string, number>
  mejoras: string[]
  prestigio: number
  vidas: number // veces que se ha hecho prestigio
  inicio: number
}

/** Genera las tres mejoras estándar de un edificio (x2 al llegar a 1, 10 y 50). */
export function mejorasDeEdificio(e: Edificio, nombres: [string, string, string]): Mejora[] {
  const umbrales = [1, 10, 50]
  const multCoste = [10, 50, 500]
  return umbrales.map((u, i) => ({
    id: `${e.id}_${i + 1}`,
    nombre: nombres[i],
    descripcion: `${e.nombre}: producción x2.`,
    emoji: e.emoji,
    coste: e.costeBase * multCoste[i],
    condicion: { tipo: 'edificio', id: e.id, cantidad: u },
    efecto: { tipo: 'edificio', id: e.id, mult: 2 },
  }))
}

export class Incremental {
  estado: Estado
  readonly config: Config
  private mejorasPorId: Map<string, Mejora>
  private edificiosPorId: Map<string, Edificio>

  constructor(config: Config, estado?: Estado) {
    this.config = config
    this.mejorasPorId = new Map(config.mejoras.map((m) => [m.id, m]))
    this.edificiosPorId = new Map(config.edificios.map((e) => [e.id, e]))
    this.estado = estado ?? this.estadoInicial()
  }

  estadoInicial(): Estado {
    return {
      recurso: 0,
      total: 0,
      historico: 0,
      clicks: 0,
      edificios: Object.fromEntries(this.config.edificios.map((e) => [e.id, 0])),
      mejoras: [],
      prestigio: 0,
      vidas: 0,
      inicio: Date.now(),
    }
  }

  // ---------- Consultas ----------

  tieneMejora(id: string): boolean {
    return this.estado.mejoras.includes(id)
  }

  multiplicadorGlobal(): number {
    let m = 1 + this.estado.prestigio * this.config.prestigio.bonus
    for (const id of this.estado.mejoras) {
      const mej = this.mejorasPorId.get(id)
      if (mej?.efecto.tipo === 'global') m *= mej.efecto.mult
    }
    return m
  }

  multiplicadorEdificio(idEdificio: string): number {
    let m = 1
    for (const id of this.estado.mejoras) {
      const mej = this.mejorasPorId.get(id)
      if (mej?.efecto.tipo === 'edificio' && mej.efecto.id === idEdificio) m *= mej.efecto.mult
    }
    return m
  }

  cantidad(idEdificio: string): number {
    return this.estado.edificios[idEdificio] ?? 0
  }

  totalEdificios(): number {
    return Object.values(this.estado.edificios).reduce((a, b) => a + b, 0)
  }

  /** Producción por segundo de una unidad de un edificio. */
  produccionUnidad(idEdificio: string): number {
    const e = this.edificiosPorId.get(idEdificio)!
    return e.produccion * this.multiplicadorEdificio(e.id) * this.multiplicadorGlobal()
  }

  /** Producción por segundo de todas las unidades de un edificio. */
  produccionEdificio(idEdificio: string): number {
    return this.cantidad(idEdificio) * this.produccionUnidad(idEdificio)
  }

  produccionTotal(): number {
    return this.config.edificios.reduce((s, e) => s + this.produccionEdificio(e.id), 0)
  }

  recursoPorClick(): number {
    let base = 1
    let porcentaje = 0
    for (const id of this.estado.mejoras) {
      const mej = this.mejorasPorId.get(id)
      if (!mej) continue
      if (mej.efecto.tipo === 'click') base *= mej.efecto.mult
      if (mej.efecto.tipo === 'clickPorcentajeProd') porcentaje += mej.efecto.porcentaje
    }
    return base * this.multiplicadorGlobal() + this.produccionTotal() * porcentaje
  }

  costeEdificio(idEdificio: string, cantidad = 1): number {
    const e = this.edificiosPorId.get(idEdificio)!
    const n = this.cantidad(e.id)
    let total = 0
    for (let i = 0; i < cantidad; i++) total += Math.ceil(e.costeBase * this.config.crecimientoCoste ** (n + i))
    return total
  }

  /** Cuántas unidades se pueden comprar con el recurso actual. */
  maxComprable(idEdificio: string): number {
    const e = this.edificiosPorId.get(idEdificio)!
    const n = this.cantidad(e.id)
    let recurso = this.estado.recurso
    let k = 0
    while (k < 1000) {
      const c = Math.ceil(e.costeBase * this.config.crecimientoCoste ** (n + k))
      if (recurso < c) break
      recurso -= c
      k++
    }
    return k
  }

  mejoraDesbloqueada(m: Mejora): boolean {
    const c = m.condicion
    if (c.tipo === 'edificio') return this.cantidad(c.id) >= c.cantidad
    if (c.tipo === 'clicks') return this.estado.clicks >= c.cantidad
    return this.estado.total >= c.cantidad
  }

  mejorasDisponibles(): Mejora[] {
    return this.config.mejoras.filter((m) => !this.tieneMejora(m.id) && this.mejoraDesbloqueada(m)).sort((a, b) => a.coste - b.coste)
  }

  /** Puntos de prestigio totales que se tendrían al prestigiar ahora. */
  prestigioAlReiniciar(): number {
    return Math.floor(Math.sqrt(this.estado.historico / this.config.prestigio.base))
  }

  prestigioGanable(): number {
    return Math.max(0, this.prestigioAlReiniciar() - this.estado.prestigio)
  }

  /** Recurso histórico necesario para el siguiente punto de prestigio. */
  historicoParaSiguientePrestigio(): number {
    const siguiente = this.prestigioAlReiniciar() + 1
    return siguiente * siguiente * this.config.prestigio.base
  }

  // ---------- Acciones ----------

  private sumar(n: number) {
    this.estado.recurso += n
    this.estado.total += n
    this.estado.historico += n
  }

  click(): number {
    const n = this.recursoPorClick()
    this.estado.clicks++
    this.sumar(n)
    return n
  }

  tick(dt: number) {
    this.sumar(this.produccionTotal() * dt)
  }

  comprarEdificio(idEdificio: string, cantidad = 1): boolean {
    if (!this.edificiosPorId.has(idEdificio)) return false
    const coste = this.costeEdificio(idEdificio, cantidad)
    if (cantidad <= 0 || this.estado.recurso < coste) return false
    this.estado.recurso -= coste
    this.estado.edificios[idEdificio] = this.cantidad(idEdificio) + cantidad
    return true
  }

  comprarMejora(id: string): boolean {
    const m = this.mejorasPorId.get(id)
    if (!m || this.tieneMejora(id) || !this.mejoraDesbloqueada(m) || this.estado.recurso < m.coste) return false
    this.estado.recurso -= m.coste
    this.estado.mejoras.push(id)
    return true
  }

  prestigiar(): boolean {
    const ganados = this.prestigioGanable()
    if (ganados <= 0) return false
    const e = this.estado
    const nuevo = this.estadoInicial()
    nuevo.historico = e.historico
    nuevo.prestigio = e.prestigio + ganados
    nuevo.vidas = e.vidas + 1
    nuevo.inicio = e.inicio
    this.estado = nuevo
    return true
  }

  /** Abona producción del tiempo fuera. Devuelve lo ganado y los segundos abonados. */
  progresoOffline(segundos: number): { recurso: number; segundos: number } {
    const s = Math.min(segundos, this.config.maxOfflineSeg)
    const ganado = this.produccionTotal() * s
    if (ganado > 0) this.sumar(ganado)
    return { recurso: ganado, segundos: s }
  }

  // ---------- Persistencia ----------

  guardar() {
    guardar(this.config.claveGuardado, this.config.versionGuardado, this.estado)
  }

  /** Carga el guardado (si existe) y abona el progreso offline. */
  static cargar(config: Config): { juego: Incremental; offline: { recurso: number; segundos: number } | null } {
    const g = cargar<Estado>(config.claveGuardado, config.versionGuardado)
    const vacio = new Incremental(config)
    if (!g) return { juego: vacio, offline: null }
    // Rellena campos que puedan faltar en guardados antiguos.
    const estado: Estado = { ...vacio.estadoInicial(), ...g.data, edificios: { ...vacio.estadoInicial().edificios, ...g.data.edificios } }
    const juego = new Incremental(config, estado)
    const offline = g.elapsedSec > 5 ? juego.progresoOffline(g.elapsedSec) : null
    return { juego, offline }
  }

  reiniciarTodo() {
    borrar(this.config.claveGuardado)
  }
}
