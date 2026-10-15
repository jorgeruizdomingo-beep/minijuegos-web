/**
 * Motor genérico de juego incremental: recurso principal, edificios con coste
 * creciente, mejoras desbloqueables por hitos, prestigio y progreso offline.
 * Opcionalmente, cadenas de producción: un edificio con `genera` produce
 * unidades de otro edificio en vez de recurso.
 * Cada juego aporta su configuración (datos de balance) y su presentación.
 */
import { borrar, cargar, guardar } from './save'

export type Edificio = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  costeBase: number
  produccion: number // unidades de recurso (o del edificio de `genera`) por segundo por edificio
  genera?: string // si existe, produce unidades de este edificio en vez de recurso
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

/** Evento sorpresa opcional: algo aparece sobre la escena y, si se pincha, multiplica la producción un rato. */
export type EventoConfig = {
  nombre: string // "Miga dorada"
  emoji: string // "🍪"
  esperaMinSeg: number
  esperaMaxSeg: number
  visibleSeg: number // tiempo que espera a que lo pinches
  duracionSeg: number
  mult: number
}

/** Efecto permanente de un nodo del árbol (sobrevive al prestigio). */
export type EfectoNodo =
  | { tipo: 'global'; mult: number } // producción ×mult
  | { tipo: 'click'; mult: number } // recurso por clic ×mult
  | { tipo: 'descuento'; porcentaje: number } // edificios más baratos (0.1 = -10 %)
  | { tipo: 'arranque'; edificio: string; cantidad: number } // cada vida empieza con N unidades
  | { tipo: 'offline'; horas: number } // más horas de progreso fuera
  | { tipo: 'fichas'; porcentaje: number } // más fichas por reinicio (0.25 = +25 %)
  | { tipo: 'desbloqueo'; clave: string } // clave libre que la escena o el juego leen con `tieneDesbloqueo`

export type NodoArbol = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  coste: number // fichas (del primer nivel, si es repetible)
  requiere?: string[] // nodos que deben estar comprados (al menos un nivel)
  efecto: EfectoNodo // en un nodo repetible se acumula por nivel (× para global/click, + para el resto)
  /** Si existe, el nodo se puede comprar varias veces: coste × crecimientoCoste por nivel, hasta `maximo` (sin tope si falta). */
  repetible?: { maximo?: number; crecimientoCoste: number }
}

/** Árbol de mejoras permanentes que se compra con fichas ganadas al prestigiar. */
export type ArbolConfig = {
  fichaNombre: string // "ámbar"
  fichaPlural: string // "ámbares"
  fichaEmoji: string // "🟠"
  /** Fichas que da un reinicio según los puntos de prestigio ganados en él. Por defecto, 1 + ⌊√ganados⌋. */
  fichasPorReinicio?: (ganados: number, estado: Estado) => number
  nodos: NodoArbol[]
}

export type Config = {
  claveGuardado: string
  versionGuardado: number
  edificios: Edificio[]
  mejoras: Mejora[]
  crecimientoCoste: number // multiplicador de coste por unidad comprada (p. ej. 1.15)
  prestigio: {
    base: number // recurso histórico necesario para el primer punto; luego raíz
    bonus: number // producción extra por punto (0.05 = +5%)
    /** Índice de la raíz: puntos = ⌊(histórico/base)^(1/raiz)⌋. Por defecto 2 (raíz cuadrada); 3 frena el encadenado en partidas largas. */
    raiz?: number
  }
  maxOfflineSeg: number
  /** Si existe, el motor gestiona el evento sorpresa (botón sobre la escena). */
  evento?: EventoConfig
  /** Si existe, el motor gestiona las fichas y el árbol de mejoras permanentes. */
  arbol?: ArbolConfig
}

export type Estado = {
  recurso: number
  total: number // en esta vida (se reinicia con el prestigio)
  historico: number // en todas las vidas
  clicks: number
  edificios: Record<string, number>
  /** Unidades compradas (las generadas por una cadena no cuentan). Un id ausente vale 0. */
  comprados?: Record<string, number>
  mejoras: string[]
  prestigio: number
  vidas: number // veces que se ha hecho prestigio
  inicio: number
  /** Fichas del árbol sin gastar. Sobreviven al prestigio. */
  fichas?: number
  /** Nodos del árbol comprados. Sobreviven al prestigio. */
  nodos?: string[]
}

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const esTexto = (v: unknown): v is string => typeof v === 'string'

