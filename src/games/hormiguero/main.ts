import '../../base.css'
import '../../core/incremental.css'
import './style.css'
import { arrancar } from '../../core/arranque'
import { CONFIG, TEXTOS } from './data'
import { EscenaHormiguero } from './render'

arrancar(CONFIG, TEXTOS, (canvas, juego) => new EscenaHormiguero(canvas, juego))
