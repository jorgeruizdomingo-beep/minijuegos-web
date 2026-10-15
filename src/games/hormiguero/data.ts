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
  // Miga dorada: cada 2-4 minutos aparece sobre la escena; si la pinchas, x7 durante 30 s.
  evento: { nombre: 'Miga dorada', emoji: '🍪', esperaMinSeg: 120, esperaMaxSeg: 240, visibleSeg: 12, duracionSeg: 30, mult: 7 },
  // Árbol permanente: se paga con ámbar, que da cada fundación de colonia
  // (1 + ⌊log2(feromonas ganadas + 1)⌋: crece despacio aunque las feromonas se disparen). Tres ramas: Cría (arranque y producción),
  // Comercio (descuentos y clic) y Saber (tiempo fuera, ámbar y el nido visible).
  arbol: {
    fichaNombre: 'ámbar',
    fichaPlural: 'ámbares',
    fichaEmoji: '🟠',
    fichasPorReinicio: (ganados) => 1 + Math.floor(Math.log2(ganados + 1)),
    nodos: [
      // Raíz
      { id: 'memoria', nombre: 'Memoria de la colonia', descripcion: 'Las nuevas reinas recuerdan dónde estaba la mesa. Producción x1,25.', emoji: '🧠', coste: 1, efecto: { tipo: 'global', mult: 1.25 } },

      // Rama Cría: cada colonia nueva nace con ventaja
      { id: 'huevos', nombre: 'Huevos de reserva', descripcion: 'Cada colonia nace con diez obreras ya criadas.', emoji: '🥚', coste: 2, requiere: ['memoria'], efecto: { tipo: 'arranque', edificio: 'obrera', cantidad: 10 } },
      { id: 'nodrizas', nombre: 'Nodrizas', descripcion: 'Cada colonia nace con cinco exploradoras.', emoji: '🍼', coste: 4, requiere: ['huevos'], efecto: { tipo: 'arranque', edificio: 'exploradora', cantidad: 5 } },
      { id: 'dinastia', nombre: 'Dinastía', descripcion: 'La estirpe de reinas mejora con cada generación. Producción x1,5.', emoji: '👑', coste: 10, requiere: ['nodrizas'], efecto: { tipo: 'global', mult: 1.5 } },
      { id: 'estandarte', nombre: 'Estandarte', descripcion: 'La colonia iza un banderín junto a la entrada. Visible en el mapa.', emoji: '🚩', coste: 3, requiere: ['huevos'], efecto: { tipo: 'desbloqueo', clave: 'estandarte' } },

      // Rama Comercio: comprar sale más barato y el clic vale más
      { id: 'regateo', nombre: 'Regateo con pulgones', descripcion: 'Todo lo que compras sale un 10 % más barato.', emoji: '🤝', coste: 2, requiere: ['memoria'], efecto: { tipo: 'descuento', porcentaje: 0.1 } },
      { id: 'mandibulas', nombre: 'Mandíbulas de ámbar', descripcion: 'Cada clic recoge el triple.', emoji: '💎', coste: 4, requiere: ['regateo'], efecto: { tipo: 'click', mult: 3 } },
      { id: 'mercado', nombre: 'Mercado de migas', descripcion: 'Otro 10 % de descuento en todo lo que compras.', emoji: '🏪', coste: 8, requiere: ['regateo'], efecto: { tipo: 'descuento', porcentaje: 0.1 } },
      { id: 'trueque', nombre: 'Trueque universal', descripcion: 'Otro 15 % de descuento: más de un tercio menos en total.', emoji: '⚖️', coste: 15, requiere: ['mercado'], efecto: { tipo: 'descuento', porcentaje: 0.15 } },
      { id: 'empedrado', nombre: 'Camino empedrado', descripcion: 'Las obreras pavimentan el rastro con piedrecitas. Visible en el mapa.', emoji: '🪨', coste: 5, requiere: ['mercado'], efecto: { tipo: 'desbloqueo', clave: 'empedrado' } },

      // Rama Saber: trabajar sin ti y recordar más
      { id: 'sueno', nombre: 'Sueño ligero', descripcion: 'La colonia sigue trabajando cuatro horas más mientras no miras.', emoji: '🌙', coste: 3, requiere: ['memoria'], efecto: { tipo: 'offline', horas: 4 } },
      { id: 'jardin', nombre: 'Jardín real', descripcion: 'Flores alrededor del nido, con abejas de visita. Visible en el mapa.', emoji: '🌸', coste: 5, requiere: ['sueno'], efecto: { tipo: 'desbloqueo', clave: 'jardin' } },
      { id: 'abundancia', nombre: 'Abundancia', descripcion: 'Cada fundación deja un 50 % más de ámbar.', emoji: '🟠', coste: 6, requiere: ['sueno'], efecto: { tipo: 'fichas', porcentaje: 0.5 } },
      { id: 'faro', nombre: 'Farolillo de resina', descripcion: 'Una luz en el nido que alumbra el rastro de noche. Visible en el mapa.', emoji: '🏮', coste: 8, requiere: ['jardin'], efecto: { tipo: 'desbloqueo', clave: 'faro' } },
      { id: 'hibernacion', nombre: 'Hibernación', descripcion: 'La colonia sigue trabajando doce horas más mientras no miras.', emoji: '❄️', coste: 12, requiere: ['abundancia'], efecto: { tipo: 'offline', horas: 12 } },

      // Cima: requiere las tres ramas
      { id: 'ancestral', nombre: 'Mente ancestral', descripcion: 'Todas las colonias que fueron piensan con la de ahora. Producción x2.', emoji: '🌌', coste: 30, requiere: ['dinastia', 'trueque', 'hibernacion'], efecto: { tipo: 'global', mult: 2 } },
    ],
  },
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
