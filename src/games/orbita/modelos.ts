/**
 * Modelos 3D de los edificios de Órbita, montados con primitivas y un atlas de
 * texturas dibujado en un canvas (células solares, casco, lámina dorada, roca…).
 * Cada modelo es una sola geometría (fusionada) para poder dibujarlo instanciado:
 * un InstancedMesh por tipo de edificio y un único material compartido.
 * Los colores base van en el atributo `color` de los vértices; el atlas pone el detalle
 * y, en un segundo canvas, qué partes brillan (ventanas, reactores, luces de posición).
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type Celda = 'celulas' | 'casco' | 'oro' | 'roca' | 'luna' | 'ventanas' | 'espejo' | 'malla' | 'radiador' | 'reactor' | 'luz' | 'blanco'

const CELDAS: Celda[] = ['celulas', 'casco', 'oro', 'roca', 'luna', 'ventanas', 'espejo', 'malla', 'radiador', 'reactor', 'luz', 'blanco']
const COLUMNAS = 4
const FILAS = 3
const LADO = 256

/** Generador determinista: el atlas y las rocas salen iguales en cada carga. */
function aleatorio(semilla: number) {
  let s = semilla
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

type Pintor = (ctx: CanvasRenderingContext2D, x: number, y: number, emisivo: boolean) => void

const PINTORES: Record<Celda, Pintor> = {
  celulas(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#15306b'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    const nx = 8, ny = 8
    const w = LADO / nx, h = LADO / ny
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const g = ctx.createLinearGradient(x + i * w, y + j * h, x + (i + 1) * w, y + (j + 1) * h)
        g.addColorStop(0, '#2d5fc4')
        g.addColorStop(0.5, '#1b3f8f')
        g.addColorStop(1, '#122a63')
        ctx.fillStyle = g
        ctx.fillRect(x + i * w + 1.5, y + j * h + 1.5, w - 3, h - 3)
        // Brillo fino en la esquina de cada célula.
        ctx.fillStyle = 'rgba(190,220,255,0.35)'
        ctx.fillRect(x + i * w + 3, y + j * h + 3, w * 0.35, 1.5)
      }
    }
    // Colectores de plata que cruzan las células.
    ctx.strokeStyle = 'rgba(220,230,245,0.55)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(x, y + (LADO / 4) * i)
      ctx.lineTo(x + LADO, y + (LADO / 4) * i)
      ctx.stroke()
    }
  },

  casco(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#b4bac4'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    const rnd = aleatorio(31)
    // Placas de distintos grises con juntas oscuras.
    for (let i = 0; i < 26; i++) {
      const w = 30 + rnd() * 70, h = 20 + rnd() * 60
      const px = x + rnd() * (LADO - w), py = y + rnd() * (LADO - h)
      const tono = 168 + Math.floor(rnd() * 40)
      ctx.fillStyle = `rgb(${tono},${tono + 3},${tono + 10})`
      ctx.fillRect(px, py, w, h)
      ctx.strokeStyle = 'rgba(70,76,88,0.7)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1)
    }
    // Remaches y marcas.
    ctx.fillStyle = 'rgba(60,66,78,0.75)'
    for (let i = 0; i < 90; i++) ctx.fillRect(x + rnd() * LADO, y + rnd() * LADO, 2, 2)
    ctx.fillStyle = 'rgba(230,170,60,0.8)'
    for (let i = 0; i < 4; i++) ctx.fillRect(x + rnd() * (LADO - 30), y + rnd() * (LADO - 6), 30, 4)
  },

  oro(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#c08a2e'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    const rnd = aleatorio(57)
    // Lámina multicapa arrugada: triángulos en tonos dorados.
    for (let i = 0; i < 160; i++) {
      const cx = x + rnd() * LADO, cy = y + rnd() * LADO, r = 12 + rnd() * 30
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(rnd() * 6.3) * r, cy + Math.sin(rnd() * 6.3) * r)
      ctx.lineTo(cx + Math.cos(rnd() * 6.3) * r, cy + Math.sin(rnd() * 6.3) * r)
      ctx.lineTo(cx + Math.cos(rnd() * 6.3) * r, cy + Math.sin(rnd() * 6.3) * r)
      ctx.closePath()
      const l = 120 + Math.floor(rnd() * 120)
      ctx.fillStyle = `rgba(${l + 60},${l + 10},${Math.max(0, l - 80)},0.75)`
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,240,190,0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i < 40; i++) {
      ctx.beginPath()
      ctx.moveTo(x + rnd() * LADO, y + rnd() * LADO)
      ctx.lineTo(x + rnd() * LADO, y + rnd() * LADO)
      ctx.stroke()
    }
  },

  roca(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#6a5543'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    const rnd = aleatorio(91)
    for (let i = 0; i < 400; i++) {
      const l = 70 + Math.floor(rnd() * 60)
      ctx.fillStyle = `rgba(${l + 20},${l},${l - 20},0.6)`
      ctx.beginPath()
      ctx.arc(x + rnd() * LADO, y + rnd() * LADO, 2 + rnd() * 9, 0, Math.PI * 2)
      ctx.fill()
    }
    // Vetas metálicas claras: lo que el minero viene a buscar.
    ctx.strokeStyle = 'rgba(210,200,170,0.5)'
    ctx.lineWidth = 2
    for (let i = 0; i < 10; i++) {
      ctx.beginPath()
      ctx.moveTo(x + rnd() * LADO, y + rnd() * LADO)
      ctx.lineTo(x + rnd() * LADO, y + rnd() * LADO)
      ctx.stroke()
    }
  },

  luna(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#b7b2a8'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    const rnd = aleatorio(123)
    for (let i = 0; i < 300; i++) {
      const l = 150 + Math.floor(rnd() * 50)
      ctx.fillStyle = `rgba(${l},${l - 4},${l - 12},0.5)`
      ctx.beginPath()
      ctx.arc(x + rnd() * LADO, y + rnd() * LADO, 3 + rnd() * 10, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 40; i++) {
      const cx = x + rnd() * LADO, cy = y + rnd() * LADO, r = 5 + rnd() * 18
      ctx.fillStyle = 'rgba(95,90,82,0.75)'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(225,220,210,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  },

  ventanas(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#4a5262'
    ctx.fillRect(x, y, LADO, LADO)
    if (!emisivo) {
      // Costuras del casco entre filas de ventanas.
      ctx.fillStyle = '#394050'
      for (let j = 0; j < 4; j++) ctx.fillRect(x, y + j * 64, LADO, 3)
    }
    const rnd = aleatorio(7)
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 16; i++) {
        if (rnd() < 0.18) continue // alguna ventana apagada
        const calido = rnd() < 0.8
        ctx.fillStyle = emisivo ? (calido ? '#ffd98a' : '#bfe6ff') : calido ? '#ffe7b0' : '#d8f0ff'
        ctx.fillRect(x + 6 + i * 16, y + 24 + j * 64, 7, 10)
      }
    }
  },

  espejo(ctx, x, y, emisivo) {
    if (emisivo) {
      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, LADO, LADO)
      return
    }
    const g = ctx.createLinearGradient(x, y, x + LADO, y + LADO)
    g.addColorStop(0, '#f6f9ff')
    g.addColorStop(0.45, '#cfdcee')
    g.addColorStop(0.55, '#f0f5ff')
    g.addColorStop(1, '#a9bdd6')
    ctx.fillStyle = g
    ctx.fillRect(x, y, LADO, LADO)
    ctx.strokeStyle = 'rgba(120,140,170,0.5)'
    ctx.lineWidth = 1
    for (let i = 1; i < 6; i++) {
      ctx.beginPath()
      ctx.moveTo(x + (LADO / 6) * i, y)
      ctx.lineTo(x + (LADO / 6) * i, y + LADO)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y + (LADO / 6) * i)
      ctx.lineTo(x + LADO, y + (LADO / 6) * i)
      ctx.stroke()
    }
  },

  malla(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#2a1b14'
    ctx.fillRect(x, y, LADO, LADO)
    // Celosía hexagonal: oscura con bordes que brillan naranja (recogen la luz de la estrella).
    ctx.strokeStyle = emisivo ? '#9a4418' : '#e08a48'
    ctx.lineWidth = emisivo ? 3 : 4
    const r = 22
    const dx = r * Math.sqrt(3), dy = r * 1.5
    for (let j = -1; j < LADO / dy + 1; j++) {
      for (let i = -1; i < LADO / dx + 1; i++) {
        const cx = x + i * dx + (j % 2 ? dx / 2 : 0), cy = y + j * dy
        ctx.beginPath()
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6
          const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
    if (!emisivo) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(x, y, LADO, LADO)
    }
  },

  radiador(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#d9dee5'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    ctx.fillStyle = '#23272e'
    for (let i = 0; i < LADO / 16; i++) ctx.fillRect(x + i * 16, y, 7, LADO)
  },

  reactor(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#0f2733'
    ctx.fillRect(x, y, LADO, LADO)
    ctx.fillStyle = emisivo ? '#5fe8ff' : '#8af0ff'
    for (let j = 0; j < 6; j++) ctx.fillRect(x, y + 14 + j * 42, LADO, 8)
  },

  luz(ctx, x, y) {
    // Luz de posición: brilla igual en el mapa de color y en el emisivo.
    const g = ctx.createRadialGradient(x + LADO / 2, y + LADO / 2, 0, x + LADO / 2, y + LADO / 2, LADO / 2)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.5, '#ffb070')
    g.addColorStop(1, '#ff6a3a')
    ctx.fillStyle = g
    ctx.fillRect(x, y, LADO, LADO)
  },

  blanco(ctx, x, y, emisivo) {
    ctx.fillStyle = emisivo ? '#000' : '#eef0f4'
    ctx.fillRect(x, y, LADO, LADO)
    if (emisivo) return
    ctx.strokeStyle = 'rgba(150,158,170,0.6)'
    ctx.lineWidth = 1.5
    for (let i = 1; i < 8; i++) {
      ctx.beginPath()
      ctx.arc(x + LADO / 2, y + LADO / 2, (LADO / 16) * i, 0, Math.PI * 2)
      ctx.stroke()
    }
  },
}

