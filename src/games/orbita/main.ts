import '../../base.css'
import '../../core/incremental.css'
import './style.css'
import { arrancar } from '../../core/arranque'
import { CONFIG, TEXTOS } from './data'
import { EscenaOrbita } from './render'

arrancar(CONFIG, TEXTOS, (canvas, juego) => new EscenaOrbita(canvas, juego))
