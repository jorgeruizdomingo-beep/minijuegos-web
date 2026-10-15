import { mejorasDeEdificio, type Config, type Edificio, type Mejora } from '../../core/incremental'
import type { Textos } from '../../core/ui-incremental'

const EDIFICIOS: Edificio[] = [
  { id: 'obrera', nombre: 'Obrera', descripcion: 'Recoge migas bajo la mesa.', emoji: '🐜', costeBase: 15, produccion: 0.1 },
  { id: 'exploradora', nombre: 'Exploradora', descripcion: 'Encuentra rutas nuevas hacia la despensa.', emoji: '🔍', costeBase: 100, produccion: 1 },
  { id: 'cortadora', nombre: 'Cortadora de hojas', descripcion: 'Trae hojas enteras a la colonia.', emoji: '🍃', costeBase: 1_100, produccion: 8 },
  { id: 'granero', nombre: 'Granero', descripcion: 'Almacena y fermenta semillas.', emoji: '🌾', costeBase: 12_000, produccion: 47 },
  { id: 'tunel', nombre: 'Túnel', descripcion: 'Conecta el nido con nuevas cocinas.', emoji: '🕳️', costeBase: 130_000, produccion: 260 },
  { id: 'hongos', nombre: 'Jardín de hongos', descripcion: 'Cultivo propio: comida sin salir.', emoji: '🍄', costeBase: 1_400_000, produccion: 1_400 },
  { id: 'reina', nombre: 'Reina secundaria', descripcion: 'Pone huevos sin parar.', emoji: '👑', costeBase: 20_000_000, produccion: 7_800 },
  { id: 'aliado', nombre: 'Hormiguero aliado', descripcion: 'Una colonia vecina te envía tributo.', emoji: '🤝', costeBase: 330_000_000, produccion: 44_000 },
  { id: 'supercolonia', nombre: 'Supercolonia', descripcion: 'Kilómetros de túneles bajo la ciudad.', emoji: '🌍', costeBase: 5_100_000_000, produccion: 260_000 },
  { id: 'metropoli', nombre: 'Metrópolis hormiga', descripcion: 'Rascacielos de tierra con ascensores de savia.', emoji: '🏙️', costeBase: 75_000_000_000, produccion: 1_500_000 },
  { id: 'cosmica', nombre: 'Colonia cósmica', descripcion: 'Migas de otros planetas, por correo orbital.', emoji: '🚀', costeBase: 1_000_000_000_000, produccion: 7_500_000 },
]

/** Mejoras extra de un edificio para partidas largas (x2 al llegar a 100 y 200 unidades). */
function mejorasTardias(e: Edificio, nombres: [string, string]): Mejora[] {
  const umbrales = [100, 200]
  const multCoste = [5_000, 50_000]
  return umbrales.map((u, i) => ({
    id: `${e.id}_${i + 4}`,
    nombre: nombres[i],
    descripcion: `${e.nombre}: producción x2.`,
    emoji: e.emoji,
    coste: e.costeBase * multCoste[i],
    condicion: { tipo: 'edificio', id: e.id, cantidad: u },
    efecto: { tipo: 'edificio', id: e.id, mult: 2 },
  }))
}

