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
import { iniciarEvento, type Evento } from './evento'
import { abrirPanelArbol } from './arbol'

export type Escena = {
  /** Ajusta la escena al tamaño de la "población" (edificios totales). */
  poblacion(n: number): void
  /** Efecto visual en el punto de clic (coordenadas relativas a la escena). */
  clic(x: number, y: number): void
  frame(dt: number): void
  /**
   * Opcional: algo ha cambiado en la partida (compra de edificio o mejora, nodo
   * del árbol, prestigio, carga). La escena lee del juego (`cantidad`, `tieneMejora`,
   * `tieneDesbloqueo`, `desbloqueos`) y adapta el mapa.
   */
  cambio?(motivo: 'carga' | 'edificio' | 'mejora' | 'nodo' | 'prestigio'): void
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
  let logros!: Logros
  // Los logros se leen antes de abonar el tiempo fuera para que su bonus cuente también offline.
  const { juego, offline } = Incremental.cargar(config, (j) => {
    logros = new Logros(j, textos)
    j.bonusLogros = logros.bonus
  })
  let escena: Escena

  const ui = new UIIncremental(raiz, juego, textos, {
    comprarEdificio(id, cantidad) {
      const n = cantidad === 'max' ? juego.maxComprable(id) : cantidad
      if (juego.comprarEdificio(id, n)) {
        sonidos.compra()
        ui.refrescar()
        ui.destacarEdificio(id)
        escena.cambio?.('edificio')
      }
    },
    comprarMejora(id) {
      if (juego.comprarMejora(id)) {
        sonidos.mejora()
        ui.refrescar()
        toast('Mejora comprada 🎉', 2000)
        escena.cambio?.('mejora')
      }
    },
    prestigiar() {
      const ganables = juego.prestigioGanable()
      if (ganables <= 0) return
      const bonus = Math.round(ganables * config.prestigio.bonus * 100)
      const fichas = juego.fichasAlReiniciar()
      const lineaFichas = config.arbol && fichas > 0 ? `\nAdemás recibes ${fichas} ${fichas === 1 ? config.arbol.fichaNombre : config.arbol.fichaPlural} ${config.arbol.fichaEmoji} para el árbol permanente.` : ''
      const ok = confirm(
        `${textos.prestigioAccion} reinicia ${textos.recurso}, edificios y mejoras.\nA cambio ganas ${ganables} ${textos.prestigioUnidad}(s): +${bonus}% de producción para siempre.${lineaFichas}\n\n¿Seguimos?`,
      )
      if (!ok) return
      juego.prestigiar()
      juego.guardar()
      sonidos.prestigio()
      ui.refrescar()
      escena.poblacion(juego.totalEdificios())
      escena.cambio?.('prestigio')
      refrescarBotonArbol()
      toast(`${textos.prestigioAccion}: hecho. ${textos.prestigioNombre}: ${juego.estado.prestigio} ${textos.prestigioEmoji}${fichas > 0 && config.arbol ? ` · +${fichas} ${config.arbol.fichaEmoji}` : ''}`, 5000)
    },
  })

  escena = crearEscena(ui.canvas, juego)
  escena.cambio?.('carga')

  let evento: Evento | null = null
  if (config.evento) {
    evento = iniciarEvento(config.evento, juego, ui.canvas.parentElement!, (ev) => {
      sonidos.logro()
      toast(`${ev.emoji} ¡${ev.nombre}! Producción x${ev.mult} durante ${ev.duracionSeg} s`, 3000)
      ui.refrescar()
    })
  }

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
  // Árbol permanente: solo si el juego lo declara; si no, el botón se oculta.
  const btnArbol = document.getElementById('btn-arbol')
  const refrescarBotonArbol = () => {
    if (!btnArbol) return
    if (!config.arbol) {
      btnArbol.hidden = true
      return
    }
    btnArbol.hidden = false
    btnArbol.textContent = `${config.arbol.fichaEmoji} ${juego.fichas}`
    btnArbol.title = `Árbol permanente: ${juego.fichas} ${juego.fichas === 1 ? config.arbol.fichaNombre : config.arbol.fichaPlural} sin gastar`
    btnArbol.classList.toggle('btn-arbol--aviso', juego.fichas > 0 && config.arbol.nodos.some((n) => juego.nodoDisponible(n.id) && n.coste <= juego.fichas))
  }
  refrescarBotonArbol()
  btnArbol?.addEventListener('click', () => {
    if (!config.arbol) return
    abrirPanelArbol(juego, (n) => {
      sonidos.mejora()
      juego.guardar()
      ui.refrescar()
      refrescarBotonArbol()
      escena.cambio?.('nodo')
      toast(`${n.emoji} ${n.nombre}: comprado para siempre`, 3000)
    })
  })

  const tituloBase = document.title
  let ultimo = performance.now()
  let acumUI = 0
  let acumLogros = 0
  function bucle(ahora: number) {
    const dt = Math.min(1, (ahora - ultimo) / 1000)
    ultimo = ahora
    evento?.tick(dt)
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
        juego.bonusLogros = logros.bonus
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