function pintarAtlas(emisivo: boolean): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = LADO * COLUMNAS
  c.height = LADO * FILAS
  const ctx = c.getContext('2d')!
  CELDAS.forEach((nombre, i) => {
    const x = (i % COLUMNAS) * LADO, y = Math.floor(i / COLUMNAS) * LADO
    // Cada pintor se recorta a su celda: ninguno pisa a la vecina.
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, LADO, LADO)
    ctx.clip()
    PINTORES[nombre](ctx, x, y, emisivo)
    ctx.restore()
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Atlas de color y atlas emisivo (negro salvo lo que brilla). Se dibujan una sola vez. */
export function atlas(): { mapa: THREE.Texture; emisivo: THREE.Texture } {
  return { mapa: pintarAtlas(false), emisivo: pintarAtlas(true) }
}

/** Lleva las UV de una geometría (0‥1) al recuadro del atlas de la celda, con un pequeño margen para que no sangre la vecina. */
function enCelda(geo: THREE.BufferGeometry, celda: Celda) {
  const i = CELDAS.indexOf(celda)
  const col = i % COLUMNAS, fila = Math.floor(i / COLUMNAS)
  const margen = 0.015
  const u0 = col / COLUMNAS + margen / COLUMNAS, ancho = (1 - margen * 2) / COLUMNAS
  // El canvas se dibuja de arriba abajo; la textura tiene v=1 en la fila de arriba.
  const v0 = 1 - (fila + 1) / FILAS + margen / FILAS, alto = (1 - margen * 2) / FILAS
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * ancho, v0 + uv.getY(k) * alto)
}

