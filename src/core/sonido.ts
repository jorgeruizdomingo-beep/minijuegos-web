/**
 * Efectos de sonido sintetizados con Web Audio: sin ficheros, sin descargas.
 * El contexto se crea en el primer gesto del usuario (los navegadores lo exigen).
 */

const CLAVE_SILENCIO = 'vjw:silencio'

let ctx: AudioContext | null = null
let silencio = leerSilencio()

function leerSilencio(): boolean {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === '1'
  } catch {
    return false
  }
}

export function estaSilenciado(): boolean {
  return silencio
}

export function alternarSilencio(): boolean {
  silencio = !silencio
  try {
    localStorage.setItem(CLAVE_SILENCIO, silencio ? '1' : '0')
  } catch {
    // sin almacenamiento: se olvida al recargar
  }
  return silencio
}

/** Llamar en el primer pointerdown/keydown para desbloquear el audio. */
export function activarAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
}

type Nota = { f: number; t: number; dur: number; tipo?: OscillatorType; vol?: number }

function tocar(notas: Nota[]) {
  if (silencio || !ctx || ctx.state !== 'running') return
  const ahora = ctx.currentTime
  for (const n of notas) {
    const osc = ctx.createOscillator()
    const gan = ctx.createGain()
    osc.type = n.tipo ?? 'sine'
    osc.frequency.setValueAtTime(n.f, ahora + n.t)
    const v = n.vol ?? 0.12
    gan.gain.setValueAtTime(0, ahora + n.t)
    gan.gain.linearRampToValueAtTime(v, ahora + n.t + 0.01)
    gan.gain.exponentialRampToValueAtTime(0.0001, ahora + n.t + n.dur)
    osc.connect(gan).connect(ctx.destination)
    osc.start(ahora + n.t)
    osc.stop(ahora + n.t + n.dur + 0.02)
  }
}

let ultimoClick = 0

export const sonidos = {
  /** Blip corto; el tono sube ligeramente con clics seguidos. */
  click() {
    const ahora = performance.now()
    const rapido = ahora - ultimoClick < 250
    ultimoClick = ahora
    tocar([{ f: rapido ? 520 + Math.random() * 120 : 440, t: 0, dur: 0.07, tipo: 'triangle', vol: 0.08 }])
  },
  compra() {
    tocar([
      { f: 330, t: 0, dur: 0.08, tipo: 'square', vol: 0.06 },
      { f: 495, t: 0.07, dur: 0.1, tipo: 'square', vol: 0.06 },
    ])
  },
  mejora() {
    tocar([
      { f: 392, t: 0, dur: 0.1 },
      { f: 494, t: 0.08, dur: 0.1 },
      { f: 587, t: 0.16, dur: 0.18 },
    ])
  },
  logro() {
    tocar([
      { f: 523, t: 0, dur: 0.12 },
      { f: 659, t: 0.1, dur: 0.12 },
      { f: 784, t: 0.2, dur: 0.12 },
      { f: 1047, t: 0.3, dur: 0.35 },
    ])
  },
  prestigio() {
    const notas: Nota[] = []
    for (let i = 0; i < 12; i++) notas.push({ f: 220 * 2 ** (i / 6), t: i * 0.05, dur: 0.12, tipo: 'sawtooth', vol: 0.05 })
    notas.push({ f: 880, t: 0.65, dur: 0.6, vol: 0.1 })
    tocar(notas)
  },
}
