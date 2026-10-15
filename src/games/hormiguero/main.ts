import '../../base.css'
import '../../core/incremental.css'
import './style.css'
import { arrancar, toast } from '../../core/arranque'
import { CONFIG, TEXTOS } from './data'
import { EscenaHormiguero } from './render'

const { juego } = arrancar(CONFIG, TEXTOS, (canvas, juego) => new EscenaHormiguero(canvas, juego))

// Primera partida: una pista de qué hacer.
if (juego.estado.total === 0 && juego.estado.vidas === 0) {
  toast('Toca la escena para recoger migas. Con 15 reclutas tu primera obrera, que recoge sola.', 9000)
}
