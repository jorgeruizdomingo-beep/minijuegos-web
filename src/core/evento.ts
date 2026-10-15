/**
 * Evento sorpresa común: cada cierto tiempo aparece un botón sobre la escena
 * (miga dorada, llamarada…) y, si se pincha antes de que desaparezca,
 * multiplica la producción durante unos segundos. Lo activa cada juego
 * con `Config.evento`; el multiplicador vive en `Incremental.multiplicadorTemporal`.
 */
import type { EventoConfig, Incremental } from './incremental'

export type Evento = {
  tick(dt: number): void
  /** Segundos de bonus que quedan (0 si no está activo). */
  readonly activoSeg: number
}

export function iniciarEvento(
  cfg: EventoConfig,
  juego: Incremental,
  escena: HTMLElement,
  alAtrapar: (cfg: EventoConfig) => void,
): Evento {
  let fase: 'espera' | 'visible' | 'activo' = 'espera'
  let resta = espera()
  let boton: HTMLButtonElement | null = null
  let badge: HTMLElement | null = null

  function espera() {
    return cfg.esperaMinSeg + Math.random() * (cfg.esperaMaxSeg - cfg.esperaMinSeg)
  }

  function mostrar() {
    boton = document.createElement('button')
    boton.className = 'evento'
    boton.type = 'button'
    boton.title = `${cfg.nombre}: producción x${cfg.mult} durante ${cfg.duracionSeg} s`
    boton.setAttribute('aria-label', boton.title)
    boton.innerHTML = `<span class="evento__emoji">${cfg.emoji}</span><span class="evento__anillo"></span>`
    // Posición aleatoria dentro de la escena, sin pegarse a los bordes.
    boton.style.left = `${12 + Math.random() * 70}%`
    boton.style.top = `${12 + Math.random() * 66}%`
    boton.style.setProperty('--visible', `${cfg.visibleSeg}s`)
    boton.addEventListener('pointerdown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      atrapar()
    })
    escena.appendChild(boton)
  }

  function quitarBoton() {
    boton?.remove()
    boton = null
  }

  function atrapar() {
    quitarBoton()
    fase = 'activo'
    resta = cfg.duracionSeg
    juego.multiplicadorTemporal = cfg.mult
    badge = document.createElement('div')
    badge.className = 'evento-activo'
    escena.appendChild(badge)
    pintarBadge()
    alAtrapar(cfg)
  }

  function pintarBadge() {
    if (badge) badge.textContent = `${cfg.emoji} x${cfg.mult} · ${Math.ceil(resta)} s`
  }

  function terminar() {
    juego.multiplicadorTemporal = 1
    badge?.remove()
    badge = null
    fase = 'espera'
    resta = espera()
  }

  return {
    get activoSeg() {
      return fase === 'activo' ? resta : 0
    },
    tick(dt: number) {
      resta -= dt
      if (fase === 'espera' && resta <= 0) {
        fase = 'visible'
        resta = cfg.visibleSeg
        mostrar()
      } else if (fase === 'visible' && resta <= 0) {
        quitarBoton()
        fase = 'espera'
        resta = espera()
      } else if (fase === 'activo') {
        pintarBadge()
        if (resta <= 0) terminar()
      }
    },
  }
}
