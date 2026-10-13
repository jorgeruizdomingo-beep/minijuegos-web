import { EDIFICIOS, MEJORAS } from './data'
import type { Juego } from './game'
import { fmt, fmtRate } from '../../core/format'

export type Cantidad = 1 | 10 | 100 | 'max'

type Acciones = {
  comprarEdificio: (id: string, cantidad: Cantidad) => void
  comprarMejora: (id: string) => void
  prestigiar: () => void
}

export class UI {
  private raiz: HTMLElement
  private juego: Juego
  private acciones: Acciones
  private cantidad: Cantidad = 1
  private filasEdificio = new Map<string, HTMLElement>()
  private ultimasMejoras = ''
  private ultimoPrestigio = ''

  constructor(raiz: HTMLElement, juego: Juego, acciones: Acciones) {
    this.raiz = raiz
    this.juego = juego
    this.acciones = acciones
    this.construir()
  }

  private construir() {
    this.raiz.innerHTML = `
      <section class="panel panel--escena">
        <div class="contador">
          <div class="contador__migas mono" id="migas">0</div>
          <div class="contador__sub muted"><span id="prod" class="mono">0/s</span> · <span id="porclick" class="mono">1</span> por clic</div>
        </div>
        <div class="escena">
          <canvas id="canvas"></canvas>
          <button id="btn-click" class="btn-click" aria-label="Recoger miga"></button>
        </div>
        <div class="prestigio" id="prestigio"></div>
      </section>
      <section class="panel panel--tienda">
        <div class="tienda__cab">
          <h2>Colonia</h2>
          <div class="cantidades" id="cantidades">
            <button data-cant="1" class="activo">x1</button>
            <button data-cant="10">x10</button>
            <button data-cant="100">x100</button>
            <button data-cant="max">máx</button>
          </div>
        </div>
        <div class="lista" id="edificios"></div>
        <h2>Mejoras</h2>
        <div class="mejoras" id="mejoras"><p class="muted">Sigue recogiendo migas: las mejoras aparecen al crecer.</p></div>
      </section>
    `

    const lista = this.raiz.querySelector<HTMLElement>('#edificios')!
    for (const e of EDIFICIOS) {
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

  /** Texto flotante "+N" sobre el punto de clic. */
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
    this.set('#migas', fmt(e.migas))
    this.set('#prod', fmtRate(j.produccionTotal()))
    this.set('#porclick', fmt(j.migasPorClick()))
    document.title = `${fmt(e.migas)} migas · Hormiguero`

    // Un edificio se muestra si ya tienes alguno o has acumulado parte de su coste.
    // El siguiente al último visible se enseña atenuado como anticipo.
    let anticipoMostrado = false
    for (const ed of EDIFICIOS) {
      const fila = this.filasEdificio.get(ed.id)!
      const n = e.edificios[ed.id] ?? 0
      const visible = ed === EDIFICIOS[0] || n > 0 || e.migasTotales >= ed.costeBase * 0.3
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
      const prodUnidad = ed.produccion * j.multiplicadorEdificio(ed.id) * j.multiplicadorGlobal()
      fila.querySelector('.edificio__prod')!.textContent =
        n > 0 ? `${fmtRate(prodUnidad)} cada una · ${fmtRate(j.produccionEdificio(ed.id))} en total` : `${fmtRate(prodUnidad)} cada una`
      ;(fila as HTMLButtonElement).disabled = e.migas < coste
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
        : `<p class="muted">Sigue creciendo: las mejoras aparecen al alcanzar hitos.</p>`
    }
    cont.querySelectorAll<HTMLButtonElement>('button[data-mejora]').forEach((b) => {
      const m = MEJORAS.find((x) => x.id === b.dataset.mejora)!
      b.disabled = e.migas < m.coste
    })

    // Prestigio
    const ganables = j.feromonasGanables()
    const siguiente = j.migasParaSiguienteFeromona()
    const firmaPrestigio = `${e.feromonas}|${e.colonias}|${ganables}|${fmt(siguiente)}|${fmt(e.migasHistoricas)}`
    if (firmaPrestigio === this.ultimoPrestigio) return
    this.ultimoPrestigio = firmaPrestigio
    this.raiz.querySelector<HTMLElement>('#prestigio')!.innerHTML = `
      <div class="prestigio__info">
        <strong>🧪 Feromonas: <span class="mono">${e.feromonas}</span></strong>
        <span class="muted">+${Math.round(e.feromonas * 5)}% producción · colonia nº ${e.colonias + 1}</span>
        <span class="muted">Siguiente feromona a <span class="mono">${fmt(siguiente)}</span> migas históricas (<span class="mono">${fmt(e.migasHistoricas)}</span>)</span>
      </div>
      <button id="btn-prestigio" class="btn-prestigio" ${ganables > 0 ? '' : 'disabled'}>
        Fundar nueva colonia${ganables > 0 ? ` (+${ganables} 🧪)` : ''}
      </button>
    `
  }

  private set(sel: string, texto: string) {
    const el = this.raiz.querySelector(sel)
    if (el && el.textContent !== texto) el.textContent = texto
  }
}
