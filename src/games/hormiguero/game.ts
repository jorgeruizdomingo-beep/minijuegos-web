import { BASE_FEROMONA, BONUS_FEROMONA, CRECIMIENTO_COSTE, EDIFICIOS, MAX_OFFLINE_SEG, MEJORAS, type Mejora } from './data'
import { cargar, guardar, borrar } from '../../core/save'

export const CLAVE_GUARDADO = 'hormiguero'
export const VERSION_GUARDADO = 1

export type Estado = {
  migas: number
  migasTotales: number // en esta colonia (se reinicia con el prestigio)
  migasHistoricas: number // en todas las colonias
  clicks: number
  edificios: Record<string, number>
  mejoras: string[]
  feromonas: number
  colonias: number // veces que se ha hecho prestigio
  inicio: number
}

export function estadoInicial(): Estado {
  return {
    migas: 0,
    migasTotales: 0,
    migasHistoricas: 0,
    clicks: 0,
    edificios: Object.fromEntries(EDIFICIOS.map((e) => [e.id, 0])),
    mejoras: [],
    feromonas: 0,
    colonias: 0,
    inicio: Date.now(),
  }
}

export class Juego {
  estado: Estado

  constructor(estado: Estado) {
    this.estado = estado
  }

  // ---------- Consultas ----------

  tieneMejora(id: string): boolean {
    return this.estado.mejoras.includes(id)
  }

  multiplicadorGlobal(): number {
    let m = 1 + this.estado.feromonas * BONUS_FEROMONA
    for (const id of this.estado.mejoras) {
      const mej = MEJORAS.find((x) => x.id === id)
      if (mej?.efecto.tipo === 'global') m *= mej.efecto.mult
    }
    return m
  }

  multiplicadorEdificio(idEdificio: string): number {
    let m = 1
    for (const id of this.estado.mejoras) {
      const mej = MEJORAS.find((x) => x.id === id)
      if (mej?.efecto.tipo === 'edificio' && mej.efecto.id === idEdificio) m *= mej.efecto.mult
    }
    return m
  }

  /** Producción por segundo de un tipo de edificio (todas sus unidades). */
  produccionEdificio(idEdificio: string): number {
    const e = EDIFICIOS.find((x) => x.id === idEdificio)!
    return (this.estado.edificios[e.id] ?? 0) * e.produccion * this.multiplicadorEdificio(e.id) * this.multiplicadorGlobal()
  }

  produccionTotal(): number {
    return EDIFICIOS.reduce((s, e) => s + this.produccionEdificio(e.id), 0)
  }

  migasPorClick(): number {
    let base = 1
    let porcentaje = 0
    for (const id of this.estado.mejoras) {
      const mej = MEJORAS.find((x) => x.id === id)
      if (!mej) continue
      if (mej.efecto.tipo === 'click') base *= mej.efecto.mult
      if (mej.efecto.tipo === 'clickPorcentajeProd') porcentaje += mej.efecto.porcentaje
    }
    return base * this.multiplicadorGlobal() + this.produccionTotal() * porcentaje
  }

  costeEdificio(idEdificio: string, cantidad = 1): number {
    const e = EDIFICIOS.find((x) => x.id === idEdificio)!
    const n = this.estado.edificios[e.id] ?? 0
    let total = 0
    for (let i = 0; i < cantidad; i++) total += Math.ceil(e.costeBase * CRECIMIENTO_COSTE ** (n + i))
    return total
  }

  /** Cuántas unidades se pueden comprar con las migas actuales. */
  maxComprable(idEdificio: string): number {
    const e = EDIFICIOS.find((x) => x.id === idEdificio)!
    const n = this.estado.edificios[e.id] ?? 0
    let migas = this.estado.migas
    let k = 0
    while (k < 1000) {
      const c = Math.ceil(e.costeBase * CRECIMIENTO_COSTE ** (n + k))
      if (migas < c) break
      migas -= c
      k++
    }
    return k
  }