/** Tinte por vértice: el material es compartido, así que el color base de cada parte viaja en la geometría. */
function tenir(geo: THREE.BufferGeometry, color: number) {
  const n = geo.getAttribute('position').count
  const c = new THREE.Color(color)
  const arr = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) {
    arr[k * 3] = c.r
    arr[k * 3 + 1] = c.g
    arr[k * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
}

type Transformar = (g: THREE.BufferGeometry) => void

/** Superficie fina visible por las dos caras (platos, velas, celosías): se añade una copia con las caras y normales invertidas. */
function dobleCara(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const reverso = geo.clone()
  const p = reverso.getAttribute('position') as THREE.BufferAttribute
  const n = reverso.getAttribute('normal') as THREE.BufferAttribute
  const uv = reverso.getAttribute('uv') as THREE.BufferAttribute
  const c = reverso.getAttribute('color') as THREE.BufferAttribute
  for (let k = 0; k < p.count; k += 3) {
    // Intercambiar los vértices 2.º y 3.º de cada triángulo invierte el sentido de la cara.
    for (const atributo of [p, n, uv, c]) {
      const tam = atributo.itemSize
      for (let j = 0; j < tam; j++) {
        const a = atributo.getComponent(k + 1, j), b = atributo.getComponent(k + 2, j)
        atributo.setComponent(k + 1, j, b)
        atributo.setComponent(k + 2, j, a)
      }
    }
  }
  for (let k = 0; k < n.count; k++) n.setXYZ(k, -n.getX(k), -n.getY(k), -n.getZ(k))
  // El reverso de una lámina va algo más oscuro: se nota que es la cara de atrás.
  for (let k = 0; k < c.count; k++) c.setXYZ(k, c.getX(k) * 0.55, c.getY(k) * 0.55, c.getZ(k) * 0.55)
  const g = mergeGeometries([geo, reverso], false)!
  geo.dispose()
  reverso.dispose()
  return g
}

/** Una pieza del modelo: geometría + celda del atlas + tinte + colocación. */
function pieza(geo: THREE.BufferGeometry, celda: Celda, tinte: number, colocar?: Transformar): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  enCelda(g, celda)
  tenir(g, tinte)
  colocar?.(g)
  return g
}

function fusionar(piezas: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(piezas, false)!
  for (const p of piezas) p.dispose()
  g.computeBoundingSphere()
  return g
}

/** Caja sencilla ya colocada. */
function caja(w: number, h: number, d: number, celda: Celda, tinte: number, x = 0, y = 0, z = 0, rotY = 0): THREE.BufferGeometry {
  return pieza(new THREE.BoxGeometry(w, h, d), celda, tinte, (g) => {
    g.rotateY(rotY)
    g.translate(x, y, z)
  })
}

/** Barra cilíndrica a lo largo de un eje. */
function barra(r: number, largo: number, eje: 'x' | 'y' | 'z', celda: Celda, tinte: number, x = 0, y = 0, z = 0, seg = 6): THREE.BufferGeometry {
  return pieza(new THREE.CylinderGeometry(r, r, largo, seg), celda, tinte, (g) => {
    if (eje === 'x') g.rotateZ(Math.PI / 2)
    if (eje === 'z') g.rotateX(Math.PI / 2)
    g.translate(x, y, z)
  })
}

