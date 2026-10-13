export type Edificio = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  costeBase: number
  produccion: number // migas por segundo por unidad
}

export const CRECIMIENTO_COSTE = 1.15

export const EDIFICIOS: Edificio[] = [
  { id: 'obrera', nombre: 'Obrera', descripcion: 'Recoge migas bajo la mesa.', emoji: '🐜', costeBase: 15, produccion: 0.1 },
  { id: 'exploradora', nombre: 'Exploradora', descripcion: 'Encuentra rutas nuevas hacia la despensa.', emoji: '🔍', costeBase: 100, produccion: 1 },
  { id: 'cortadora', nombre: 'Cortadora de hojas', descripcion: 'Trae hojas enteras a la colonia.', emoji: '🍃', costeBase: 1_100, produccion: 8 },
  { id: 'granero', nombre: 'Granero', descripcion: 'Almacena y fermenta semillas.', emoji: '🌾', costeBase: 12_000, produccion: 47 },
  { id: 'tunel', nombre: 'Túnel', descripcion: 'Conecta el nido con nuevas cocinas.', emoji: '🕳️', costeBase: 130_000, produccion: 260 },
  { id: 'hongos', nombre: 'Jardín de hongos', descripcion: 'Cultivo propio: comida sin salir.', emoji: '🍄', costeBase: 1_400_000, produccion: 1_400 },
  { id: 'reina', nombre: 'Reina secundaria', descripcion: 'Pone huevos sin parar.', emoji: '👑', costeBase: 20_000_000, produccion: 7_800 },
  { id: 'aliado', nombre: 'Hormiguero aliado', descripcion: 'Una colonia vecina te envía tributo.', emoji: '🤝', costeBase: 330_000_000, produccion: 44_000 },
  { id: 'supercolonia', nombre: 'Supercolonia', descripcion: 'Kilómetros de túneles bajo la ciudad.', emoji: '🌍', costeBase: 5_100_000_000, produccion: 260_000 },
]

export type EfectoMejora =
  | { tipo: 'click'; mult: number }
  | { tipo: 'edificio'; id: string; mult: number }
  | { tipo: 'global'; mult: number }
  | { tipo: 'clickPorcentajeProd'; porcentaje: number }

export type CondicionMejora =
  | { tipo: 'edificio'; id: string; cantidad: number }
  | { tipo: 'clicks'; cantidad: number }
  | { tipo: 'totalMigas'; cantidad: number }

export type Mejora = {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  coste: number
  condicion: CondicionMejora
  efecto: EfectoMejora
}

// Para cada edificio: tres niveles de mejora (x2) al llegar a 1, 10 y 50 unidades.
function mejorasEdificio(e: Edificio, nombres: [string, string, string]): Mejora[] {
  const umbrales = [1, 10, 50]
  const multCoste = [10, 50, 500]
  return umbrales.map((u, i) => ({
    id: `${e.id}_${i + 1}`,
    nombre: nombres[i],
    descripcion: `${e.nombre}: producción x2.`,
    emoji: e.emoji,
    coste: e.costeBase * multCoste[i],
    condicion: { tipo: 'edificio', id: e.id, cantidad: u },
    efecto: { tipo: 'edificio', id: e.id, mult: 2 },
  }))
}

export const MEJORAS: Mejora[] = [
  // Clic
  { id: 'click_1', nombre: 'Mandíbulas fuertes', descripcion: 'Cada clic recoge el doble.', emoji: '💪', coste: 100, condicion: { tipo: 'clicks', cantidad: 25 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_2', nombre: 'Patas rápidas', descripcion: 'Cada clic recoge el doble.', emoji: '⚡', coste: 2_500, condicion: { tipo: 'clicks', cantidad: 150 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_3', nombre: 'Antenas afinadas', descripcion: 'Cada clic recoge el doble.', emoji: '📡', coste: 50_000, condicion: { tipo: 'clicks', cantidad: 500 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_prod_1', nombre: 'Clic coordinado', descripcion: 'Cada clic añade un 1% de tu producción por segundo.', emoji: '🎯', coste: 500_000, condicion: { tipo: 'clicks', cantidad: 1_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.01 } },
  { id: 'click_prod_2', nombre: 'Clic en enjambre', descripcion: 'Cada clic añade otro 1% de tu producción por segundo.', emoji: '🌪️', coste: 50_000_000, condicion: { tipo: 'clicks', cantidad: 3_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.01 } },

  // Globales
  { id: 'global_1', nombre: 'Feromonas de rastro', descripcion: 'Toda la producción +10%.', emoji: '🧪', coste: 10_000, condicion: { tipo: 'totalMigas', cantidad: 5_000 }, efecto: { tipo: 'global', mult: 1.1 } },
  { id: 'global_2', nombre: 'Rutas optimizadas', descripcion: 'Toda la producción +15%.', emoji: '🗺️', coste: 1_000_000, condicion: { tipo: 'totalMigas', cantidad: 500_000 }, efecto: { tipo: 'global', mult: 1.15 } },
  { id: 'global_3', nombre: 'Turnos de noche', descripcion: 'Toda la producción +20%.', emoji: '🌙', coste: 100_000_000, condicion: { tipo: 'totalMigas', cantidad: 50_000_000 }, efecto: { tipo: 'global', mult: 1.2 } },
  { id: 'global_4', nombre: 'Mente colmena', descripcion: 'Toda la producción +25%.', emoji: '🧠', coste: 10_000_000_000, condicion: { tipo: 'totalMigas', cantidad: 5_000_000_000 }, efecto: { tipo: 'global', mult: 1.25 } },

  // Por edificio
  ...mejorasEdificio(EDIFICIOS[0], ['Cestas de hoja', 'Doble turno', 'Obreras veteranas']),
  ...mejorasEdificio(EDIFICIOS[1], ['Mapas de olor', 'Patrullas dobles', 'Exploradoras élite']),
  ...mejorasEdificio(EDIFICIOS[2], ['Mandíbulas de sierra', 'Cadena de corte', 'Hojas gigantes']),
  ...mejorasEdificio(EDIFICIOS[3], ['Silos secos', 'Fermentación lenta', 'Granero doble']),
  ...mejorasEdificio(EDIFICIOS[4], ['Vigas de raíz', 'Túneles anchos', 'Red subterránea']),
  ...mejorasEdificio(EDIFICIOS[5], ['Esporas selectas', 'Clima perfecto', 'Hongos luminosos']),
  ...mejorasEdificio(EDIFICIOS[6], ['Jalea real', 'Cámaras reales', 'Dinastía']),
  ...mejorasEdificio(EDIFICIOS[7], ['Tratado de migas', 'Embajadoras', 'Federación']),
  ...mejorasEdificio(EDIFICIOS[8], ['Metro hormiga', 'Ciudad bajo ciudad', 'Imperio']),
]

/** Producción extra por feromona (prestigio): +5% cada una. */
export const BONUS_FEROMONA = 0.05

/** Migas totales necesarias para la primera feromona; luego raíz cuadrada. */
export const BASE_FEROMONA = 10_000_000

/** Progreso offline máximo que se abona. */
export const MAX_OFFLINE_SEG = 8 * 3600
