import '../../base.css'
import './style.css'
import { Juego } from './game'
import { UI } from './ui'
import { Escena } from './render'
import { autoguardado } from '../../core/save'
import { fmt, fmtDuration } from '../../core/format'
import { EDIFICIOS } from './data'

const raiz = document.getElementById('juego')!
const toasts = document.getElementById('toasts')!

function toast(texto: string, ms = 4000) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = texto
  toasts.appendChild(el)
  setTimeout(() => el.classList.add('toast--fuera'), ms)
  setTimeout(() => el.remove(), ms + 400)
}

const { juego, offline } = Juego.cargar()

const ui = new UI(raiz, juego, {
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
    const ganables = juego.feromonasGanables()
    if (ganables <= 0) return
    const ok = confirm(
      `Fundar una nueva colonia reinicia migas, hormigas y mejoras.\nA cambio ganas ${ganables} feromona(s): +${ganables * 5}% de producción para siempre.\n\n¿Seguimos?`,
    )
    if (!ok) return
    juego.prestigiar()
    juego.guardar()
    ui.refrescar()
    escena.poblacion(0)
    toast(`Nueva colonia fundada. Feromonas: ${juego.estado.feromonas} 🧪`, 5000)
  },
})

const escena = new Escena(ui.canvas)

if (offline && offline.migas >= 1) {
  toast(`Mientras no estabas (${fmtDuration(offline.segundos)}) tus hormigas recogieron ${fmt(offline.migas)} migas.`, 7000)
}

// Clic principal
ui.botonClick.addEventListener('pointerdown', (ev) => {
  ev.preventDefault()
  const n = juego.click()
  const r = ui.canvas.getBoundingClientRect()
  const x = ev.clientX - r.left
  const y = ev.clientY - r.top
  escena.estallido(x, y)
  ui.flotante(x, y, `+${fmt(n)}`)
  ui.refrescar()
})
// Evita el zoom por doble toque en móvil y el menú contextual al mantener pulsado.
ui.botonClick.addEventListener('contextmenu', (ev) => ev.preventDefault())

// Guardar y reiniciar
document.getElementById('btn-guardar')!.addEventListener('click', () => {
  juego.guardar()
  toast('Partida guardada 💾', 1500)
})
document.getElementById('btn-reiniciar')!.addEventListener('click', () => {
  if (!confirm('¿Borrar toda la partida, incluidas las feromonas? No se puede deshacer.')) return
  Juego.reiniciarTodo()
  location.reload()
})

const pararAutoguardado = autoguardado(() => juego.guardar())
window.addEventListener('pagehide', pararAutoguardado, { once: true })

// Bucle principal
let ultimo = performance.now()
let acumUI = 0
function bucle(ahora: number) {
  const dt = Math.min(1, (ahora - ultimo) / 1000)
  ultimo = ahora
  juego.tick(dt)
  escena.poblacion(EDIFICIOS.reduce((s, e) => s + (juego.estado.edificios[e.id] ?? 0), 0))
  escena.frame(dt)
  acumUI += dt
  if (acumUI >= 0.1) {
    acumUI = 0
    ui.refrescar()
  }
  requestAnimationFrame(bucle)
}
ui.refrescar()
requestAnimationFrame(bucle)
