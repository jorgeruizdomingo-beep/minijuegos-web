/** Ventana modal mínima: un título, contenido HTML y cierre con Escape, botón o clic fuera. */

export function abrirModal(titulo: string, contenido: string | HTMLElement): HTMLElement {
  cerrarModal()
  const fondo = document.createElement('div')
  fondo.className = 'modal-fondo'
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${titulo}">
      <div class="modal__cab">
        <h2>${titulo}</h2>
        <button class="modal__cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal__cuerpo"></div>
    </div>
  `
  const cuerpo = fondo.querySelector<HTMLElement>('.modal__cuerpo')!
  if (typeof contenido === 'string') cuerpo.innerHTML = contenido
  else cuerpo.appendChild(contenido)

  fondo.addEventListener('click', (ev) => {
    if (ev.target === fondo || (ev.target as HTMLElement).closest('.modal__cerrar')) cerrarModal()
  })
  document.addEventListener('keydown', onEsc)
  document.body.appendChild(fondo)
  return cuerpo
}

export function cerrarModal() {
  document.querySelector('.modal-fondo')?.remove()
  document.removeEventListener('keydown', onEsc)
}

function onEsc(ev: KeyboardEvent) {
  if (ev.key === 'Escape') cerrarModal()
}
