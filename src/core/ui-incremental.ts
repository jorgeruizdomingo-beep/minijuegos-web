/**
 * Interfaz compartida de los juegos incrementales: contador, escena (un canvas
 * que cada juego pinta a su manera), panel de prestigio y tienda.
 */
import type { Incremental } from './incremental'
import { fmt, fmtRate } from './format'

export type Cantidad = 1 | 10 | 100 | 'max'

export type Textos = {
  recurso: string // "migas"
  tienda: string // "Colonia"
  accionClick: string // "Recoger miga" (aria-label)
  prestigioNombre: string // "Feromonas"
  prestigioEmoji: string // "🧪"
  prestigioUnidad: string // "feromona"
  prestigioVida: string // "colonia"
  prestigioAccion: string // "Fundar nueva colonia"
  sinMejoras: string
}

type Acciones = {
  comprarEdificio: (id: string, cantidad: Cantidad) => void
  comprarMejora: (id: string) => void
  prestigiar: () => void
}

export class UIIncremental {
  private raiz: HTMLElement
  private juego: Incremental
  private textos: Textos
  private acciones: Acciones
  private cantidad: Cantidad = 1
  private filasEdificio = new Map<string, HTMLButtonElement>()
  private ultimasMejoras = ''
  private ultimoPrestigio = ''

  constructor(raiz: HTMLElement, juego: Incremental, textos: Textos, acciones: Acciones) {
    this.raiz = raiz
    this.juego = juego
    this.textos = textos
    this.acciones = acciones
    this.construir()
  }