/** Dos alas de células solares a los lados de un cuerpo (eje x), con su mástil. */
function alas(largo: number, ancho: number, separacion: number, y = 0, tinte = 0x6f9fff): THREE.BufferGeometry[] {
  return [
    caja(largo, 0.03, ancho, 'celulas', tinte, separacion + largo / 2, y, 0),
    caja(largo, 0.03, ancho, 'celulas', tinte, -(separacion + largo / 2), y, 0),
    barra(0.035, separacion * 2 + largo * 2, 'x', 'casco', 0x6a7078, 0, y, 0),
  ]
}

/** Antena parabólica: casquete esférico mirando hacia +z más su mástil y el alimentador. */
function antena(r: number, x = 0, y = 0, z = 0, mirarY = 0): THREE.BufferGeometry[] {
  const plato = dobleCara(
    pieza(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), 'blanco', 0xf4f6fa, (g) => {
      g.translate(0, -r * 0.65, 0)
      g.rotateX(-Math.PI / 2)
      g.rotateY(mirarY)
      g.translate(x, y, z)
    }),
  )
  const alimentador = pieza(new THREE.CylinderGeometry(0.02, 0.02, r * 0.8, 5), 'casco', 0x3a3f47, (g) => {
    g.rotateX(Math.PI / 2)
    g.translate(0, 0, r * 0.1)
    g.rotateY(mirarY)
    g.translate(x, y, z)
  })
  return [plato, alimentador]
}

/** Pequeña luz de posición (brilla siempre). */
function luz(x: number, y: number, z: number, r = 0.035): THREE.BufferGeometry {
  return pieza(new THREE.SphereGeometry(r, 6, 5), 'luz', 0xffffff, (g) => g.translate(x, y, z))
}

export type Detalle = 'alto' | 'bajo'

