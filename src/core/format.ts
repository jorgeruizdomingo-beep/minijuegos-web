const SUFIJOS = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

/** Formatea cantidades grandes de forma corta: 1234 → "1,23k". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 0) return '-' + fmt(-n)
  if (n < 1000) return n < 10 && n !== Math.floor(n) ? n.toFixed(1) : Math.floor(n).toString()
  const exp = Math.min(Math.floor(Math.log10(n) / 3), SUFIJOS.length - 1)
  const mant = n / 10 ** (exp * 3)
  return mant.toFixed(mant < 10 ? 2 : mant < 100 ? 1 : 0).replace('.', ',') + SUFIJOS[exp]
}

/** Formatea una tasa por segundo. */
export function fmtRate(n: number): string {
  return `${fmt(n)}/s`
}

/** Formatea una duración en segundos: 3725 → "1h 2m". */
export function fmtDuration(s: number): string {
  s = Math.floor(s)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}
