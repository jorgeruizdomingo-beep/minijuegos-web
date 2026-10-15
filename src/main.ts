import './base.css'
import './portada.css'
import { JUEGOS, type Juego } from './core/catalog'
import { fmt, fmtDuration } from './core/format'

type Progreso = { recurso: number; historico: number; prestigio: number; vidas: number; hace: number; logros: number }

/** Lee el guardado de un juego desde la portada (solo lectura; el formato es el de save.ts y logros.ts). */
function progresoDe(j: Juego): Progreso | null {
  if (!j.clave) return null
  try {
    const raw = localStorage.getItem(`vjw:${j.clave}`)
    if (!raw) return null
    const g = JSON.parse(raw) as { savedAt: number; data: { recurso: number; historico: number; prestigio: number; vidas: number } }
    const rawLogros = localStorage.getItem(`vjw:${j.clave}:logros`)
    const logros = rawLogros ? (JSON.parse(rawLogros) as string[]).length : 0
    return {
      recurso: g.data.recurso ?? 0,
      historico: g.data.historico ?? 0,
      prestigio: g.data.prestigio ?? 0,
      vidas: g.data.vidas ?? 0,
      hace: Math.max(0, (Date.now() - g.savedAt) / 1000),
      logros,
    }
  } catch {
    return null
  }
}

function tarjeta(j: Juego): string {
  const p = j.disponible ? progresoDe(j) : null
  const pie = p
    ? `<div class="card__progreso">
        <span>💾 ${fmt(p.recurso)} ${j.recurso ?? ''}</span>
        ${p.prestigio > 0 ? `<span>🌟 ${p.prestigio}</span>` : ''}
        ${p.logros > 0 ? `<span>🏆 ${p.logros}</span>` : ''}
        <span class="muted">${p.hace < 60 ? 'ahora mismo' : `hace ${fmtDuration(p.hace)}`}</span>
        <span class="card__cta">Continuar →</span>
      </div>`
    : j.disponible
      ? `<div class="card__progreso"><span class="muted">Sin partida</span><span class="card__cta">Jugar →</span></div>`
      : ''
  return `
    <a class="card ${j.disponible ? '' : 'card--soon'}" href="${j.disponible ? j.ruta : '#'}" ${j.disponible ? '' : 'aria-disabled="true"'}>
      <div class="card__emoji">${j.emoji}</div>
      <div class="card__body">
        <h2>${j.nombre}${j.disponible ? '' : ' <span class="tag tag--soon">pronto</span>'}</h2>
        <p class="card__lema">${j.lema}</p>
        <p class="muted">${j.descripcion}</p>
        <div class="tags">${j.etiquetas.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        ${pie}
      </div>
    </a>`
}

const app = document.getElementById('app')!

function pintar() {
  app.innerHTML = `
    <section class="hero">
      <h1>Juegos que crecen solos</h1>
      <p class="muted">Incrementales, clickers e idle. Guardado automático en tu navegador, con progreso mientras estás fuera.</p>
    </section>
    <section class="grid">${JUEGOS.map(tarjeta).join('')}</section>
    <footer class="pie muted">
      <span>Sin cuentas ni servidores: todo se guarda en este navegador.</span>
      <span>Desde cada juego puedes exportar la partida con 📤 y cargarla en otro dispositivo.</span>
    </footer>
  `
}

pintar()
// Al volver de un juego (pestaña restaurada desde la caché) se refresca el progreso.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) pintar()
})
