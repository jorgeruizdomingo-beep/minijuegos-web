import { mejorasDeEdificio, type Config, type Edificio, type Mejora } from '../../core/incremental'
import type { Textos } from '../../core/ui-incremental'

const EDIFICIOS: Edificio[] = [
  { id: 'panel', nombre: 'Panel solar', descripcion: 'Una placa en órbita baja. Humilde, pero suma.', emoji: '🔆', costeBase: 15, produccion: 0.1 },
  { id: 'sonda', nombre: 'Sonda', descripcion: 'Explora y manda datos que valen energía.', emoji: '🛰️', costeBase: 100, produccion: 1 },
  { id: 'rele', nombre: 'Satélite de relé', descripcion: 'Concentra y retransmite la energía recogida.', emoji: '📡', costeBase: 1_100, produccion: 8 },
  { id: 'estacion', nombre: 'Estación orbital', descripcion: 'Tripulación permanente manteniendo la red.', emoji: '🏗️', costeBase: 12_000, produccion: 47 },
  { id: 'minero', nombre: 'Minero de asteroides', descripcion: 'Trae roca rica en isótopos.', emoji: '🪨', costeBase: 130_000, produccion: 260 },
  { id: 'luna', nombre: 'Luna artificial', descripcion: 'Un reactor del tamaño de una luna.', emoji: '🌕', costeBase: 1_400_000, produccion: 1_400 },
  { id: 'espejos', nombre: 'Anillo de espejos', descripcion: 'Refleja la luz de la estrella hacia tus colectores.', emoji: '💍', costeBase: 20_000_000, produccion: 7_800 },
  { id: 'colector', nombre: 'Colector estelar', descripcion: 'Velas kilométricas que beben del viento solar.', emoji: '⛵', costeBase: 330_000_000, produccion: 44_000 },
  { id: 'dyson', nombre: 'Segmento Dyson', descripcion: 'Un trozo de cáscara alrededor de la estrella.', emoji: '🌞', costeBase: 5_100_000_000, produccion: 260_000 },
]

