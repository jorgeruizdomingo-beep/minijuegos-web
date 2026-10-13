/**
 * Guardado común para todos los juegos: localStorage con versión y marca de tiempo.
 * Cada juego guarda bajo su propia clave y recibe el tiempo transcurrido desde la
 * última sesión para calcular progreso offline.
 */

const PREFIX = 'vjw:'

export type Guardado<T> = {
  version: number
  savedAt: number
  data: T
}

export function cargar<T>(clave: string, version: number): { data: T; elapsedSec: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + clave)
    if (!raw) return null
    const g = JSON.parse(raw) as Guardado<T>
    if (g.version !== version) return null
    const elapsedSec = Math.max(0, (Date.now() - g.savedAt) / 1000)
    return { data: g.data, elapsedSec }
  } catch {
    return null
  }
}

export function guardar<T>(clave: string, version: number, data: T): void {
  try {
    const g: Guardado<T> = { version, savedAt: Date.now(), data }
    localStorage.setItem(PREFIX + clave, JSON.stringify(g))
  } catch {
    // Sin almacenamiento disponible (modo privado, cuota llena): el juego sigue sin guardar.
  }
}

export function borrar(clave: string): void {
  try {
    localStorage.removeItem(PREFIX + clave)
  } catch {
    // ignorar
  }
}

/** Guarda periódicamente y al cerrar la pestaña. Devuelve una función para parar. */
export function autoguardado(fn: () => void, cadaMs = 10_000): () => void {
  const id = setInterval(fn, cadaMs)
  const onHide = () => {
    if (document.visibilityState === 'hidden') fn()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', fn)
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', fn)
  }
}
