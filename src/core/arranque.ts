/**
 * Arranque común de un juego incremental: carga, interfaz, clic, guardado,
 * botones de cabecera y bucle principal. Cada juego aporta su escena.
 */
import { Incremental, type Config } from './incremental'
import { UIIncremental, type Textos } from './ui-incremental'
import { autoguardado } from './save'
import { fmt, fmtDuration } from './format'
import { Logros } from './logros'
import { activarAudio, alternarSilencio, estaSilenciado, sonidos } from './sonido'
import { abrirPanelPortar } from './portar'
import { abrirModal } from './modal'

export type Escena = {
  /** Ajusta la escena al tamaño de la "población" (edificios totales). */
  poblacion(n: number): void
  /** Efecto visual en el punto de clic (coordenadas relativas a la escena). */
  clic(x: number, y: number): void
  frame(dt: number): void
}

const MAX_TOASTS = 4

export function toast(texto: string, ms = 4000, clase = '') {
  const toasts = document.getElementById('toasts')!
  // Si se acumulan, los más antiguos se van antes de tiempo para no tapar la escena.
  while (toasts.children.length >= MAX_TOASTS) toasts.firstElementChild?.remove()
  const el = document.createElement('div')
  el.className = `toast ${clase}`
  el.textContent = texto
  toasts.appendChild(el)
  setTimeout(() => el.classList.add('toast--fuera'), ms)
  setTimeout(() => el.remove(), ms + 400)
}

export function arrancar(config: Config, textos: Textos, crearEscena: (canvas: HTMLCanvasElement, juego: Incremental) => Escena) {
  const raiz = document.getElementById('juego')!
  const { juego, offline } = Incremental.cargar(config)
  const logros = new Logros(juego, textos)
  let escena: Escena

  const ui = new UIIncremental(raiz, juego, textos, {
    comprarEdificio(id, cantidad) {
      const n = cantidad === 'max' ? juego.maxComprable(id) : cantidad
      if (juego.comprarEdificio(id, n)) {
        sonidos.compra()
        ui.refrescar()
        ui.destacarEdificio(id)
      }
    },
    comprarMejora(id) {
      if (juego.comprarMejora(id)) {
        sonidos.mejora()
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
      sonidos.prestigio()
      ui.refrescar()
      escena.poblacion(0)
      toast(`${textos.prestigioAccion}: hecho. ${textos.prestigioNombre}: ${juego.estado.prestigio} ${textos.prestigioEmoji}`, 5000)
    },
  })

  escena = crearEscena(ui.canvas, juego)

  if (offline && offline.recurso >= 1) {
    toast(`Mientras no estabas (${fmtDuration(offline.segundos)}) se produjeron ${fmt(offline.recurso)} ${textos.recurso}.`, 7000)
  }

  // El audio solo puede arrancar tras un gesto del usuario.
  document.addEventListener('pointerdown', activarAudio, { capture: true })
  document.addEventListener('keydown', activarAudio, { capture: true })

  ui.botonClick.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    const n = juego.click()
    const r = ui.canvas.getBoundingClientRect()
    const x = ev.clientX - r.left
    const y = ev.clientY - r.top
    escena.clic(x, y)
    ui.flotante(x, y, `+${fmt(n)}`)
    ui.pulsoContador()
    sonidos.click()
    ui.refrescar()
  })
  ui.botonClick.addEventListener('contextmenu', (ev) => ev.preventDefault())

  const pararAutoguardado = autoguardado(() => juego.guardar())
  window.addEventListener('pagehide', pararAutoguardado, { once: true })

  // Botones de cabecera
  document.getElementById('btn-guardar')?.addEventListener('click', () => {
    juego.guardar()
    toast('Partida guardada 💾', 1500)
  })
  document.getElementById('btn-reiniciar')?.addEventListener('click', () => {
    if (!confirm(`¿Borrar toda la partida, incluidas las ${textos.prestigioNombre.toLowerCase()}? No se puede deshacer.`)) return
    pararAutoguardado() // si no, el autoguardado al descargar la página restauraría la partida
    juego.reiniciarTodo()
    location.reload()
  })
  const btnLogros = document.getElementById('btn-logros')
  const refrescarBotonLogros = () => {
    if (btnLogros) btnLogros.textContent = `🏆 ${logros.cuenta}/${logros.lista.length}`
  }
  refrescarBotonLogros()
  btnLogros?.addEventListener('click', () => abrirModal('Logros', logros.panel()))
  const btnSonido = document.getElementById('btn-sonido')
  const refrescarBotonSonido = () => {
    if (btnSonido) btnSonido.textContent = estaSilenciado() ? '🔇' : '🔊'
  }
  refrescarBotonSonido()
  btnSonido?.addEventListener('click', () => {
    alternarSilencio()
    refrescarBotonSonido()
  })
  document.getElementById('btn-portar')?.addEventListener('click', () => abrirPanelPortar(juego, pararAutoguardado))

  const tituloBase = document.title
  let ultimo = performance.now()
  let acumUI = 0
  let acumLogros = 0
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
    acumLogros += dt
    if (acumLogros >= 1) {
      acumLogros = 0
      const nuevos = logros.comprobar()
      if (nuevos.length) {
        sonidos.logro()
        // Varios a la vez (partida cargada, vuelta tras horas): un solo aviso en vez de una pila.
        if (nuevos.length > 2) {
          const nombres = nuevos.slice(0, 3).map((l) => l.nombre).join(', ')
          const resto = nuevos.length - 3
          toast(`🏆 ${nuevos.length} logros nuevos: ${nombres}${resto > 0 ? ` y ${resto} más` : ''}`, 6000, 'toast--logro')
        }
        else for (const l of nuevos) toast(`${l.emoji} Logro: ${l.nombre}`, 4000, 'toast--logro')
        refrescarBotonLogros()
      }
    }
    requestAnimationFrame(bucle)
  }
  ui.refrescar()
  requestAnimationFrame(bucle)
  return { juego, ui, escena }
}