  mejoraDesbloqueada(m: Mejora): boolean {
    const c = m.condicion
    if (c.tipo === 'edificio') return (this.estado.edificios[c.id] ?? 0) >= c.cantidad
    if (c.tipo === 'clicks') return this.estado.clicks >= c.cantidad
    return this.estado.migasTotales >= c.cantidad
  }

  mejorasDisponibles(): Mejora[] {
    return MEJORAS.filter((m) => !this.tieneMejora(m.id) && this.mejoraDesbloqueada(m)).sort((a, b) => a.coste - b.coste)
  }

  /** Feromonas que se tendrían al fundar una nueva colonia ahora. */
  feromonasAlPrestigiar(): number {
    return Math.floor(Math.sqrt(this.estado.migasHistoricas / BASE_FEROMONA))
  }

  feromonasGanables(): number {
    return Math.max(0, this.feromonasAlPrestigiar() - this.estado.feromonas)
  }

  /** Migas históricas necesarias para la siguiente feromona. */
  migasParaSiguienteFeromona(): number {
    const siguiente = this.feromonasAlPrestigiar() + 1
    return siguiente * siguiente * BASE_FEROMONA
  }

  // ---------- Acciones ----------

  private sumar(n: number) {
    this.estado.migas += n
    this.estado.migasTotales += n
    this.estado.migasHistoricas += n
  }

  click(): number {
    const n = this.migasPorClick()
    this.estado.clicks++
    this.sumar(n)
    return n
  }

  tick(dt: number) {
    this.sumar(this.produccionTotal() * dt)
  }

  comprarEdificio(idEdificio: string, cantidad = 1): boolean {
    const coste = this.costeEdificio(idEdificio, cantidad)
    if (cantidad <= 0 || this.estado.migas < coste) return false
    this.estado.migas -= coste
    this.estado.edificios[idEdificio] = (this.estado.edificios[idEdificio] ?? 0) + cantidad
    return true
  }

  comprarMejora(id: string): boolean {
    const m = MEJORAS.find((x) => x.id === id)
    if (!m || this.tieneMejora(id) || !this.mejoraDesbloqueada(m) || this.estado.migas < m.coste) return false
    this.estado.migas -= m.coste
    this.estado.mejoras.push(id)
    return true
  }

  prestigiar(): boolean {
    const ganadas = this.feromonasGanables()
    if (ganadas <= 0) return false
    const e = this.estado
    const nuevo = estadoInicial()
    nuevo.migasHistoricas = e.migasHistoricas
    nuevo.feromonas = e.feromonas + ganadas
    nuevo.colonias = e.colonias + 1
    nuevo.inicio = e.inicio
    this.estado = nuevo
    return true
  }

  /** Abona producción del tiempo fuera. Devuelve lo ganado y los segundos abonados. */
  progresoOffline(segundos: number): { migas: number; segundos: number } {
    const s = Math.min(segundos, MAX_OFFLINE_SEG)
    const ganado = this.produccionTotal() * s
    if (ganado > 0) this.sumar(ganado)
    return { migas: ganado, segundos: s }
  }

  // ---------- Persistencia ----------

  guardar() {
    guardar(CLAVE_GUARDADO, VERSION_GUARDADO, this.estado)
  }

  static cargar(): { juego: Juego; offline: { migas: number; segundos: number } | null } {
    const g = cargar<Estado>(CLAVE_GUARDADO, VERSION_GUARDADO)
    if (!g) return { juego: new Juego(estadoInicial()), offline: null }
    // Rellena campos que puedan faltar en guardados antiguos.
    const estado: Estado = { ...estadoInicial(), ...g.data, edificios: { ...estadoInicial().edificios, ...g.data.edificios } }
    const juego = new Juego(estado)
    const offline = g.elapsedSec > 5 ? juego.progresoOffline(g.elapsedSec) : null
    return { juego, offline }
  }

  static reiniciarTodo() {
    borrar(CLAVE_GUARDADO)
  }
}