const MEJORAS: Mejora[] = [
  // Clic (llamaradas)
  { id: 'click_1', nombre: 'Llamarada guiada', descripcion: 'Cada clic genera el doble.', emoji: '🔥', coste: 100, condicion: { tipo: 'clicks', cantidad: 25 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_2', nombre: 'Eyección de masa', descripcion: 'Cada clic genera el doble.', emoji: '💥', coste: 2_500, condicion: { tipo: 'clicks', cantidad: 150 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_3', nombre: 'Lente gravitatoria', descripcion: 'Cada clic genera el doble.', emoji: '🔭', coste: 50_000, condicion: { tipo: 'clicks', cantidad: 500 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_prod_1', nombre: 'Resonancia orbital', descripcion: 'Cada clic añade un 1% de tu producción por segundo.', emoji: '🎯', coste: 50_000, condicion: { tipo: 'clicks', cantidad: 300 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.01 } },
  { id: 'click_prod_2', nombre: 'Pulso coherente', descripcion: 'Cada clic añade otro 2% de tu producción por segundo.', emoji: '🌀', coste: 5_000_000, condicion: { tipo: 'clicks', cantidad: 1_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.02 } },
  { id: 'click_prod_3', nombre: 'Tormenta coronal', descripcion: 'Cada clic añade otro 3% de tu producción por segundo.', emoji: '🌪️', coste: 500_000_000, condicion: { tipo: 'clicks', cantidad: 3_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.03 } },

  // Globales
  { id: 'global_1', nombre: 'Superconductores', descripcion: 'Toda la producción +10%.', emoji: '🧲', coste: 10_000, condicion: { tipo: 'total', cantidad: 5_000 }, efecto: { tipo: 'global', mult: 1.1 } },
  { id: 'global_2', nombre: 'Red de microondas', descripcion: 'Toda la producción +15%.', emoji: '📶', coste: 1_000_000, condicion: { tipo: 'total', cantidad: 500_000 }, efecto: { tipo: 'global', mult: 1.15 } },
  { id: 'global_3', nombre: 'IA de control orbital', descripcion: 'Toda la producción +20%.', emoji: '🤖', coste: 100_000_000, condicion: { tipo: 'total', cantidad: 50_000_000 }, efecto: { tipo: 'global', mult: 1.2 } },
  { id: 'global_4', nombre: 'Fusión aneutrónica', descripcion: 'Toda la producción +25%.', emoji: '⚛️', coste: 10_000_000_000, condicion: { tipo: 'total', cantidad: 5_000_000_000 }, efecto: { tipo: 'global', mult: 1.25 } },
  { id: 'global_5', nombre: 'Agujero de gusano', descripcion: 'Toda la producción +30%.', emoji: '🕳️', coste: 1_000_000_000_000, condicion: { tipo: 'total', cantidad: 500_000_000_000 }, efecto: { tipo: 'global', mult: 1.3 } },
  { id: 'global_6', nombre: 'Motor estelar', descripcion: 'Toda la producción +50%.', emoji: '🚀', coste: 100_000_000_000_000, condicion: { tipo: 'total', cantidad: 50_000_000_000_000 }, efecto: { tipo: 'global', mult: 1.5 } },

  // Por edificio
  ...mejorasDeEdificio(EDIFICIOS[0], ['Células de perovskita', 'Paneles plegables', 'Seguimiento solar']),
  ...mejorasDeEdificio(EDIFICIOS[1], ['Sondas gemelas', 'Antenas de alta ganancia', 'Enjambre de sondas']),
  ...mejorasDeEdificio(EDIFICIOS[2], ['Relé láser', 'Malla de relés', 'Relé cuántico']),
  ...mejorasDeEdificio(EDIFICIOS[3], ['Módulo extra', 'Gravedad artificial', 'Astilleros orbitales']),
  ...mejorasDeEdificio(EDIFICIOS[4], ['Taladros de plasma', 'Refinería orbital', 'Captura de cometas']),
  ...mejorasDeEdificio(EDIFICIOS[5], ['Núcleo de torio', 'Corteza reflectante', 'Luna doble']),
  ...mejorasDeEdificio(EDIFICIOS[6], ['Espejos adaptativos', 'Anillo cerrado', 'Foco estelar']),
  ...mejorasDeEdificio(EDIFICIOS[7], ['Velas de grafeno', 'Velas en tándem', 'Flota de colectores']),
  ...mejorasDeEdificio(EDIFICIOS[8], ['Segmentos enlazados', 'Media cáscara', 'Esfera completa']),

  // Fase tardía: con 100 y 200 unidades de un edificio, dos saltos más (x2 y x3).
  ...EDIFICIOS.flatMap((e) => mejorasTardias(e)),
]

/** Mejoras de fase tardía de un edificio: x2 con 100 unidades y x3 con 200. */
function mejorasTardias(e: Edificio): Mejora[] {
  return [
    { id: `${e.id}_4`, nombre: `${e.nombre}: producción en serie`, descripcion: `${e.nombre}: producción x2.`, emoji: e.emoji, coste: e.costeBase * 5_000, condicion: { tipo: 'edificio', id: e.id, cantidad: 100 }, efecto: { tipo: 'edificio', id: e.id, mult: 2 } },
    { id: `${e.id}_5`, nombre: `${e.nombre}: diseño definitivo`, descripcion: `${e.nombre}: producción x3.`, emoji: e.emoji, coste: e.costeBase * 100_000, condicion: { tipo: 'edificio', id: e.id, cantidad: 200 }, efecto: { tipo: 'edificio', id: e.id, mult: 3 } },
  ]
}

export const CONFIG: Config = {
  claveGuardado: 'orbita',
  versionGuardado: 1,
  edificios: EDIFICIOS,
  mejoras: MEJORAS,
  crecimientoCoste: 1.15,
  prestigio: { base: 1_000_000, bonus: 0.1 },
  maxOfflineSeg: 8 * 3600,
  // Evento sorpresa del motor. Se llama "tormenta" y no "llamarada" para no confundirlo con el clic.
  evento: { nombre: 'Tormenta solar', emoji: '🌞', esperaMinSeg: 120, esperaMaxSeg: 240, visibleSeg: 12, duracionSeg: 30, mult: 7 },
  // Árbol permanente: se compra con fragmentos estelares, que da cada Supernova.
  arbol: {
    fichaNombre: 'fragmento estelar',
    fichaPlural: 'fragmentos estelares',
    fichaEmoji: '💠',
    nodos: [
      // Raíz
      { id: 'memoria', nombre: 'Memoria orbital', descripcion: 'Cada sistema nuevo hereda los planos del anterior: producción +25 %.', emoji: '🧠', coste: 1, efecto: { tipo: 'global', mult: 1.25 } },

      // Rama Ingeniería: arranque, precios y el aspecto del planeta.
      { id: 'astilleros', nombre: 'Astilleros heredados', descripcion: 'Cada sistema empieza con 10 paneles solares ya en órbita.', emoji: '🏗️', coste: 2, requiere: ['memoria'], efecto: { tipo: 'arranque', edificio: 'panel', cantidad: 10 } },
      { id: 'contratos', nombre: 'Contratos estelares', descripcion: 'Todo lo que compras sale un 10 % más barato.', emoji: '📜', coste: 2, requiere: ['memoria'], efecto: { tipo: 'descuento', porcentaje: 0.1 } },
      { id: 'anillos', nombre: 'Anillos planetarios', descripcion: 'El planeta luce un sistema de anillos. Visible en la escena.', emoji: '🪐', coste: 3, requiere: ['astilleros'], efecto: { tipo: 'desbloqueo', clave: 'anillos' } },
      { id: 'monopolio', nombre: 'Monopolio orbital', descripcion: 'Otro 15 % de descuento en todos los edificios.', emoji: '🏦', coste: 5, requiere: ['contratos'], efecto: { tipo: 'descuento', porcentaje: 0.15 } },

      // Rama Estrella: el clic y el aspecto de la estrella y el cielo.
      { id: 'corona', nombre: 'Corona activa', descripcion: 'Las llamaradas son tres veces más potentes: cada clic x3.', emoji: '🔥', coste: 2, requiere: ['memoria'], efecto: { tipo: 'click', mult: 3 } },
      { id: 'nebulosa', nombre: 'Nebulosa', descripcion: 'El sistema nace dentro de una nebulosa. Visible en la escena.', emoji: '🌌', coste: 3, requiere: ['corona'], efecto: { tipo: 'desbloqueo', clave: 'nebulosa' } },
      { id: 'gigante', nombre: 'Gigante azul', descripcion: 'La estrella se convierte en una gigante azul, más grande y brillante. Visible en la escena.', emoji: '💙', coste: 4, requiere: ['nebulosa'], efecto: { tipo: 'desbloqueo', clave: 'estrella_azul' } },

      // Rama Legado: tiempo fuera, fragmentos y una luna.
      { id: 'cronometro', nombre: 'Cronómetro orbital', descripcion: 'La red sigue produciendo cuatro horas más mientras no miras.', emoji: '⏱️', coste: 3, requiere: ['memoria'], efecto: { tipo: 'offline', horas: 4 } },
      { id: 'luna', nombre: 'Luna capturada', descripcion: 'Una luna natural orbita el planeta. Visible en la escena.', emoji: '🌙', coste: 3, requiere: ['cronometro'], efecto: { tipo: 'desbloqueo', clave: 'luna' } },
      { id: 'cosecha', nombre: 'Cosecha de supernovas', descripcion: 'Cada Supernova deja un 50 % más de fragmentos.', emoji: '💎', coste: 4, requiere: ['cronometro'], efecto: { tipo: 'fichas', porcentaje: 0.5 } },

      // Cima: exige las tres ramas.
      { id: 'motor', nombre: 'Motor estelar', descripcion: 'Toda la estrella trabaja para ti: producción x2.', emoji: '🚀', coste: 8, requiere: ['anillos', 'gigante', 'cosecha'], efecto: { tipo: 'global', mult: 2 } },
    ],
  },
}

export const TEXTOS: Textos = {
  recurso: 'energía',
  tienda: 'Órbita',
  accionClick: 'Provocar llamarada',
  prestigioNombre: 'Núcleos',
  prestigioEmoji: '⭐',
  prestigioUnidad: 'núcleo',
  prestigioVida: 'sistema',
  prestigioAccion: 'Supernova',
  sinMejoras: 'Sigue acumulando energía: las mejoras aparecen al alcanzar hitos.',
}

/** Apariencia de cada edificio en la escena 3D: radio de órbita (para 'segmento', radio de la cáscara alrededor de la estrella), tamaño, color, velocidad y forma. */
export type Apariencia = {
  radio: number
  tamano: number
  color: number
  velocidad: number // radianes por segundo
  inclinacion: number // radianes
  forma: 'panel' | 'esfera' | 'cubo' | 'toro' | 'roca' | 'vela' | 'segmento'
}

export const APARIENCIAS: Record<string, Apariencia> = {
  panel: { radio: 2.0, tamano: 0.07, color: 0x4fa3ff, velocidad: 0.9, inclinacion: 0.1, forma: 'panel' },
  sonda: { radio: 2.6, tamano: 0.06, color: 0xdddddd, velocidad: 0.7, inclinacion: 0.4, forma: 'esfera' },
  rele: { radio: 3.2, tamano: 0.09, color: 0xffc857, velocidad: 0.55, inclinacion: -0.3, forma: 'cubo' },
  estacion: { radio: 3.8, tamano: 0.13, color: 0xb0b8c8, velocidad: 0.45, inclinacion: 0.65, forma: 'toro' },
  minero: { radio: 4.5, tamano: 0.11, color: 0x9a7b5a, velocidad: 0.35, inclinacion: -0.55, forma: 'roca' },
  luna: { radio: 5.3, tamano: 0.2, color: 0xe8e4d8, velocidad: 0.25, inclinacion: 0.2, forma: 'esfera' },
  espejos: { radio: 6.1, tamano: 0.12, color: 0xc9f0ff, velocidad: 0.2, inclinacion: 0.95, forma: 'panel' },
  colector: { radio: 7.0, tamano: 0.16, color: 0xffa54f, velocidad: 0.15, inclinacion: -0.75, forma: 'vela' },
  dyson: { radio: 2.4, tamano: 0.75, color: 0xff6b3d, velocidad: 0.12, inclinacion: 0.3, forma: 'segmento' },
}
