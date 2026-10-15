/**
 * Exportar e importar la partida como un código de texto, para cambiar de
 * navegador o hacer copia de seguridad.
 */
import type { Incremental } from './incremental'
import { abrirModal, cerrarModal } from './modal'

const PREFIJO = 'VJW1.'

function clave(j: Incremental): string {
  return `vjw:${j.config.claveGuardado}`
}

export function exportar(j: Incremental): string {
  j.guardar()
  const raw = localStorage.getItem(clave(j)) ?? ''
  const logros = localStorage.getItem(`${clave(j)}:logros`) ?? '[]'
  const paquete = JSON.stringify({ partida: JSON.parse(raw || 'null'), logros: JSON.parse(logros) })
  return PREFIJO + btoa(unescape(encodeURIComponent(paquete)))
}

/** Devuelve un mensaje de error o null si se importó bien (recarga la página). */
export function importar(j: Incremental, codigo: string): string | null {
  const limpio = codigo.trim()
  if (!limpio.startsWith(PREFIJO)) return 'El código no tiene el formato esperado.'
  try {
    const paquete = JSON.parse(decodeURIComponent(escape(atob(limpio.slice(PREFIJO.length))))) as {
      partida?: { version?: number; data?: unknown } | null
      logros?: unknown
    }
    const p = paquete.partida
    if (!p || typeof p !== 'object' || p.version !== j.config.versionGuardado || typeof p.data !== 'object') {
      return 'El código no corresponde a este juego o a esta versión.'
    }
    localStorage.setItem(clave(j), JSON.stringify({ ...p, savedAt: Date.now() }))
    if (Array.isArray(paquete.logros)) localStorage.setItem(`${clave(j)}:logros`, JSON.stringify(paquete.logros))
    return null
  } catch {
    return 'No se pudo leer el código.'
  }
}

/** `antesDeRecargar` debe parar el autoguardado, o pisaría la partida recién importada al descargar la página. */
export function abrirPanelPortar(j: Incremental, antesDeRecargar: () => void) {
  const cuerpo = abrirModal(
    'Guardar y cargar',
    `
    <p class="muted">Copia este código para llevarte la partida a otro navegador o guardarla a buen recaudo.</p>
    <textarea class="portar__texto mono" id="portar-export" readonly rows="4"></textarea>
    <div class="portar__fila">
      <button id="portar-copiar">📋 Copiar código</button>
      <span id="portar-copiado" class="muted"></span>
    </div>
    <hr class="portar__sep" />
    <p class="muted">Pega aquí un código para cargar esa partida. Sustituye a la actual.</p>
    <textarea class="portar__texto mono" id="portar-import" rows="4" placeholder="VJW1...."></textarea>
    <div class="portar__fila">
      <button id="portar-cargar">📥 Cargar partida</button>
      <span id="portar-error" class="portar__error"></span>
    </div>
  `,
  )
  const exportado = cuerpo.querySelector<HTMLTextAreaElement>('#portar-export')!
  exportado.value = exportar(j)
  cuerpo.querySelector('#portar-copiar')!.addEventListener('click', async () => {
    const aviso = cuerpo.querySelector('#portar-copiado')!
    try {
      await navigator.clipboard.writeText(exportado.value)
      aviso.textContent = 'Copiado.'
    } catch {
      exportado.select()
      aviso.textContent = 'Selecciona el texto y cópialo.'
    }
  })
  cuerpo.querySelector('#portar-cargar')!.addEventListener('click', () => {
    const codigo = cuerpo.querySelector<HTMLTextAreaElement>('#portar-import')!.value
    const error = importar(j, codigo)
    if (error) {
      cuerpo.querySelector('#portar-error')!.textContent = error
      return
    }
    cerrarModal()
    antesDeRecargar()
    window.location.reload()
  })
}
