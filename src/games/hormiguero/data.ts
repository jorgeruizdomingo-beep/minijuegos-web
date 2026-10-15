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

/** Texto propio de cada mejora de edificio (si no, el motor pone "X: producción x2"). */
const SABOR: Record<string, string> = {
  obrera_1: 'Cada obrera carga tres migas a la vez en una cesta de hoja. Obreras x2.',
  obrera_2: 'Las obreras ya no duermen: un turno recoge y el otro acarrea. Obreras x2.',
  obrera_3: 'Las que llevan mil viajes enseñan a las nuevas. Obreras x2.',
  obrera_4: 'Cien obreras forman una legión que arrasa cualquier mantel. Obreras x2.',
  obrera_5: 'Desde lejos la mesa parece moverse sola. Obreras x2.',
  exploradora_1: 'Marcan con olor la ruta más corta a cada despensa. Exploradoras x2.',
  exploradora_2: 'Dos patrullas cubren el doble de cocina. Exploradoras x2.',
  exploradora_3: 'Las mejores exploradoras huelen un bizcocho a tres casas. Exploradoras x2.',
  exploradora_4: 'Un mapa completo de la ciudad, migaja a migaja. Exploradoras x2.',
  exploradora_5: 'Ya no queda rincón del mundo sin olisquear. Exploradoras x2.',
  cortadora_1: 'Mandíbulas dentadas que cortan una hoja de un solo tajo. Cortadoras x2.',
  cortadora_2: 'Una corta, otra acarrea, otra apila: cadena de montaje. Cortadoras x2.',
  cortadora_3: 'Hojas de plátano enteras, traídas entre veinte. Cortadoras x2.',
  cortadora_4: 'Podan el jardín del vecino con esmero. Cortadoras x2.',
  cortadora_5: 'Donde pasa la colonia brota un bosque, y se lo llevan. Cortadoras x2.',
  granero_1: 'Silos ventilados: ni una semilla se pudre. Graneros x2.',
  granero_2: 'La fermentación lenta multiplica el alimento. Graneros x2.',
  granero_3: 'Dos plantas de granero por túnel. Graneros x2.',
  granero_4: 'Reservas para diez inviernos y una fiesta. Graneros x2.',
  granero_5: 'Montañas de grano visibles desde el jardín. Graneros x2.',
  tunel_1: 'Vigas de raíz que evitan derrumbes. Túneles x2.',
  tunel_2: 'Túneles de dos carriles: nadie se cruza. Túneles x2.',
  tunel_3: 'Una red que une todas las cocinas del barrio. Túneles x2.',
  tunel_4: 'Autopistas subterráneas con áreas de descanso. Túneles x2.',
  tunel_5: 'Han llegado al núcleo del planeta y está calentito. Túneles x2.',
  hongos_1: 'Solo se siembran las esporas más nutritivas. Hongos x2.',
  hongos_2: 'Humedad y temperatura perfectas en cada cámara. Hongos x2.',
  hongos_3: 'Hongos que brillan en la oscuridad: cultivo de noche. Hongos x2.',
  hongos_4: 'Un bosque de esporas bajo cada hormiguero. Hongos x2.',
  hongos_5: 'El micelio ya no tiene fin conocido. Hongos x2.',
  reina_1: 'Jalea real para que las reinas pongan el doble. Reinas x2.',
  reina_2: 'Cámaras reales con servicio permanente. Reinas x2.',
  reina_3: 'Una dinastía de reinas hermanas. Reinas x2.',
  reina_4: 'Corte real con consejeras, nodrizas y guardia. Reinas x2.',
  reina_5: 'Todas las decisiones las toman ellas, y aciertan. Reinas x2.',
  aliado_1: 'Un tratado de migas firmado con antenas. Aliados x2.',
  aliado_2: 'Embajadoras en cada colonia vecina. Aliados x2.',
  aliado_3: 'Federación de hormigueros con tributo anual. Aliados x2.',
  aliado_4: 'Liga de colonias: nadie se queda sin migas. Aliados x2.',
  aliado_5: 'La paz de las migas: ni una guerra en mil generaciones. Aliados x2.',
  supercolonia_1: 'Un metro hormiga que cruza la ciudad en minutos. Supercolonias x2.',
  supercolonia_2: 'Una ciudad entera bajo la ciudad. Supercolonias x2.',
  supercolonia_3: 'Un imperio con calzadas, puertos y aduanas de migas. Supercolonias x2.',
  supercolonia_4: 'Un continente conectado por un solo rastro. Supercolonias x2.',
  supercolonia_5: 'Las placas tectónicas se mueven por los túneles. Supercolonias x2.',
  metropoli_1: 'Ascensores de savia para subir las migas a los pisos altos. Metrópolis x2.',
  metropoli_2: 'Barrios colgantes de las ramas más altas. Metrópolis x2.',
  metropoli_3: 'La capital del hormiguero, con parlamento y opera. Metrópolis x2.',
  metropoli_4: 'Megalópolis: se tarda un día en cruzarla andando. Metrópolis x2.',
  metropoli_5: 'Ecumenópolis: toda la superficie es ciudad hormiga. Metrópolis x2.',
  cosmica_1: 'Cohetes de semilla con propulsión de feromonas. Colonias cósmicas x2.',
  cosmica_2: 'La estación Migaja orbita cada noventa minutos. Colonias cósmicas x2.',
  cosmica_3: 'Terraformadoras que convierten planetas en hormigueros. Colonias cósmicas x2.',
  cosmica_4: 'Un enjambre estelar que viaja de sol en sol. Colonias cósmicas x2.',
  cosmica_5: 'La galaxia es, vista de cerca, una miga enorme. Colonias cósmicas x2.',
}
for (const m of MEJORAS) if (SABOR[m.id]) m.descripcion = SABOR[m.id]

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
