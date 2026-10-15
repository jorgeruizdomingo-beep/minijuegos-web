import '../../base.css'
import '../../core/incremental.css'
import './style.css'
import { arrancar } from '../../core/arranque'
import { CONFIG, TEXTOS } from './data'
import { EscenaMicelio } from './render'
import { fmt, fmtRate } from '../../core/format'

const { juego } = arrancar(CONFIG, TEXTOS, (canvas, juego) => new EscenaMicelio(canvas, juego))

// Tira de la cadena bajo el contador: cuántas unidades hay de cada eslabón y a qué ritmo crecen.
const tira = document.createElement('div')
tira.className = 'cadena muted'
document.querySelector('.contador')!.after(tira)
const eslabones = [...CONFIG.edificios].reverse()
function refrescarTira() {
  const partes: string[] = []
  for (const e of eslabones) {
    const n = juego.cantidad(e.id)
    if (n < 1 && !e.genera) continue
    const generador = CONFIG.edificios.find((g) => g.genera === e.id)
    const ritmo = generador ? juego.produccionEdificio(generador.id) : 0
    if (n < 1 && ritmo <= 0) continue
    partes.push(`<span class="cadena__eslabon" title="${e.nombre}">${e.emoji} <b class="mono">${fmt(Math.floor(n))}</b>${ritmo > 0 ? ` <small class="mono">+${fmtRate(ritmo)}</small>` : ''}</span>`)
  }
  const html = partes.length ? partes.join('<span class="cadena__flecha">→</span>') : 'Pincha la tierra para absorber nutrientes y compra tu primera hifa.'
  if (tira.innerHTML !== html) tira.innerHTML = html
}
refrescarTira()
setInterval(refrescarTira, 250)
