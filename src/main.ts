import './base.css'
import './portada.css'
import { JUEGOS } from './core/catalog'

const app = document.getElementById('app')!

app.innerHTML = `
  <section class="hero">
    <h1>Juegos que crecen solos</h1>
    <p class="muted">Incrementales, clickers e idle. Guardado automático en tu navegador, con progreso mientras estás fuera.</p>
  </section>
  <section class="grid">
    ${JUEGOS.map(
      (j) => `
      <a class="card ${j.disponible ? '' : 'card--soon'}" href="${j.disponible ? j.ruta : '#'}" ${j.disponible ? '' : 'aria-disabled="true"'}>
        <div class="card__emoji">${j.emoji}</div>
        <div class="card__body">
          <h2>${j.nombre}${j.disponible ? '' : ' <span class="tag tag--soon">pronto</span>'}</h2>
          <p class="card__lema">${j.lema}</p>
          <p class="muted">${j.descripcion}</p>
          <div class="tags">${j.etiquetas.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        </div>
      </a>`,
    ).join('')}
  </section>
`
