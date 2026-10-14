import '../../base.css'
import '../../core/incremental.css'
import './style.css'
import { arrancar } from '../../core/arranque'
import { CONFIG, TEXTOS } from './data'
import { EscenaMicelio } from './render'

arrancar(CONFIG, TEXTOS, (canvas, juego) => new EscenaMicelio(canvas, juego))