/** Modelo de cada edificio, a escala unidad (~1 de envergadura); `detalle` baja los segmentos en móvil. */
export function modelo(id: string, detalle: Detalle, radioCascara = 2): THREE.BufferGeometry {
  const d = detalle === 'alto'
  switch (id) {
    case 'panel':
      return fusionar([
        caja(0.34, 0.3, 0.3, 'casco', 0xc9ced6),
        ...alas(1.1, 0.55, 0.22),
        caja(0.2, 0.12, 0.2, 'radiador', 0xffffff, 0, 0.2, 0),
        luz(0.17, 0, 0.17, 0.03),
      ])

    case 'sonda':
      return fusionar([
        pieza(new THREE.CylinderGeometry(0.26, 0.26, 0.5, d ? 10 : 7), 'oro', 0xe4b25a),
        ...antena(0.5, 0, 0.25, 0.2),
        barra(0.025, 1.2, 'x', 'casco', 0x7a8088, 0.5, -0.1, 0),
        caja(0.2, 0.22, 0.22, 'radiador', 0xffffff, 1.1, -0.1, 0),
        caja(0.5, 0.02, 0.3, 'celulas', 0x6f9fff, -0.55, 0, 0),
        luz(0, -0.3, 0, 0.035),
      ])

    case 'rele':
      return fusionar([
        caja(0.55, 0.5, 0.7, 'casco', 0xc4c9d2),
        ...alas(0.95, 0.5, 0.3, 0.05),
        ...antena(0.55, 0, 0.45, 0.25),
        barra(0.02, 0.6, 'y', 'casco', 0x40454d, 0, -0.55, 0),
        luz(0, -0.86, 0, 0.04),
        caja(0.3, 0.3, 0.05, 'ventanas', 0xffffff, 0, 0, 0.37),
      ])

    case 'estacion':
      return fusionar([
        // Eje central con ventanas, anillo habitado, radios y dos pares de alas.
        pieza(new THREE.CylinderGeometry(0.22, 0.22, 1.4, d ? 12 : 8), 'ventanas', 0xffffff),
        pieza(new THREE.TorusGeometry(0.8, 0.14, d ? 10 : 6, d ? 36 : 20), 'ventanas', 0xffffff, (g) => g.rotateX(Math.PI / 2)),
        ...[0, 1, 2, 3].map((k) => barra(0.05, 0.8, 'x', 'casco', 0x8a9099, 0, 0, 0, 5).rotateY((Math.PI / 2) * k).translate(Math.cos((Math.PI / 2) * k) * 0.4, 0, -Math.sin((Math.PI / 2) * k) * 0.4)),
        ...alas(0.75, 0.42, 0.3, 0.55),
        ...alas(0.75, 0.42, 0.3, -0.55, 0x5f8fff).map((g) => g.rotateY(Math.PI / 2)),
        caja(0.3, 0.35, 0.3, 'radiador', 0xffffff, 0, 0.85, 0),
        luz(0, 0.95, 0, 0.04),
        luz(0, -0.78, 0, 0.04),
      ])

    case 'minero': {
      const rnd = aleatorio(203)
      const roca = pieza(new THREE.IcosahedronGeometry(0.62, d ? 2 : 1), 'roca', 0x9a8068, (g) => {
        // Roca irregular: cada vértice se empuja un poco hacia fuera o hacia dentro.
        const p = g.getAttribute('position') as THREE.BufferAttribute
        const v = new THREE.Vector3()
        const empuje = new Map<string, number>()
        for (let k = 0; k < p.count; k++) {
          v.set(p.getX(k), p.getY(k), p.getZ(k))
          const clave = v.toArray().map((n) => n.toFixed(3)).join(',')
          let f = empuje.get(clave)
          if (f === undefined) {
            f = 0.82 + rnd() * 0.36
            empuje.set(clave, f)
          }
          v.multiplyScalar(f)
          p.setXYZ(k, v.x, v.y, v.z)
        }
        g.computeVertexNormals()
        g.scale(1.25, 0.9, 1)
      })
      return fusionar([
        roca,
        caja(0.38, 0.3, 0.38, 'casco', 0xd0a860, 0, 0.6, 0),
        barra(0.06, 0.6, 'y', 'casco', 0x50555d, 0, 0.3, 0),
        barra(0.025, 0.5, 'y', 'casco', 0xbfc4cc, 0.18, 0.95, 0.18, 4),
        caja(0.45, 0.02, 0.3, 'celulas', 0x6f9fff, 0.5, 0.75, 0),
        caja(0.45, 0.02, 0.3, 'celulas', 0x6f9fff, -0.5, 0.75, 0),
        luz(0, 0.85, 0.2, 0.04),
        luz(-0.3, -0.45, 0.4, 0.03),
      ])
    }

    case 'luna':
      return fusionar([
        pieza(new THREE.SphereGeometry(0.92, d ? 28 : 16, d ? 20 : 12), 'luna', 0xd8d4ca),
        // Cinturón reactor luminoso y torres de refrigeración.
        pieza(new THREE.TorusGeometry(0.93, 0.07, 6, d ? 48 : 28), 'reactor', 0xffffff, (g) => g.rotateX(Math.PI / 2)),
        ...[0, 1, 2].map((k) => caja(0.12, 0.3, 0.12, 'radiador', 0xffffff, 0, 0, 0).rotateZ(0.5).rotateY((Math.PI * 2 * k) / 3).translate(Math.cos((Math.PI * 2 * k) / 3) * 0.8, 0.55, Math.sin((Math.PI * 2 * k) / 3) * 0.8)),
        caja(0.3, 0.2, 0.3, 'ventanas', 0xffffff, 0, 0.98, 0),
        luz(0, -1.02, 0, 0.05),
      ])

    case 'espejos':
      return fusionar([
        // Placa hexagonal reflectante con bastidor y bisagra.
        pieza(new THREE.CylinderGeometry(0.72, 0.72, 0.035, 6), 'espejo', 0xffffff, (g) => g.rotateX(Math.PI / 2)),
        pieza(new THREE.CylinderGeometry(0.76, 0.76, 0.06, 6, 1, true), 'casco', 0x5a6068, (g) => g.rotateX(Math.PI / 2)),
        barra(0.04, 1.3, 'x', 'casco', 0x40454d, 0, 0, -0.08),
        barra(0.04, 1.3, 'y', 'casco', 0x40454d, 0, 0, -0.08),
        caja(0.22, 0.22, 0.2, 'casco', 0xc0c5cd, 0, 0, -0.2),
        luz(0, 0, -0.33, 0.035),
      ])

    case 'colector': {
      // Vela cuadrada de lámina dorada, abombada por el viento solar, con cuatro mástiles y la cápsula al centro.
      const vela = dobleCara(
        pieza(new THREE.PlaneGeometry(2.4, 2.4, d ? 10 : 5, d ? 10 : 5), 'oro', 0xffd27a, (g) => {
          const p = g.getAttribute('position') as THREE.BufferAttribute
          for (let k = 0; k < p.count; k++) {
            const x = p.getX(k) / 1.2, y = p.getY(k) / 1.2
            p.setZ(k, (1 - x * x) * (1 - y * y) * 0.35)
          }
          g.computeVertexNormals()
        }),
      )
      const mastiles = [0, 1, 2, 3].map((k) =>
        pieza(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 4), 'casco', 0x3b4048, (g) => {
          g.rotateZ(Math.PI / 2)
          g.rotateY(Math.PI / 4 + (Math.PI / 2) * k)
          g.rotateX(Math.PI / 2)
          g.translate(Math.cos(Math.PI / 4 + (Math.PI / 2) * k) * 0.85, Math.sin(Math.PI / 4 + (Math.PI / 2) * k) * 0.85, 0.1)
        }),
      )
      return fusionar([vela, ...mastiles, caja(0.28, 0.28, 0.3, 'casco', 0xc9ced6, 0, 0, 0.1), luz(0, 0, 0.3, 0.04)])
    }

    case 'dyson': {
      // Celosía curva: un parche de esfera del radio de la cáscara (en unidades del modelo), centrado en el origen
      // y con el centro de la esfera hacia +z, que es hacia donde mira cada segmento (la estrella). Así cierran una cáscara.
      const ancho = 0.5 / radioCascara, alto = 0.45 / radioCascara
      return fusionar([
        dobleCara(pieza(new THREE.SphereGeometry(radioCascara, d ? 12 : 8, d ? 8 : 5, -Math.PI / 2 - ancho, ancho * 2, Math.PI / 2 - alto, alto * 2), 'malla', 0xffffff, (g) => g.translate(0, 0, radioCascara))),
        barra(0.03, 0.95, 'x', 'casco', 0x6a5a50, 0, 0.42, 0.02),
        barra(0.03, 0.95, 'x', 'casco', 0x6a5a50, 0, -0.42, 0.02),
        barra(0.03, 0.85, 'y', 'casco', 0x6a5a50, 0.47, 0, 0.02),
        barra(0.03, 0.85, 'y', 'casco', 0x6a5a50, -0.47, 0, 0.02),
        luz(0.44, 0.4, 0.05, 0.035),
        luz(-0.44, -0.4, 0.05, 0.035),
      ])
    }

    case 'ciudad': {
      // Dos cilindros O'Neill en pareja, con sus espejos abiertos, un anillo agrícola y las cerchas que los unen.
      const cilindro = (x: number) => pieza(new THREE.CylinderGeometry(0.24, 0.24, 1.7, d ? 14 : 9), 'ventanas', 0xffffff, (g) => g.translate(x, 0, 0))
      const espejos = [-0.34, 0.34].flatMap((x) =>
        [0, 1, 2].map((k) =>
          pieza(new THREE.BoxGeometry(0.02, 1.3, 0.3), 'espejo', 0xffffff, (g) => {
            g.rotateZ(x < 0 ? 0.55 : -0.55)
            g.rotateY((Math.PI * 2 * k) / 3)
            g.translate(x + Math.cos((Math.PI * 2 * k) / 3) * (x < 0 ? -0.34 : 0.34), 0.95, Math.sin((Math.PI * 2 * k) / 3) * 0.34)
          }),
        ),
      )
      return fusionar([
        cilindro(-0.34),
        cilindro(0.34),
        ...espejos,
        pieza(new THREE.TorusGeometry(0.42, 0.08, 6, d ? 28 : 16), 'celulas', 0x6f9fff, (g) => {
          g.rotateX(Math.PI / 2)
          g.translate(0, -0.98, 0)
        }),
        barra(0.04, 0.9, 'x', 'casco', 0x8a9099, 0, 0.6, 0),
        barra(0.04, 0.9, 'x', 'casco', 0x8a9099, 0, -0.6, 0),
        caja(0.3, 0.2, 0.3, 'radiador', 0xffffff, 0, -1.15, 0),
        luz(0, 1.2, 0, 0.04),
        luz(-0.34, -0.9, 0, 0.035),
        luz(0.34, -0.9, 0, 0.035),
      ])
    }

    case 'ascensor':
      // Cable a lo largo de z (el +z apunta al planeta), ancla en la superficie, cabinas y contrapeso al final.
      return fusionar([
        barra(0.006, 1, 'z', 'casco', 0xe8ecf2, 0, 0, 0, 4),
        caja(0.05, 0.02, 0.05, 'casco', 0xb0b6c0, 0, 0, 0.49),
        caja(0.025, 0.025, 0.04, 'casco', 0xffcc55, 0, 0, 0.2),
        caja(0.025, 0.025, 0.04, 'casco', 0xffcc55, 0, 0, -0.15),
        pieza(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), 'ventanas', 0xffffff, (g) => {
          g.rotateX(Math.PI / 2)
          g.translate(0, 0, -0.48)
        }),
        pieza(new THREE.TorusGeometry(0.09, 0.015, 5, 16), 'casco', 0x8a9099, (g) => g.translate(0, 0, -0.48)),
        luz(0, 0, -0.55, 0.02),
      ])

    case 'colonia':
      // Puerto orbital de la colonia: esfera habitada, anillo de atraque y alas.
      return fusionar([
        pieza(new THREE.SphereGeometry(0.3, d ? 16 : 10, d ? 12 : 8), 'ventanas', 0xffffff),
        pieza(new THREE.TorusGeometry(0.5, 0.06, 6, d ? 28 : 16), 'casco', 0xd9b48a, (g) => g.rotateX(Math.PI / 2)),
        ...[0, 1, 2, 3].map((k) => barra(0.03, 0.5, 'x', 'casco', 0x8a9099, 0, 0, 0, 4).rotateY((Math.PI / 2) * k).translate(Math.cos((Math.PI / 2) * k) * 0.25, 0, -Math.sin((Math.PI / 2) * k) * 0.25)),
        ...alas(0.6, 0.3, 0.55, 0.0),
        luz(0, 0.36, 0, 0.035),
      ])

    case 'cinturon': {
      // Asteroide grande con refinería anclada: tanques, chimenea de radiadores y luces de trabajo.
      const rnd = aleatorio(409)
      const roca = pieza(new THREE.IcosahedronGeometry(0.55, d ? 2 : 1), 'roca', 0xa08a72, (g) => {
        const p = g.getAttribute('position') as THREE.BufferAttribute
        const v = new THREE.Vector3()
        const empuje = new Map<string, number>()
        for (let k = 0; k < p.count; k++) {
          v.set(p.getX(k), p.getY(k), p.getZ(k))
          const clave = v.toArray().map((n) => n.toFixed(3)).join(',')
          let f = empuje.get(clave)
          if (f === undefined) {
            f = 0.78 + rnd() * 0.44
            empuje.set(clave, f)
          }
          v.multiplyScalar(f)
          p.setXYZ(k, v.x, v.y, v.z)
        }
        g.computeVertexNormals()
        g.scale(1.3, 0.8, 1)
      })
      return fusionar([
        roca,
        pieza(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), 'oro', 0xe4b25a, (g) => g.translate(0.25, 0.55, 0)),
        pieza(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), 'oro', 0xe4b25a, (g) => g.translate(-0.05, 0.55, 0.15)),
        caja(0.5, 0.12, 0.3, 'casco', 0xc4c9d2, 0.1, 0.32, 0),
        caja(0.08, 0.5, 0.35, 'radiador', 0xffffff, -0.35, 0.6, 0),
        barra(0.02, 0.6, 'y', 'casco', 0xbfc4cc, 0.45, 0.6, 0, 4),
        luz(0.45, 0.92, 0, 0.035),
        luz(-0.4, 0.3, 0.3, 0.03),
      ])
    }

    case 'puerto':
      // Puerto atmosférico: columna habitada con los globos de extracción colgando y un anillo de atraque arriba.
      return fusionar([
        pieza(new THREE.CylinderGeometry(0.14, 0.14, 1.3, d ? 12 : 8), 'ventanas', 0xffffff),
        pieza(new THREE.SphereGeometry(0.34, d ? 14 : 9, d ? 10 : 7), 'oro', 0xf0c070, (g) => g.translate(-0.3, -0.85, 0.1)),
        pieza(new THREE.SphereGeometry(0.3, d ? 14 : 9, d ? 10 : 7), 'oro', 0xf0c070, (g) => g.translate(0.32, -0.8, -0.12)),
        barra(0.02, 0.5, 'y', 'casco', 0x8a9099, -0.2, -0.5, 0.05, 4),
        barra(0.02, 0.5, 'y', 'casco', 0x8a9099, 0.2, -0.45, -0.08, 4),
        pieza(new THREE.TorusGeometry(0.45, 0.06, 6, d ? 28 : 16), 'casco', 0xc4c9d2, (g) => {
          g.rotateX(Math.PI / 2)
          g.translate(0, 0.55, 0)
        }),
        ...alas(0.55, 0.3, 0.2, 0.2),
        caja(0.2, 0.25, 0.2, 'radiador', 0xffffff, 0, 0.78, 0),
        luz(0, 0.95, 0, 0.04),
      ])

    default:
      return fusionar([caja(0.6, 0.6, 0.6, 'casco', 0xffffff)])
  }
}

