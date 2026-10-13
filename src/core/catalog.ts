export type Juego = {
  id: string
  nombre: string
  lema: string
  descripcion: string
  ruta: string
  emoji: string
  etiquetas: string[]
  disponible: boolean
}

export const JUEGOS: Juego[] = [
  {
    id: 'hormiguero',
    nombre: 'Hormiguero',
    lema: 'Una miga. Luego mil. Luego una colonia.',
    descripcion:
      'Clicker incremental: recoge migas, recluta obreras, excava túneles y funda nuevas colonias para multiplicar tu producción.',
    ruta: 'games/hormiguero/',
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
    emoji: '🪐',
    etiquetas: ['incremental', '3D', 'idle'],
    disponible: false,
  },
]