  private construir() {
    const t = this.textos
    this.raiz.innerHTML = `
      <section class="panel panel--escena">
        <div class="contador">
          <div class="contador__recurso"><span id="recurso" class="mono">0</span> <span class="contador__unidad">${t.recurso}</span></div>
          <div class="contador__sub muted"><span id="prod" class="mono">0/s</span> · <span id="porclick" class="mono">1</span> por clic</div>
        </div>
        <div class="escena">
          <canvas id="canvas"></canvas>
          <button id="btn-click" class="btn-click" aria-label="${t.accionClick}"></button>
        </div>
        <div class="prestigio" id="prestigio"></div>
      </section>
      <section class="panel panel--tienda">
        <div class="tienda__cab">
          <h2>${t.tienda}</h2>
          <div class="cantidades" id="cantidades">
            <button data-cant="1" class="activo">x1</button>
            <button data-cant="10">x10</button>
            <button data-cant="100">x100</button>
            <button data-cant="max">máx</button>
          </div>
        </div>
        <div class="lista" id="edificios"></div>
        <h2>Mejoras</h2>
        <div class="mejoras" id="mejoras"></div>
      </section>
    `

    const lista = this.raiz.querySelector<HTMLElement>('#edificios')!
    for (const e of this.juego.config.edificios) {
      const fila = document.createElement('button')
      fila.className = 'edificio'
      fila.dataset.id = e.id
      fila.innerHTML = `
        <span class="edificio__emoji">${e.emoji}</span>
        <span class="edificio__info">
          <span class="edificio__nombre">${e.nombre} <span class="edificio__n mono"></span></span>
          <span class="edificio__desc muted">${e.descripcion}</span>
          <span class="edificio__prod muted mono"></span>
        </span>
        <span class="edificio__coste mono"></span>
      `
      fila.addEventListener('click', () => this.acciones.comprarEdificio(e.id, this.cantidad))
      lista.appendChild(fila)
      this.filasEdificio.set(e.id, fila)
    }

    this.raiz.querySelector('#cantidades')!.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-cant]')
      if (!b) return
      const c = b.dataset.cant!
      this.cantidad = c === 'max' ? 'max' : (Number(c) as Cantidad)
      this.raiz.querySelectorAll('#cantidades button').forEach((x) => x.classList.toggle('activo', x === b))
      this.refrescar()
    })

    this.raiz.querySelector('#mejoras')!.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-mejora]')
      if (b) this.acciones.comprarMejora(b.dataset.mejora!)
    })

    this.raiz.querySelector('#prestigio')!.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('#btn-prestigio')) this.acciones.prestigiar()
    })
  }

  get canvas(): HTMLCanvasElement {
    return this.raiz.querySelector('#canvas')!
  }

  get botonClick(): HTMLButtonElement {
    return this.raiz.querySelector('#btn-click')!
  }

  /** Texto flotante "+N" sobre el punto de clic (coordenadas relativas a la escena). */
  flotante(x: number, y: number, texto: string) {
    const escena = this.raiz.querySelector<HTMLElement>('.escena')!
    const el = document.createElement('span')
    el.className = 'flotante mono'
    el.textContent = texto
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    escena.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }

  refrescar() {
    const j = this.juego
    const e = j.estado
    const t = this.textos
    this.set('#recurso', fmt(e.recurso))
    this.set('#prod', fmtRate(j.produccionTotal()))
    this.set('#porclick', fmt(j.recursoPorClick()))

    // Un edificio se muestra si ya tienes alguno o has acumulado parte de su coste.
    // El siguiente al último visible se enseña atenuado como anticipo.
    let anticipoMostrado = false
    for (const ed of j.config.edificios) {
      const fila = this.filasEdificio.get(ed.id)!
      const n = j.cantidad(ed.id)
      const visible = ed === j.config.edificios[0] || n > 0 || e.total >= ed.costeBase * 0.3
      if (!visible) {
        fila.hidden = anticipoMostrado
        fila.classList.toggle('edificio--anticipo', !anticipoMostrado)
        anticipoMostrado = true
        if (fila.hidden) continue
      } else {
        fila.hidden = false
        fila.classList.remove('edificio--anticipo')
      }
      const cant = this.cantidad === 'max' ? Math.max(1, j.maxComprable(ed.id)) : this.cantidad
      const coste = j.costeEdificio(ed.id, cant)
      fila.querySelector('.edificio__n')!.textContent = n > 0 ? `×${n}` : ''
      fila.querySelector('.edificio__coste')!.textContent = `${fmt(coste)}${cant > 1 ? ` (×${cant})` : ''}`
      fila.querySelector('.edificio__prod')!.textContent =
        n > 0
          ? `${fmtRate(j.produccionUnidad(ed.id))} cada uno · ${fmtRate(j.produccionEdificio(ed.id))} en total`
          : `${fmtRate(j.produccionUnidad(ed.id))} cada uno`
      fila.disabled = e.recurso < coste
    }

    // Mejoras: reconstruir solo si cambia la lista disponible.
    const disponibles = j.mejorasDisponibles()
    const firma = disponibles.map((m) => m.id).join(',')
    const cont = this.raiz.querySelector<HTMLElement>('#mejoras')!
    if (firma !== this.ultimasMejoras) {
      this.ultimasMejoras = firma
      cont.innerHTML = disponibles.length
        ? disponibles
            .map(
              (m) => `
          <button class="mejora" data-mejora="${m.id}" title="${m.descripcion}">
            <span class="mejora__emoji">${m.emoji}</span>
            <span class="mejora__nombre">${m.nombre}</span>
            <span class="mejora__coste mono">${fmt(m.coste)}</span>
          </button>`,
            )
            .join('')
        : `<p class="muted">${t.sinMejoras}</p>`
    }
    cont.querySelectorAll<HTMLButtonElement>('button[data-mejora]').forEach((b) => {
      const m = j.config.mejoras.find((x) => x.id === b.dataset.mejora)!
      b.disabled = e.recurso < m.coste
    })

    // Prestigio: reconstruir solo si cambia algo visible.
    const ganables = j.prestigioGanable()
    const siguiente = j.historicoParaSiguientePrestigio()
    const firmaPrestigio = `${e.prestigio}|${e.vidas}|${ganables}|${fmt(siguiente)}|${fmt(e.historico)}`
    if (firmaPrestigio === this.ultimoPrestigio) return
    this.ultimoPrestigio = firmaPrestigio
    const bonus = Math.round(e.prestigio * j.config.prestigio.bonus * 100)
    this.raiz.querySelector<HTMLElement>('#prestigio')!.innerHTML = `
      <div class="prestigio__info">
        <strong>${t.prestigioEmoji} ${t.prestigioNombre}: <span class="mono">${e.prestigio}</span></strong>
        <span class="muted">+${bonus}% producción · ${t.prestigioVida} nº ${e.vidas + 1}</span>
        <span class="muted">Siguiente ${t.prestigioUnidad} a <span class="mono">${fmt(siguiente)}</span> ${t.recurso} históricas (<span class="mono">${fmt(e.historico)}</span>)</span>
      </div>
      <button id="btn-prestigio" class="btn-prestigio" ${ganables > 0 ? '' : 'disabled'}>
        ${t.prestigioAccion}${ganables > 0 ? ` (+${ganables} ${t.prestigioEmoji})` : ''}
      </button>
    `
  }

  private set(sel: string, texto: string) {
    const el = this.raiz.querySelector(sel)
    if (el && el.textContent !== texto) el.textContent = texto
  }
}
