/**
 * Arranque común de un juego incremental: carga, interfaz, clic, guardado,
 * botones de cabecera y bucle principal. Cada juego aporta su escena.
 */
import { Incremental, type Config } from './incremental'
import { UIIncremental, type Textos } from './ui-incremental'
import { autoguardado } from './save'
import { fmt, fmtDuration } from './format'

export type Escena = {
  /** Ajusta la escena al tamaño de la "población" (edificios totales). */
  poblacion(n: number): void
  /** Efecto visual en el punto de clic (coordenadas relativas a la escena). */
  clic(x: number, y: number): void
  frame(dt: number): void
}

export function toast(texto: string, ms = 4000) {
  const toasts = document.getElementById('toasts')!
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = texto
  toasts.appendChild(el)
  setTimeout(() => el.classList.add('toast--fuera'), ms)
  setTimeout(() => el.remove(), ms + 400)
}

export function arrancar(config: Config, textos: Textos, crearEscena: (canvas: HTMLCanvasElement, juego: Incremental) => Escena) {
  const raiz = document.getElementById('juego')!
  const { juego, offline } = Incremental.cargar(config)
  let escena: Escena

  const ui = new UIIncremental(raiz, juego, textos, {
    comprarEdificio(id, cantidad) {
      const n = cantidad === 'max' ? juego.maxComprable(id) : cantidad
      if (juego.comprarEdificio(id, n)) ui.refrescar()
    },
    comprarMejora(id) {
      if (juego.comprarMejora(id)) {
        ui.refrescar()
        toast('Mejora comprada 🎉', 2000)
      }
    },
    prestigiar() {
      const ganables = juego.prestigioGanable()
      if (ganables <= 0) return
      const bonus = Math.round(ganables * config.prestigio.bonus * 100)
      const ok = confirm(
        `${textos.prestigioAccion} reinicia ${textos.recurso}, edificios y mejoras.\nA cambio ganas ${ganables} ${textos.prestigioUnidad}(s): +${bonus}% de producción para siempre.\n\n¿Seguimos?`,
      )
      if (!ok) return
      juego.prestigiar()
      juego.guardar()
      ui.refrescar()
      escena.poblacion(0)
      toast(`${textos.prestigioAccion}: hecho. ${textos.prestigioNombre}: ${juego.estado.prestigio} ${textos.prestigioEmoji}`, 5000)
    },
  })

  escena = crearEscena(ui.canvas, juego)

  if (offline && offline.recurso >= 1) {
    toast(`Mientras no estabas (${fmtDuration(offline.segundos)}) se produjeron ${fmt(offline.recurso)} ${textos.recurso}.`, 7000)
  }

  ui.botonClick.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    const n = juego.click()
    const r = ui.canvas.getBoundingClientRect()
    const x = ev.clientX - r.left
    const y = ev.clientY - r.top
    escena.clic(x, y)
    ui.flotante(x, y, `+${fmt(n)}`)
    ui.refrescar()
  })
  ui.botonClick.addEventListener('contextmenu', (ev) => ev.preventDefault())

  document.getElementById('btn-guardar')?.addEventListener('click', () => {
    juego.guardar()
    toast('Partida guardada 💾', 1500)
  })
  document.getElementById('btn-reiniciar')?.addEventListener('click', () => {
    if (!confirm(`¿Borrar toda la partida, incluidas las ${textos.prestigioNombre.toLowerCase()}? No se puede deshacer.`)) return
    juego.reiniciarTodo()
    location.reload()
  })

  const pararAutoguardado = autoguardado(() => juego.guardar())
  window.addEventListener('pagehide', pararAutoguardado, { once: true })

  const tituloBase = document.title
  let ultimo = performance.now()
  let acumUI = 0
  function bucle(ahora: number) {
    const dt = Math.min(1, (ahora - ultimo) / 1000)
    ultimo = ahora
    juego.tick(dt)
    escena.poblacion(juego.totalEdificios())
    escena.frame(dt)
    acumUI += dt
    if (acumUI >= 0.1) {
      acumUI = 0
      ui.refrescar()
      document.title = `${fmt(juego.estado.recurso)} ${textos.recurso} · ${tituloBase}`
    }
    requestAnimationFrame(bucle)
  }
  ui.refrescar()
  requestAnimationFrame(bucle)
}