/** Ruido de valor fractal sobre una malla periódica en horizontal (para que la textura del planeta no tenga costura). */
function ruido(semilla: number, nx: number, ny: number): (u: number, v: number) => number {
  const rnd = aleatorio(semilla)
  const base = Float32Array.from({ length: nx * ny }, () => rnd())
  const suave = (t: number) => t * t * (3 - 2 * t)
  const muestra = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = suave(x - xi), fy = suave(y - yi)
    const at = (i: number, j: number) => base[(((j % ny) + ny) % ny) * nx + (((i % nx) + nx) % nx)]
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  return (u, v) => {
    let total = 0, amp = 1, frec = 1, norma = 0
    for (let o = 0; o < 5; o++) {
      total += muestra(u * nx * frec, v * ny * frec) * amp
      norma += amp
      amp *= 0.5
      frec *= 2
    }
    return total / norma
  }
}

/** Texturas del planeta: mapa de color (océanos, continentes, hielo) y mapa de luces nocturnas (ciudades en la costa). */
export function texturasPlaneta(semilla = 5): { mapa: THREE.Texture; luces: THREE.Texture } {
  const w = 1024, h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const cl = document.createElement('canvas')
  cl.width = w
  cl.height = h
  const ctxL = cl.getContext('2d')!
  const imgL = ctxL.createImageData(w, h)
  const relieve = ruido(semilla, 8, 4)
  const detalle = ruido(semilla + 1, 32, 16)
  const rnd = aleatorio(semilla + 2)
  for (let y = 0; y < h; y++) {
    const v = y / h
    const lat = Math.abs(v - 0.5) * 2 // 0 ecuador, 1 polo
    for (let x = 0; x < w; x++) {
      const u = x / w
      const e = relieve(u, v) * 0.75 + detalle(u, v) * 0.25
      const k = (y * w + x) * 4
      let r: number, g: number, b: number
      if (e < 0.5) {
        // Océano: más oscuro cuanto más profundo.
        const prof = (0.5 - e) / 0.5
        r = 22 + (1 - prof) * 30
        g = 70 + (1 - prof) * 60
        b = 140 + (1 - prof) * 50
      } else if (e < 0.52) {
        r = 190
        g = 180
        b = 130 // playa
      } else {
        const alt = (e - 0.52) / 0.48
        const seco = detalle(u + 0.3, v) > 0.55
        r = seco ? 150 + alt * 50 : 60 + alt * 90
        g = seco ? 120 + alt * 40 : 130 - alt * 40
        b = seco ? 70 + alt * 30 : 50
        if (alt > 0.7) {
          r = g = b = 150 + alt * 90 // cumbres nevadas
        }
      }
      // Casquetes polares.
      const hielo = Math.max(0, (lat - 0.82) / 0.18 + (e - 0.5) * 0.3)
      if (hielo > 0) {
        const f = Math.min(1, hielo * 1.5)
        r = r + (235 - r) * f
        g = g + (240 - g) * f
        b = b + (245 - b) * f
      }
      img.data[k] = r
      img.data[k + 1] = g
      img.data[k + 2] = b
      img.data[k + 3] = 255
      // Luces: en tierra firme, sobre todo cerca de la costa y lejos de los polos.
      const tierra = e >= 0.5 && e < 0.72 && lat < 0.75
      const costa = tierra && e < 0.6
      const densidad = tierra ? (costa ? 0.11 : 0.025) : 0
      const luz = rnd() < densidad ? 200 + rnd() * 55 : 0
      imgL.data[k] = luz
      imgL.data[k + 1] = luz * 0.82
      imgL.data[k + 2] = luz * 0.5
      imgL.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  ctxL.putImageData(imgL, 0, 0)
  const mapa = new THREE.CanvasTexture(c)
  mapa.colorSpace = THREE.SRGBColorSpace
  const luces = new THREE.CanvasTexture(cl)
  luces.colorSpace = THREE.SRGBColorSpace
  return { mapa, luces }
}

/** Textura del planeta vecino: un mundo rojo y seco con casquetes de hielo y cañones oscuros. */
export function texturaVecino(semilla = 21): THREE.Texture {
  const w = 512, h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const relieve = ruido(semilla, 8, 4)
  const detalle = ruido(semilla + 1, 32, 16)
  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y / h - 0.5) * 2
    for (let x = 0; x < w; x++) {
      const e = relieve(x / w, y / h) * 0.6 + detalle(x / w, y / h) * 0.4
      const k = (y * w + x) * 4
      let r = 150 + e * 90, g = 70 + e * 50, b = 40 + e * 25
      if (e < 0.42) {
        r *= 0.7
        g *= 0.7
        b *= 0.7 // cañones y llanuras oscuras
      }
      const hielo = Math.max(0, (lat - 0.86) / 0.14)
      if (hielo > 0) {
        r += (240 - r) * hielo
        g += (236 - g) * hielo
        b += (230 - b) * hielo
      }
      img.data[k] = r
      img.data[k + 1] = g
      img.data[k + 2] = b
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Textura del gigante gaseoso: bandas de nubes en tonos crema y ocre con turbulencias y una gran tormenta. */
export function texturaGigante(semilla = 33): THREE.Texture {
  const w = 512, h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const turb = ruido(semilla, 6, 12)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h
      // Las bandas son franjas horizontales deformadas por el ruido.
      const banda = Math.sin((v + (turb(u, v) - 0.5) * 0.12) * Math.PI * 14) * 0.5 + 0.5
      const claro = 0.55 + banda * 0.45
      const k = (y * w + x) * 4
      let r = 225 * claro, g = 190 * claro, b = 140 * claro
      // La gran mancha: un óvalo rojizo en el hemisferio sur.
      const dx = (u - 0.68) / 0.09, dy = (v - 0.64) / 0.05
      const mancha = Math.max(0, 1 - (dx * dx + dy * dy))
      r = r + (200 - r) * mancha
      g = g + (110 - g) * mancha
      b = b + (80 - b) * mancha
      img.data[k] = r
      img.data[k + 1] = g
      img.data[k + 2] = b
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Anillo del gigante: franjas concéntricas con huecos, en una tira que RingGeometry envuelve de dentro afuera. */
export function texturaAnillo(semilla = 45): THREE.Texture {
  const w = 256, h = 8
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const rnd = aleatorio(semilla)
  for (let x = 0; x < w; x++) {
    const t = x / w
    const hueco = (t > 0.42 && t < 0.47) || (t > 0.78 && t < 0.8)
    const a = hueco ? 0.05 : 0.25 + rnd() * 0.5 * (1 - Math.abs(t - 0.5) * 1.2)
    const l = 190 + rnd() * 50
    ctx.fillStyle = `rgba(${l},${l - 15},${l - 40},${a})`
    ctx.fillRect(x, 0, 1, h)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
