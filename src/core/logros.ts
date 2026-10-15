/**
 * Logros: hitos que se desbloquean una sola vez y no se pierden con el prestigio.
 * Se generan a partir de la configuración del juego y se guardan aparte del estado.
 */
import type { Incremental } from './incremental'
import { fmt } from './format'

export type Logro = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  oculto?: boolean // no se muestra la pista hasta desbloquearlo
  cumple: (j: Incremental) => boolean
}

export type TextosLogros = {
  recurso: string // "migas"
  prestigioUnidad: string // "feromona"
  prestigioVida: string // "colonia"
}

/** Cada logro desbloqueado suma este porcentaje a la producción (0.01 = +1 %). */
export const BONUS_POR_LOGRO = 0.01

const HITOS_EDIFICIO = [1, 10, 25, 50, 100]
const HITOS_TOTAL = [100, 10_000, 1_000_000, 100_000_000, 10_000_000_000, 1_000_000_000_000]
const HITOS_CLICKS = [1, 100, 1_000, 10_000]
const HITOS_MEJORAS = [1, 10, 25]
const HITOS_PRESTIGIO = [1, 5, 10, 25]

export function generarLogros(j: Incremental, t: TextosLogros): Logro[] {
  const lista: Logro[] = []
  for (const e of j.config.edificios) {
    for (const n of HITOS_EDIFICIO) {
      lista.push({
        id: `ed_${e.id}_${n}`,
        nombre: n === 1 ? `Estreno: ${e.nombre.toLowerCase()}` : `${e.nombre} ×${n}`,
        descripcion: n === 1 ? `Compra tu primer edificio de tipo ${e.nombre.toLowerCase()}.` : `Ten ${n} unidades de ${e.nombre.toLowerCase()} a la vez.`,
        emoji: e.emoji,
        cumple: (j) => j.cantidad(e.id) >= n,
      })
    }
  }
  for (const n of HITOS_TOTAL) {
    lista.push({
      id: `total_${n}`,
      nombre: `${fmt(n)} ${t.recurso}`,
      descripcion: `Produce ${fmt(n)} ${t.recurso} en total.`,
      emoji: '📈',
      cumple: (j) => j.estado.historico >= n,
    })
  }
  for (const n of HITOS_CLICKS) {
    lista.push({
      id: `clicks_${n}`,
      nombre: n === 1 ? 'Primer clic' : `${fmt(n)} clics`,
      descripcion: n === 1 ? 'Todo empieza con uno.' : `Haz ${fmt(n)} clics.`,
      emoji: '👆',
      cumple: (j) => j.estado.clicks >= n,
    })
  }
  for (const n of HITOS_MEJORAS) {
    lista.push({
      id: `mejoras_${n}`,
      nombre: n === 1 ? 'Primera mejora' : `${n} mejoras`,
      descripcion: `Compra ${n} mejora${n > 1 ? 's' : ''}.`,
      emoji: '⬆️',
      cumple: (j) => j.estado.mejoras.length >= n,
    })
  }
  for (const n of HITOS_PRESTIGIO) {
    lista.push({
      id: `prestigio_${n}`,
      nombre: n === 1 ? `${t.prestigioUnidad[0].toUpperCase()}${t.prestigioUnidad.slice(1)} nº 1` : `${n} ${t.prestigioUnidad}s`,
      descripcion: n === 1 ? `Reinicia tu ${t.prestigioVida} por primera vez.` : `Acumula ${n} ${t.prestigioUnidad}s.`,
      emoji: '🌟',
      cumple: (j) => j.estado.prestigio >= n,
    })
  }
  lista.push({
    id: 'paciencia',
    nombre: 'Paciencia',
    descripcion: 'Juega durante una hora en total.',
    emoji: '⏳',
    cumple: (j) => Date.now() - j.estado.inicio >= 3600_000,
  })
  lista.push({
    id: 'coleccionista',
    nombre: 'Coleccionista',
    descripcion: 'Ten al menos uno de cada edificio.',
    emoji: '🧩',
    cumple: (j) => j.config.edificios.every((e) => j.cantidad(e.id) > 0),
  })
  lista.push({
    id: 'ni_un_clic',
    nombre: 'Manos quietas',
    descripcion: 'Llega a 1M en total con menos de 50 clics.',
    emoji: '🧘',
    oculto: true,
    cumple: (j) => j.estado.historico >= 1_000_000 && j.estado.clicks < 50,
  })
  return lista
}

export class Logros {
  readonly lista: Logro[]
  private desbloqueados: Set<string>
  private clave: string
  private juego: Incremental

  constructor(juego: Incremental, textos: TextosLogros) {
    this.juego = juego
    this.clave = `vjw:${juego.config.claveGuardado}:logros`
    this.lista = generarLogros(juego, textos)
    this.desbloqueados = new Set(this.leer())
  }

  private leer(): string[] {
    try {
      const raw = localStorage.getItem(this.clave)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  }

  guardar() {
    try {
      localStorage.setItem(this.clave, JSON.stringify([...this.desbloqueados]))
    } catch {
      // sin almacenamiento
    }
  }

  tiene(id: string): boolean {
    return this.desbloqueados.has(id)
  }

  get cuenta(): number {
    return this.desbloqueados.size
  }

  /** Bonus de producción acumulado (0.12 = +12 %). */
  get bonus(): number {
    return this.cuenta * BONUS_POR_LOGRO
  }

  /** Comprueba las condiciones y devuelve los logros recién desbloqueados. */
  comprobar(): Logro[] {
    const nuevos: Logro[] = []
    for (const l of this.lista) {
      if (this.desbloqueados.has(l.id)) continue
      if (l.cumple(this.juego)) {
        this.desbloqueados.add(l.id)
        nuevos.push(l)
      }
    }
    if (nuevos.length) this.guardar()
    return nuevos
  }

  /** HTML del panel de logros. */
  panel(): string {
    const filas = this.lista
      .map((l) => {
        const ok = this.desbloqueados.has(l.id)
        const nombre = ok || !l.oculto ? l.nombre : '???'
        const desc = ok || !l.oculto ? l.descripcion : 'Logro oculto.'
        return `
          <div class="logro ${ok ? 'logro--ok' : ''}">
            <span class="logro__emoji">${ok ? l.emoji : '🔒'}</span>
            <span class="logro__info"><strong>${nombre}</strong><span class="muted">${desc}</span></span>
          </div>`
      })
      .join('')
    const pct = Math.round(this.bonus * 100)
    return `<p class="muted">${this.cuenta} de ${this.lista.length} desbloqueados · <strong>+${pct}% de producción</strong> (cada logro suma un ${Math.round(BONUS_POR_LOGRO * 100)} %, y no se pierde con el prestigio).</p><div class="logros">${filas}</div>`
  }
}
