export type Juego = {
  id: string
  nombre: string
  lema: string
  descripcion: string
  ruta: string
  emoji: string
  etiquetas: string[]
  disponible: boolean
  /** Clave de guardado del juego (la misma que `Config.claveGuardado`), para leer el progreso desde la portada. */
  clave?: string
  /** Nombre del recurso principal, para mostrar el progreso guardado. */
  recurso?: string
}

export const JUEGOS: Juego[] = [
  {
    id: 'hormiguero',
    nombre: 'Hormiguero',
    lema: 'Una miga. Luego mil. Luego una colonia.',
    descripcion:
      'Clicker incremental: recoge migas, recluta obreras, excava túneles y funda nuevas colonias para multiplicar tu producción.',
    ruta: 'games/hormiguero/',
    clave: 'hormiguero',
    recurso: 'migas',
    emoji: '🐜',
    etiquetas: ['incremental', 'clicker', 'idle'],
    disponible: true,
  },
  {
    id: 'orbita',
    nombre: 'Órbita',
    lema: 'Cada compra, un satélite nuevo en el cielo.',
    descripcion:
      'Incremental 3D: acumula energía estelar y llena la órbita de tu planeta de satélites, estaciones y anillos.',
    ruta: 'games/orbita/',
    clave: 'orbita',
    recurso: 'energía',
    emoji: '🪐',
    etiquetas: ['incremental', '3D', 'idle'],
    disponible: true,
  },
  {
    id: 'micelio',
    nombre: 'Micelio',
    lema: 'Cada eslabón hace crecer al de abajo.',
    descripcion:
      'Incremental de cadenas: las setas tejen micelio, el micelio teje hifas y las hifas absorben nutrientes. Pincha la lluvia cuando aparezca.',
    ruta: 'games/micelio/',
    clave: 'micelio',
    recurso: 'nutrientes',
    emoji: '🍄',
    etiquetas: ['incremental', 'cadenas', 'idle'],
    disponible: true,
  },
]
