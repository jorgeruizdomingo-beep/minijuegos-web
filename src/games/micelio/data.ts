import { mejorasDeEdificio, type Config, type Edificio, type Mejora } from '../../core/incremental'
import type { Textos } from '../../core/ui-incremental'

// Cadena de producción: solo las hifas dan nutrientes; cada eslabón genera el de abajo.
const EDIFICIOS: Edificio[] = [
  { id: 'hifa', nombre: 'Hifa', descripcion: 'Un filamento que absorbe nutrientes del suelo.', emoji: '🧵', costeBase: 10, produccion: 1 },
  { id: 'micelio', nombre: 'Micelio', descripcion: 'Una maraña que teje hifas nuevas.', emoji: '🕸️', costeBase: 250, produccion: 0.25, genera: 'hifa' },
  { id: 'seta', nombre: 'Seta', descripcion: 'Brota y extiende el micelio a su alrededor.', emoji: '🍄', costeBase: 15_000, produccion: 0.15, genera: 'micelio' },
  { id: 'anillo', nombre: 'Anillo de hadas', descripcion: 'Un círculo de setas que no deja de abrirse.', emoji: '⭕', costeBase: 2_000_000, produccion: 0.1, genera: 'seta' },
  { id: 'bosque', nombre: 'Bosque simbiótico', descripcion: 'Los árboles te alimentan a cambio de agua: brotan anillos.', emoji: '🌳', costeBase: 500_000_000, produccion: 0.07, genera: 'anillo' },
  { id: 'red', nombre: 'Red de raíces', descripcion: 'Conecta bosques enteros bajo tierra.', emoji: '🌐', costeBase: 300_000_000_000, produccion: 0.05, genera: 'bosque' },
]

const MEJORAS: Mejora[] = [
  // Clic
  { id: 'click_1', nombre: 'Enzimas', descripcion: 'Cada clic absorbe el doble.', emoji: '🧪', coste: 100, condicion: { tipo: 'clicks', cantidad: 25 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_2', nombre: 'Puntas finas', descripcion: 'Cada clic absorbe el doble.', emoji: '📍', coste: 3_000, condicion: { tipo: 'clicks', cantidad: 150 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_prod_1', nombre: 'Pulso nutritivo', descripcion: 'Cada clic añade un 2% de tu producción por segundo.', emoji: '💓', coste: 50_000, condicion: { tipo: 'clicks', cantidad: 400 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.02 } },
  { id: 'click_prod_2', nombre: 'Latido del bosque', descripcion: 'Cada clic añade otro 3% de tu producción por segundo.', emoji: '🥁', coste: 50_000_000, condicion: { tipo: 'clicks', cantidad: 1_500 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.03 } },

  // Globales (multiplican los nutrientes, no los eslabones)
  { id: 'global_1', nombre: 'Humedad constante', descripcion: 'Toda la producción +10%.', emoji: '💧', coste: 20_000, condicion: { tipo: 'total', cantidad: 10_000 }, efecto: { tipo: 'global', mult: 1.1 } },
  { id: 'global_2', nombre: 'Hojarasca rica', descripcion: 'Toda la producción +15%.', emoji: '🍂', coste: 5_000_000, condicion: { tipo: 'total', cantidad: 2_000_000 }, efecto: { tipo: 'global', mult: 1.15 } },
  { id: 'global_3', nombre: 'Simbiosis', descripcion: 'Toda la producción +20%.', emoji: '🤝', coste: 2_000_000_000, condicion: { tipo: 'total', cantidad: 1_000_000_000 }, efecto: { tipo: 'global', mult: 1.2 } },
  { id: 'global_4', nombre: 'Mente fúngica', descripcion: 'Toda la producción +25%.', emoji: '🧠', coste: 1e12, condicion: { tipo: 'total', cantidad: 5e11 }, efecto: { tipo: 'global', mult: 1.25 } },

  // Por eslabón (x2 al comprar 1, 10 y 50)
  ...mejorasDeEdificio(EDIFICIOS[0], ['Paredes de quitina', 'Puntas absorbentes', 'Hifas gruesas']),
  ...mejorasDeEdificio(EDIFICIOS[1], ['Tejido denso', 'Nudos de crecimiento', 'Micelio blanco']),
  ...mejorasDeEdificio(EDIFICIOS[2], ['Sombrero ancho', 'Láminas finas', 'Setas gigantes']),
  ...mejorasDeEdificio(EDIFICIOS[3], ['Círculo perfecto', 'Noche de luna', 'Anillo de anillos']),
  ...mejorasDeEdificio(EDIFICIOS[4], ['Raíces compartidas', 'Árboles madre', 'Bosque primario']),
  ...mejorasDeEdificio(EDIFICIOS[5], ['Señales químicas', 'Internet del bosque', 'Continente fúngico']),
]

export const CONFIG: Config = {
  claveGuardado: 'micelio',
  versionGuardado: 1,
  edificios: EDIFICIOS,
  mejoras: MEJORAS,
  crecimientoCoste: 1.2,
  prestigio: { base: 1e11, bonus: 0.05 },
  maxOfflineSeg: 8 * 3600,
}

/** Evento de lluvia: aparece cada cierto tiempo y, si se pincha, multiplica la producción. */
export const LLUVIA = {
  esperaMinSeg: 120,
  esperaMaxSeg: 240,
  visibleSeg: 15, // tiempo que la nube espera a que la pinches
  duracionSeg: 30,
  mult: 3,
}

export const TEXTOS: Textos = {
  recurso: 'nutrientes',
  tienda: 'Cadena',
  accionClick: 'Absorber nutrientes',
  prestigioNombre: 'Esporas',
  prestigioEmoji: '✨',
  prestigioUnidad: 'espora',
  prestigioVida: 'bosque',
  prestigioAccion: 'Soltar esporas',
  sinMejoras: 'Sigue creciendo: las mejoras aparecen al alcanzar hitos.',
}
