/**
 * Panel del árbol de mejoras permanentes: lista los nodos por niveles de
 * requisitos, muestra fichas disponibles y permite comprar. El motor
 * (`Incremental`) guarda fichas y nodos; aquí solo hay presentación.
 */
import type { EfectoNodo, Incremental, NodoArbol } from './incremental'
import { abrirModal } from './modal'

export function describirEfecto(e: EfectoNodo, j: Incremental): string {
  switch (e.tipo) {
    case 'global':
      return `Producción ×${e.mult}`
    case 'click':
      return `Clic ×${e.mult}`
    case 'descuento':
      return `Edificios un ${Math.round(e.porcentaje * 100)} % más baratos`
    case 'arranque': {
      const ed = j.config.edificios.find((x) => x.id === e.edificio)
      const nombre = ed?.nombre.toLowerCase() ?? e.edificio
      return `Cada vida empieza con ${e.cantidad} ${e.cantidad === 1 || nombre.endsWith('s') ? nombre : nombre + 's'}`
    }
    case 'offline':
      return `+${e.horas} h de progreso fuera`
    case 'fichas':
      return `+${Math.round(e.porcentaje * 100)} % de fichas por reinicio`
    case 'desbloqueo':
      return 'Desbloqueo permanente'
  }
}

/** Profundidad de un nodo en el árbol (0 = sin requisitos), para pintarlo por filas. */
function nivel(n: NodoArbol, porId: Map<string, NodoArbol>, memo = new Map<string, number>()): number {
  if (memo.has(n.id)) return memo.get(n.id)!
  const req = (n.requiere ?? []).map((r) => porId.get(r)).filter((x): x is NodoArbol => !!x)
  const v = req.length ? 1 + Math.max(...req.map((r) => nivel(r, porId, memo))) : 0
  memo.set(n.id, v)
  return v
}

export function htmlArbol(j: Incremental): string {
  const arbol = j.arbol
  if (!arbol) return ''
  const porId = new Map(arbol.nodos.map((n) => [n.id, n]))
  const memo = new Map<string, number>()
  const filas = new Map<number, NodoArbol[]>()
  for (const n of arbol.nodos) {
    const v = nivel(n, porId, memo)
    if (!filas.has(v)) filas.set(v, [])
    filas.get(v)!.push(n)
  }
  const comprados = arbol.nodos.filter((n) => j.tieneNodo(n.id)).length
  const cab = `<p class="muted arbol__cab">
      <span><strong>${arbol.fichaEmoji} ${j.fichas}</strong> ${j.fichas === 1 ? arbol.fichaNombre : arbol.fichaPlural} sin gastar · ${comprados} de ${arbol.nodos.length} nodos</span>
      <span>Las fichas se ganan al reiniciar y lo comprado aquí no se pierde nunca.</span>
    </p>`
  const cuerpo = [...filas.keys()]
    .sort((a, b) => a - b)
    .map((v) => {
      const nodos = filas
        .get(v)!
        .map((n) => {
          const nivel = j.nivelNodo(n.id)
          const maximo = j.maximoNodo(n.id)
          const tiene = nivel > 0
          const completo = nivel >= maximo
          const disponible = j.nodoDisponible(n.id)
          const coste = j.costeNodo(n.id)
          const puede = disponible && j.fichas >= coste
          const requisitos = (n.requiere ?? []).map((r) => porId.get(r)?.nombre ?? r)
          const estado = completo ? 'nodo--ok' : disponible ? 'nodo--libre' : tiene ? 'nodo--libre' : 'nodo--bloqueado'
          const nivelTexto = n.repetible ? `<span class="nodo__nivel mono">nivel ${nivel}/${maximo === Infinity ? '∞' : maximo}</span>` : ''
          return `
            <button class="nodo ${estado}" data-nodo="${n.id}" ${completo || !puede ? 'disabled' : ''} title="${n.descripcion}">
              <span class="nodo__emoji">${tiene || disponible ? n.emoji : '🔒'}</span>
              <span class="nodo__info">
                <strong>${n.nombre}${nivelTexto ? ` ${nivelTexto}` : ''}</strong>
                <span class="muted">${n.descripcion}</span>
                <span class="nodo__efecto">${describirEfecto(n.efecto, j)}${n.repetible ? ' por nivel' : ''}</span>
                ${!tiene && !disponible && requisitos.length ? `<span class="muted">Requiere: ${requisitos.join(', ')}</span>` : ''}
              </span>
              <span class="nodo__coste mono">${completo ? '✓' : `${coste} ${arbol.fichaEmoji}`}</span>
            </button>`
        })
        .join('')
      return `<div class="arbol__fila" data-nivel="${v}">${nodos}</div>`
    })
    .join('<div class="arbol__union"></div>')
  return `${cab}<div class="arbol">${cuerpo}</div>`
}

/** Abre el panel y repinta tras cada compra. `alComprar` recibe el nodo comprado. */
export function abrirPanelArbol(j: Incremental, alComprar: (n: NodoArbol) => void) {
  const titulo = `${j.arbol?.fichaEmoji ?? '🧬'} Árbol permanente`
  const cuerpo = abrirModal(titulo, htmlArbol(j))
  cuerpo.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-nodo]')
    if (!b || b.disabled) return
    const id = b.dataset.nodo!
    if (j.comprarNodo(id)) {
      alComprar(j.nodo(id)!)
      cuerpo.innerHTML = htmlArbol(j)
    }
  })
}