const MEJORAS: Mejora[] = [
  // Clic
  { id: 'click_1', nombre: 'Mandíbulas fuertes', descripcion: 'Cada clic recoge el doble.', emoji: '💪', coste: 100, condicion: { tipo: 'clicks', cantidad: 25 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_2', nombre: 'Patas rápidas', descripcion: 'Cada clic recoge el doble.', emoji: '⚡', coste: 2_500, condicion: { tipo: 'clicks', cantidad: 150 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_3', nombre: 'Antenas afinadas', descripcion: 'Cada clic recoge el doble.', emoji: '📡', coste: 50_000, condicion: { tipo: 'clicks', cantidad: 500 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_prod_1', nombre: 'Clic coordinado', descripcion: 'Cada clic añade un 1% de tu producción por segundo.', emoji: '🎯', coste: 500_000, condicion: { tipo: 'clicks', cantidad: 1_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.01 } },
  { id: 'click_prod_2', nombre: 'Clic en enjambre', descripcion: 'Cada clic añade otro 1% de tu producción por segundo.', emoji: '🌪️', coste: 50_000_000, condicion: { tipo: 'clicks', cantidad: 3_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.01 } },
  { id: 'click_4', nombre: 'Mandíbulas de acero', descripcion: 'Cada clic recoge el doble.', emoji: '🦾', coste: 5_000_000_000, condicion: { tipo: 'clicks', cantidad: 7_500 }, efecto: { tipo: 'click', mult: 2 } },
  { id: 'click_prod_3', nombre: 'Clic de la reina', descripcion: 'Cada clic añade otro 2% de tu producción por segundo.', emoji: '👑', coste: 500_000_000_000, condicion: { tipo: 'clicks', cantidad: 15_000 }, efecto: { tipo: 'clickPorcentajeProd', porcentaje: 0.02 } },

  // Globales
  { id: 'global_1', nombre: 'Feromonas de rastro', descripcion: 'Toda la producción +10%.', emoji: '🧪', coste: 10_000, condicion: { tipo: 'total', cantidad: 5_000 }, efecto: { tipo: 'global', mult: 1.1 } },
  { id: 'global_2', nombre: 'Rutas optimizadas', descripcion: 'Toda la producción +15%.', emoji: '🗺️', coste: 1_000_000, condicion: { tipo: 'total', cantidad: 500_000 }, efecto: { tipo: 'global', mult: 1.15 } },
  { id: 'global_3', nombre: 'Turnos de noche', descripcion: 'Toda la producción +20%.', emoji: '🌙', coste: 100_000_000, condicion: { tipo: 'total', cantidad: 50_000_000 }, efecto: { tipo: 'global', mult: 1.2 } },
  { id: 'global_4', nombre: 'Mente colmena', descripcion: 'Toda la producción +25%.', emoji: '🧠', coste: 10_000_000_000, condicion: { tipo: 'total', cantidad: 5_000_000_000 }, efecto: { tipo: 'global', mult: 1.25 } },
  { id: 'global_5', nombre: 'Imperio subterráneo', descripcion: 'Toda la producción +30%.', emoji: '🏛️', coste: 1_000_000_000_000, condicion: { tipo: 'total', cantidad: 500_000_000_000 }, efecto: { tipo: 'global', mult: 1.3 } },
  { id: 'global_6', nombre: 'Conciencia cósmica', descripcion: 'Toda la producción +50%.', emoji: '🌌', coste: 100_000_000_000_000, condicion: { tipo: 'total', cantidad: 50_000_000_000_000 }, efecto: { tipo: 'global', mult: 1.5 } },

  // Por edificio
  ...mejorasDeEdificio(EDIFICIOS[0], ['Cestas de hoja', 'Doble turno', 'Obreras veteranas']),
  ...mejorasDeEdificio(EDIFICIOS[1], ['Mapas de olor', 'Patrullas dobles', 'Exploradoras élite']),
  ...mejorasDeEdificio(EDIFICIOS[2], ['Mandíbulas de sierra', 'Cadena de corte', 'Hojas gigantes']),
  ...mejorasDeEdificio(EDIFICIOS[3], ['Silos secos', 'Fermentación lenta', 'Granero doble']),
  ...mejorasDeEdificio(EDIFICIOS[4], ['Vigas de raíz', 'Túneles anchos', 'Red subterránea']),
  ...mejorasDeEdificio(EDIFICIOS[5], ['Esporas selectas', 'Clima perfecto', 'Hongos luminosos']),
  ...mejorasDeEdificio(EDIFICIOS[6], ['Jalea real', 'Cámaras reales', 'Dinastía']),
  ...mejorasDeEdificio(EDIFICIOS[7], ['Tratado de migas', 'Embajadoras', 'Federación']),
  ...mejorasDeEdificio(EDIFICIOS[8], ['Metro hormiga', 'Ciudad bajo ciudad', 'Imperio']),
  ...mejorasDeEdificio(EDIFICIOS[9], ['Ascensores de savia', 'Barrios colgantes', 'Capital del hormiguero']),
  ...mejorasDeEdificio(EDIFICIOS[10], ['Cohetes de semilla', 'Estación migaja', 'Terraformadoras']),

  // Tardías (100 y 200 unidades)
  ...mejorasTardias(EDIFICIOS[0], ['Legión obrera', 'Marea negra']),
  ...mejorasTardias(EDIFICIOS[1], ['Cartografía total', 'Nada sin descubrir']),
  ...mejorasTardias(EDIFICIOS[2], ['Deforestación amable', 'Selva portátil']),
  ...mejorasTardias(EDIFICIOS[3], ['Cosecha eterna', 'Montañas de grano']),
  ...mejorasTardias(EDIFICIOS[4], ['Autopistas de tierra', 'Núcleo del planeta']),
  ...mejorasTardias(EDIFICIOS[5], ['Bosque de esporas', 'Micelio infinito']),
  ...mejorasTardias(EDIFICIOS[6], ['Corte real', 'Matriarcado']),
  ...mejorasTardias(EDIFICIOS[7], ['Liga de colonias', 'Paz de las migas']),
  ...mejorasTardias(EDIFICIOS[8], ['Continente hormiga', 'Pangea']),
  ...mejorasTardias(EDIFICIOS[9], ['Megalópolis', 'Ecumenópolis']),
  ...mejorasTardias(EDIFICIOS[10], ['Enjambre estelar', 'Galaxia de migas']),
]

export const CONFIG: Config = {
  claveGuardado: 'hormiguero',
  versionGuardado: 2,
  edificios: EDIFICIOS,
  mejoras: MEJORAS,
  crecimientoCoste: 1.15,
  prestigio: { base: 10_000_000, bonus: 0.05 },
  maxOfflineSeg: 8 * 3600,
}

export const TEXTOS: Textos = {
  recurso: 'migas',
  tienda: 'Colonia',
  accionClick: 'Recoger miga',
  prestigioNombre: 'Feromonas',
  prestigioEmoji: '🧪',
  prestigioUnidad: 'feromona',
  prestigioVida: 'colonia',
  prestigioAccion: 'Fundar nueva colonia',
  sinMejoras: 'Sigue creciendo: las mejoras aparecen al alcanzar hitos.',
}