/** Devuelve el objeto solo con las entradas cuyo valor es un número finito; cualquier otra cosa, vacío. */
function sanearConteo(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((par): par is [string, number] => esNumero(par[1])))
}

function sanearLista(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter(esTexto) : undefined
}

/**
 * Valida la forma de cada campo de un guardado y descarta los que no cuadran
 * (un import corrupto, un guardado editado a mano). Un campo inválido equivale a
 * uno ausente: `cargar` lo rellena con el valor inicial. Nunca lanza.
 */
export function sanearGuardado(data: unknown): Partial<Estado> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const d = data as Record<string, unknown>
  const limpio: Partial<Estado> = {}
  for (const k of ['recurso', 'total', 'historico', 'clicks', 'prestigio', 'vidas', 'inicio', 'fichas'] as const) {
    if (esNumero(d[k])) limpio[k] = d[k]
  }
  const edificios = sanearConteo(d.edificios)
  if (edificios) limpio.edificios = edificios
  const comprados = sanearConteo(d.comprados)
  if (comprados) limpio.comprados = comprados
  const mejoras = sanearLista(d.mejoras)
  if (mejoras) limpio.mejoras = mejoras
  const nodos = sanearLista(d.nodos)
  if (nodos) limpio.nodos = nodos
  else if (d.nodos !== undefined) limpio.nodos = [] // forma inválida: no es una partida anterior al árbol
  return limpio
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
  private hayCadenas: boolean
  /** Multiplicador pasajero (eventos en pantalla). No se guarda ni cuenta para el progreso offline. */
  multiplicadorTemporal = 1
  /** Bonus permanente por logros (0.25 = +25 %). Lo fija el arranque a partir de los logros desbloqueados. */
  bonusLogros = 0

  constructor(config: Config, estado?: Estado) {
    this.config = config
    this.mejorasPorId = new Map(config.mejoras.map((m) => [m.id, m]))
    this.edificiosPorId = new Map(config.edificios.map((e) => [e.id, e]))
    this.hayCadenas = config.edificios.some((e) => e.genera)
    this.estado = estado ?? this.estadoInicial()
  }

  estadoInicial(): Estado {
    return {
      recurso: 0,
      total: 0,
      historico: 0,
      clicks: 0,
      edificios: Object.fromEntries(this.config.edificios.map((e) => [e.id, 0])),
      comprados: {},
      mejoras: [],
      prestigio: 0,
      vidas: 0,
      inicio: Date.now(),
      fichas: 0,
      nodos: [],
    }
  }

  // ---------- Árbol de mejoras permanentes ----------

  get arbol(): ArbolConfig | undefined {
    return this.config.arbol
  }

  get fichas(): number {
    return this.estado.fichas ?? 0
  }

  nodosComprados(): string[] {
    return this.estado.nodos ?? []
  }

  tieneNodo(id: string): boolean {
    return this.nivelNodo(id) > 0
  }

  /** Veces que se ha comprado un nodo (0 o 1 si no es repetible). */
  nivelNodo(id: string): number {
    let n = 0
    for (const x of this.nodosComprados()) if (x === id) n++
    return n
  }

  /** Coste del siguiente nivel de un nodo (el primero si aún no se tiene). */
  costeNodo(id: string): number {
    const n = this.nodo(id)
    if (!n) return Infinity
    const nivel = this.nivelNodo(id)
    return n.repetible ? Math.ceil(n.coste * n.repetible.crecimientoCoste ** nivel) : n.coste
  }

  /** Nivel máximo de un nodo (1 si no es repetible, Infinity si es repetible sin tope). */
  maximoNodo(id: string): number {
    const n = this.nodo(id)
    if (!n) return 0
    return n.repetible ? (n.repetible.maximo ?? Infinity) : 1
  }

  /** Verdadero si algún nodo comprado desbloquea esta clave (evolución de escena, contenido). */
  tieneDesbloqueo(clave: string): boolean {
    return this.efectosNodos().some((e) => e.tipo === 'desbloqueo' && e.clave === clave)
  }

  /** Claves desbloqueadas por el árbol, para que la escena las lea de una vez. */
  desbloqueos(): string[] {
    return this.efectosNodos().flatMap((e) => (e.tipo === 'desbloqueo' ? [e.clave] : []))
  }

  /** Efectos activos, repetidos tantas veces como niveles tenga cada nodo (un desbloqueo cuenta una vez). */
  private efectosNodos(): EfectoNodo[] {
    const arbol = this.config.arbol
    if (!arbol) return []
    const efectos: EfectoNodo[] = []
    for (const n of arbol.nodos) {
      const nivel = this.nivelNodo(n.id)
      if (nivel <= 0) continue
      const veces = n.efecto.tipo === 'desbloqueo' ? 1 : nivel
      for (let i = 0; i < veces; i++) efectos.push(n.efecto)
    }
    return efectos
  }

  nodo(id: string): NodoArbol | undefined {
    return this.config.arbol?.nodos.find((n) => n.id === id)
  }

  /** Requisitos cumplidos y con niveles por comprar (no mira las fichas). */
  nodoDisponible(id: string): boolean {
    const n = this.nodo(id)
    if (!n || this.nivelNodo(id) >= this.maximoNodo(id)) return false
    return (n.requiere ?? []).every((r) => this.tieneNodo(r))
  }

  comprarNodo(id: string): boolean {
    const n = this.nodo(id)
    const coste = this.costeNodo(id)
    if (!n || !this.nodoDisponible(id) || this.fichas < coste) return false
    this.estado.fichas = this.fichas - coste
    this.estado.nodos = [...this.nodosComprados(), id]
    // Un nodo de arranque comprado a mitad de vida regala las unidades que faltan ya mismo.
    if (n.efecto.tipo === 'arranque') this.aplicarArranque()
    return true
  }

  /** Fichas que daría prestigiar ahora. */
  fichasAlReiniciar(): number {
    return this.fichasPor(this.prestigioGanable())
  }

  private fichasPor(ganados: number): number {
    const arbol = this.config.arbol
    if (!arbol || ganados <= 0) return 0
    const base = arbol.fichasPorReinicio ? arbol.fichasPorReinicio(ganados, this.estado) : 1 + Math.floor(Math.sqrt(ganados))
    let extra = 0
    for (const e of this.efectosNodos()) if (e.tipo === 'fichas') extra += e.porcentaje
    return Math.max(0, Math.round(base * (1 + extra)))
  }

  private descuentoEdificios(): number {
    let d = 0
    for (const e of this.efectosNodos()) if (e.tipo === 'descuento') d += e.porcentaje
    return Math.min(0.75, d)
  }

  private multiplicadorNodos(tipo: 'global' | 'click'): number {
    let m = 1
    for (const e of this.efectosNodos()) if (e.tipo === tipo) m *= e.mult
    return m
  }

  /** Segundos máximos de progreso fuera, con las horas extra del árbol. */
  maxOfflineSeg(): number {
    let horas = 0
    for (const e of this.efectosNodos()) if (e.tipo === 'offline') horas += e.horas
    return this.config.maxOfflineSeg + horas * 3600
  }

  /** Regala las unidades de arranque que falten (sin contar como compradas, para no encarecer). */
  private aplicarArranque() {
    const objetivo: Record<string, number> = {}
    for (const e of this.efectosNodos()) {
      if (e.tipo !== 'arranque' || !this.edificiosPorId.has(e.edificio)) continue
      objetivo[e.edificio] = (objetivo[e.edificio] ?? 0) + e.cantidad
    }
    for (const [id, n] of Object.entries(objetivo)) if (this.cantidad(id) < n) this.estado.edificios[id] = n
  }

  // ---------- Consultas ----------

  tieneMejora(id: string): boolean {
    return this.estado.mejoras.includes(id)
  }

  multiplicadorGlobal(): number {
    let m = (1 + this.estado.prestigio * this.config.prestigio.bonus) * (1 + this.bonusLogros) * this.multiplicadorTemporal * this.multiplicadorNodos('global')
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

  /** Unidades compradas de un edificio (sin las generadas por cadenas). */
  compradas(idEdificio: string): number {
    return this.estado.comprados?.[idEdificio] ?? 0
  }

  totalEdificios(): number {
    return Object.values(this.estado.edificios).reduce((a, b) => a + b, 0)
  }

  /** Producción por segundo de una unidad de un edificio (de recurso, o del edificio de `genera`). */
  produccionUnidad(idEdificio: string): number {
    const e = this.edificiosPorId.get(idEdificio)!
    // Los multiplicadores globales solo tocan al recurso: aplicados a cada eslabón de una cadena
    // se compondrían (prestigio^n) y el juego se desbocaría.
    const global = e.genera ? 1 : this.multiplicadorGlobal()
    return e.produccion * this.multiplicadorEdificio(e.id) * global
  }

  /** Producción por segundo de todas las unidades de un edificio. */
  produccionEdificio(idEdificio: string): number {
    return this.cantidad(idEdificio) * this.produccionUnidad(idEdificio)
  }

  produccionTotal(): number {
    return this.config.edificios.reduce((s, e) => (e.genera ? s : s + this.produccionEdificio(e.id)), 0)
  }

  recursoPorClick(): number {
    let base = this.multiplicadorNodos('click')
    let porcentaje = 0
    for (const id of this.estado.mejoras) {
      const mej = this.mejorasPorId.get(id)
      if (!mej) continue
      if (mej.efecto.tipo === 'click') base *= mej.efecto.mult
      if (mej.efecto.tipo === 'clickPorcentajeProd') porcentaje += mej.efecto.porcentaje
    }
    return base * this.multiplicadorGlobal() + this.produccionTotal() * porcentaje
  }

  /** Coste de la unidad número `n` (empezando en 0) de un edificio, con el descuento del árbol. */
  private costeUnidad(e: Edificio, n: number): number {
    return Math.ceil(e.costeBase * this.config.crecimientoCoste ** n * (1 - this.descuentoEdificios()))
  }

  costeEdificio(idEdificio: string, cantidad = 1): number {
    const e = this.edificiosPorId.get(idEdificio)!
    const n = this.compradas(e.id)
    let total = 0
    for (let i = 0; i < cantidad; i++) total += this.costeUnidad(e, n + i)
    return total
  }

  /** Cuántas unidades se pueden comprar con el recurso actual. */
  maxComprable(idEdificio: string): number {
    const e = this.edificiosPorId.get(idEdificio)!
    const n = this.compradas(e.id)
    let recurso = this.estado.recurso
    let k = 0
    while (k < 1000) {
      const c = this.costeUnidad(e, n + k)
      if (recurso < c) break
      recurso -= c
      k++
    }
    return k
  }

  mejoraDesbloqueada(m: Mejora): boolean {
    const c = m.condicion
    if (c.tipo === 'edificio') return this.compradas(c.id) >= c.cantidad
    if (c.tipo === 'clicks') return this.estado.clicks >= c.cantidad
    return this.estado.total >= c.cantidad
  }

  mejorasDisponibles(): Mejora[] {
    return this.config.mejoras.filter((m) => !this.tieneMejora(m.id) && this.mejoraDesbloqueada(m)).sort((a, b) => a.coste - b.coste)
  }

  /** Puntos de prestigio totales que se tendrían al prestigiar ahora. */
  prestigioAlReiniciar(): number {
    const raiz = this.config.prestigio.raiz ?? 2
    // Un pelín de holgura: (x^(1/3))^3 puede quedar en 7.9999 justo en el umbral.
    return Math.floor(Math.pow(this.estado.historico / this.config.prestigio.base, 1 / raiz) + 1e-9)
  }

  prestigioGanable(): number {
    return Math.max(0, this.prestigioAlReiniciar() - this.estado.prestigio)
  }

  /** Recurso histórico necesario para el siguiente punto de prestigio. */
  historicoParaSiguientePrestigio(): number {
    const siguiente = this.prestigioAlReiniciar() + 1
    return siguiente ** (this.config.prestigio.raiz ?? 2) * this.config.prestigio.base
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
    if (this.hayCadenas) {
      // Primero se calcula lo que genera cada eslabón y luego se aplica, para no encadenar dentro del mismo paso.
      const generado: [string, number][] = []
      for (const e of this.config.edificios) if (e.genera) generado.push([e.genera, this.produccionEdificio(e.id) * dt])
      this.sumar(this.produccionTotal() * dt)
      for (const [id, n] of generado) if (n > 0) this.estado.edificios[id] = this.cantidad(id) + n
      return
    }
    this.sumar(this.produccionTotal() * dt)
  }

  comprarEdificio(idEdificio: string, cantidad = 1): boolean {
    if (!this.edificiosPorId.has(idEdificio)) return false
    const coste = this.costeEdificio(idEdificio, cantidad)
    if (cantidad <= 0 || this.estado.recurso < coste) return false
    this.estado.recurso -= coste
    const previas = this.compradas(idEdificio)
    this.estado.edificios[idEdificio] = this.cantidad(idEdificio) + cantidad
    this.estado.comprados = { ...this.estado.comprados, [idEdificio]: previas + cantidad }
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
    nuevo.fichas = (e.fichas ?? 0) + this.fichasPor(ganados)
    nuevo.nodos = [...(e.nodos ?? [])]
    this.estado = nuevo
    this.aplicarArranque()
    return true
  }

  /** Abona producción del tiempo fuera. Devuelve lo ganado y los segundos abonados. */
  progresoOffline(segundos: number): { recurso: number; segundos: number } {
    const s = Math.min(segundos, this.maxOfflineSeg())
    if (this.hayCadenas) {
      // La producción crece con el tiempo: se simula en pasos.
      const antes = this.estado.recurso
      const pasos = Math.min(2000, Math.max(1, Math.ceil(s)))
      for (let i = 0; i < pasos; i++) this.tick(s / pasos)
      return { recurso: this.estado.recurso - antes, segundos: s }
    }
    const ganado = this.produccionTotal() * s
    if (ganado > 0) this.sumar(ganado)
    return { recurso: ganado, segundos: s }
  }

  // ---------- Persistencia ----------

  guardar() {
    guardar(this.config.claveGuardado, this.config.versionGuardado, this.estado)
  }

  /** Carga el guardado (si existe) y abona el progreso offline. */
  /** Carga la partida guardada (si la hay) y aplica migraciones. `preparar` se llama antes de abonar el tiempo fuera. */
  static cargar(config: Config, preparar?: (j: Incremental) => void): { juego: Incremental; offline: { recurso: number; segundos: number } | null } {
    const g = cargar<Estado>(config.claveGuardado, config.versionGuardado)
    const vacio = new Incremental(config)
    if (!g) {
      preparar?.(vacio)
      return { juego: vacio, offline: null }
    }
    // Un guardado importado o editado puede traer campos con la forma equivocada:
    // se descarta campo a campo (nunca la partida entera) para que el juego siempre arranque.
    const datos = sanearGuardado(g.data)
    // Rellena campos que puedan faltar en guardados antiguos. Sin cadenas, todo lo que hay se compró.
    const estado: Estado = {
      ...vacio.estadoInicial(),
      ...datos,
      edificios: { ...vacio.estadoInicial().edificios, ...datos.edificios },
      comprados: datos.comprados ?? { ...datos.edificios },
    }
    const juego = new Incremental(config, estado)
    // Partidas anteriores al árbol: se abonan las fichas que habrían dado sus reinicios.
    if (config.arbol && datos.nodos === undefined) {
      estado.nodos = []
      estado.fichas = (datos.fichas ?? 0) + (estado.prestigio > 0 ? juego.fichasPor(estado.prestigio) : 0)
    }
    juego.aplicarArranque() // nodos de arranque comprados en otra sesión o dispositivo
    preparar?.(juego) // p. ej. fijar bonus por logros antes de abonar el tiempo fuera
    const offline = g.elapsedSec > 5 ? juego.progresoOffline(g.elapsedSec) : null
    return { juego, offline }
  }

  reiniciarTodo() {
    borrar(this.config.claveGuardado)
  }
}
