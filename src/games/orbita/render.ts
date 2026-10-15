/**
 * Escena 3D con Three.js: un planeta, su estrella y, en órbitas concéntricas,
 * un objeto por cada edificio comprado (con tope por tipo para rendir bien).
 * La cámara se aleja sola a medida que se pueblan las órbitas exteriores.
 */
import * as THREE from 'three'
import type { Escena } from '../../core/arranque'
import type { Incremental } from '../../core/incremental'
import { APARIENCIAS, CONFIG, type Apariencia } from './data'

/** Objetos dibujados por tipo; a partir de ahí crecen un poco en vez de multiplicarse. */
const MAX_POR_TIPO = 28
const POS_ESTRELLA = new THREE.Vector3(6.5, 4.2, -8)
const RADIO_PLANETA = 1.2

type Capa = {
  id: string
  malla: THREE.InstancedMesh
  apariencia: Apariencia
  grupo: THREE.Group // inclinación de la órbita
  anillo: THREE.Mesh
  fases: number[]
  visibles: number
}

type Onda = { malla: THREE.Mesh; vida: number }

export class EscenaOrbita implements Escena {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camara: THREE.PerspectiveCamera
  private planeta: THREE.Mesh
  private atmosfera: THREE.Mesh
  private estrella: THREE.Sprite
  private luzEstrella: THREE.PointLight
  private capas = new Map<string, Capa>()
  private ondas: Onda[] = []
  private rayo: THREE.Mesh
  private vidaRayo = 0
  private tiempo = 0
  private pulso = 0
  private distancia = 9
  private distanciaObjetivo = 9
  private cantidades: Record<string, number> = {}
  private canvas: HTMLCanvasElement
  private juego: Incremental
  private dummy = new THREE.Object3D()
  private movil: boolean

  constructor(canvas: HTMLCanvasElement, juego: Incremental) {
    this.canvas = canvas
    this.juego = juego
    // En pantallas densas (móvil) el antialias multimuestra sale caro y apenas se nota.
    const dpr = window.devicePixelRatio || 1
    this.movil = dpr > 1.5 || window.innerWidth < 820
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.movil, alpha: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(dpr, this.movil ? 1.5 : 2))
    this.camara = new THREE.PerspectiveCamera(45, 1, 0.1, 120)

    // Luz: la estrella (fuera de plano, arriba a la derecha) más una ambiental tenue.
    const sol = new THREE.DirectionalLight(0xfff2d6, 2.2)
    sol.position.copy(POS_ESTRELLA)
    this.scene.add(sol)
    this.scene.add(new THREE.AmbientLight(0x404a66, 0.9))
    this.luzEstrella = new THREE.PointLight(0xffd27a, 0, 40, 1.5)
    this.luzEstrella.position.copy(POS_ESTRELLA)
    this.scene.add(this.luzEstrella)

    // La estrella: un resplandor (sprite) con un núcleo brillante.
    this.estrella = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texturaResplandor(), color: 0xffe3a3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    this.estrella.position.copy(POS_ESTRELLA)
    this.estrella.scale.setScalar(7)
    this.scene.add(this.estrella)
    const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }))
    nucleo.position.copy(POS_ESTRELLA)
    this.scene.add(nucleo)

    // Rayo de la llamarada: un cilindro fino y luminoso entre la estrella y el planeta, reutilizado en cada clic.
    const largo = POS_ESTRELLA.length() - RADIO_PLANETA
    this.rayo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.3, largo, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    )
    // El cilindro nace vertical: lo colocamos a medio camino y lo orientamos hacia la estrella.
    const dir = POS_ESTRELLA.clone().normalize()
    this.rayo.position.copy(dir).multiplyScalar(RADIO_PLANETA + largo / 2)
    this.rayo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    this.rayo.visible = false
    this.scene.add(this.rayo)

    // Planeta y atmósfera
    const seg = this.movil ? 32 : 48
    this.planeta = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO_PLANETA, seg, seg),
      new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.8, metalness: 0.05, emissive: 0x0a1a33, emissiveIntensity: 0.6 }),
    )
    this.scene.add(this.planeta)
    this.atmosfera = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO_PLANETA * 1.1, seg, seg),
      new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.18, side: THREE.BackSide }),
    )
    this.scene.add(this.atmosfera)

    // Continentes: manchas aleatorias fijas sobre la esfera.
    const tierra = new THREE.Group()
    const matTierra = new THREE.MeshStandardMaterial({ color: 0x4caf6a, roughness: 0.9 })
    let semilla = 7
    const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.25 + rnd() * 0.3, 10, 10), matTierra)
      const u = rnd() * Math.PI * 2
      const v = Math.acos(2 * rnd() - 1)
      m.position.setFromSphericalCoords(RADIO_PLANETA * 0.93, v, u)
      m.scale.set(1, 1, 0.35)
      m.lookAt(0, 0, 0)
      tierra.add(m)
    }
    this.planeta.add(tierra)

    // Estrellas de fondo
    const n = this.movil ? 500 : 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 50 + Math.random() * 30
      const u = Math.random() * Math.PI * 2
      const v = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(v) * Math.cos(u)
      pos[i * 3 + 1] = r * Math.sin(v) * Math.sin(u)
      pos[i * 3 + 2] = r * Math.cos(v)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.8 })))

    // Capas de órbita, una por tipo de edificio
    for (const e of CONFIG.edificios) {
      const ap = APARIENCIAS[e.id]
      const malla = new THREE.InstancedMesh(this.geometria(ap), this.material(ap), MAX_POR_TIPO)
      malla.count = 0
      malla.frustumCulled = false
      const grupo = new THREE.Group()
      grupo.rotation.x = ap.inclinacion
      grupo.rotation.z = ap.inclinacion * 0.5
      grupo.add(malla)
      // Línea de órbita tenue: se enciende al comprar el primero y se usa para leer qué órbita es cuál.
      const anillo = new THREE.Mesh(
        new THREE.RingGeometry(ap.radio - 0.012, ap.radio + 0.012, 96),
        new THREE.MeshBasicMaterial({ color: ap.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      )
      anillo.rotation.x = Math.PI / 2
      grupo.add(anillo)
      // Los segmentos Dyson no orbitan el planeta: van cerrando una cáscara alrededor de la estrella.
      if (ap.forma === 'segmento') {
        grupo.position.copy(POS_ESTRELLA)
        anillo.visible = false
      }
      this.scene.add(grupo)
      const fases = Array.from({ length: MAX_POR_TIPO }, () => Math.random() * Math.PI * 2)
      this.capas.set(e.id, { id: e.id, malla, apariencia: ap, grupo, anillo, fases, visibles: 0 })
    }

    this.redimensionar()
    new ResizeObserver(() => this.redimensionar()).observe(canvas)
    this.poblacion(0)
    this.distancia = this.distanciaObjetivo
  }

  private geometria(ap: Apariencia): THREE.BufferGeometry {
    const s = ap.tamano * 1.6
    switch (ap.forma) {
      case 'panel': return new THREE.BoxGeometry(s * 2.2, s * 0.08, s * 1.2)
      case 'esfera': return new THREE.SphereGeometry(s, 14, 14)
      case 'cubo': return new THREE.BoxGeometry(s, s, s)
      case 'toro': return new THREE.TorusGeometry(s, s * 0.3, 8, 20)
      case 'roca': return new THREE.DodecahedronGeometry(s, 0)
      case 'vela': return new THREE.ConeGeometry(s, s * 2.2, 4, 1, true)
      case 'segmento': return new THREE.TorusGeometry(s, s * 0.12, 6, 20, Math.PI * 0.5)
    }
  }

  private material(ap: Apariencia): THREE.Material {
    const translucido = ap.forma === 'vela' || ap.forma === 'segmento'
    return new THREE.MeshStandardMaterial({
      color: ap.color,
      roughness: 0.5,
      metalness: 0.35,
      emissive: ap.color,
      emissiveIntensity: 0.25,
      transparent: translucido,
      opacity: translucido ? 0.75 : 1,
      side: translucido ? THREE.DoubleSide : THREE.FrontSide,
    })
  }

  private redimensionar() {
    const r = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(r.width))
    const h = Math.max(1, Math.floor(r.height))
    this.renderer.setSize(w, h, false)
    this.camara.aspect = w / h
    this.camara.updateProjectionMatrix()
  }

  /** El total no basta: la escena necesita las cantidades por tipo, que lee del juego. */
  poblacion(_n: number) {
    const c = this.juego.estado.edificios
    this.cantidades = c
    let radioExterior = APARIENCIAS.panel.radio
    for (const [id, capa] of this.capas) {
      const n = c[id] ?? 0
      capa.visibles = Math.min(MAX_POR_TIPO, n)
      capa.malla.count = capa.visibles
      ;(capa.anillo.material as THREE.MeshBasicMaterial).opacity = n > 0 ? 0.22 : 0
      if (n > 0 && capa.apariencia.forma !== 'segmento') radioExterior = Math.max(radioExterior, capa.apariencia.radio)
    }
    // Encuadre: lo justo para que la órbita más exterior poblada quepa entera.
    // En pantallas estrechas (móvil en vertical) hay que alejarse algo más.
    const estrechez = Math.max(1, 1.45 / this.camara.aspect) ** 0.6
    this.distanciaObjetivo = (5 + radioExterior * 1.3) * estrechez
  }

  /** Llamarada: la estrella destella y lanza un rayo al planeta, que responde con una onda. */
  clic(_x: number, _y: number) {
    this.pulso = 1
    this.vidaRayo = 1
    this.rayo.visible = true
    // Clicar muy rápido no debe llenar la escena de aros: como mucho 4 vivos, y nunca dos casi iguales.
    if (this.ondas.some((o) => o.vida > 0.85)) return
    if (this.ondas.length >= 4) this.eliminarOnda(this.ondas.shift()!)
    const onda = new THREE.Mesh(
      new THREE.RingGeometry(RADIO_PLANETA * 1.12, RADIO_PLANETA * 1.18, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    onda.lookAt(this.camara.position)
    this.scene.add(onda)
    this.ondas.push({ malla: onda, vida: 1 })
  }

  private eliminarOnda(o: Onda) {
    this.scene.remove(o.malla)
    o.malla.geometry.dispose()
    ;(o.malla.material as THREE.Material).dispose()
  }

  /** Reparte los segmentos Dyson sobre una esfera (espiral de Fibonacci) que gira despacio alrededor de la estrella. */
  private colocarCascara(capa: Capa, crecimiento: number) {
    const { malla, apariencia: ap, visibles } = capa
    capa.grupo.rotation.y = this.tiempo * ap.velocidad
    const dorado = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < visibles; i++) {
      // Siempre MAX_POR_TIPO huecos: los segmentos van rellenando la esfera en orden.
      const y = 1 - (2 * (i + 0.5)) / MAX_POR_TIPO
      const r = Math.sqrt(1 - y * y)
      const a = dorado * i
      this.dummy.position.set(Math.cos(a) * r * ap.radio, y * ap.radio, Math.sin(a) * r * ap.radio)
      this.dummy.lookAt(0, 0, 0)
      this.dummy.rotateZ(a)
      this.dummy.scale.setScalar(crecimiento)
      this.dummy.updateMatrix()
      malla.setMatrixAt(i, this.dummy.matrix)
    }
    if (visibles > 0) malla.instanceMatrix.needsUpdate = true
  }

  frame(dt: number) {
    this.tiempo += dt
    this.pulso = Math.max(0, this.pulso - dt * 3)
    const esc = 1 + this.pulso * 0.08
    this.planeta.scale.setScalar(esc)
    this.atmosfera.scale.setScalar(esc)
    ;(this.atmosfera.material as THREE.MeshBasicMaterial).opacity = 0.18 + this.pulso * 0.3
    this.planeta.rotation.y += dt * 0.08
    this.estrella.scale.setScalar(7 + Math.sin(this.tiempo * 1.3) * 0.25 + this.pulso * 3)
    this.luzEstrella.intensity = this.pulso * 60

    for (const capa of this.capas.values()) {
      const { malla, apariencia: ap, fases, visibles } = capa
      // Más de MAX_POR_TIPO unidades: los objetos crecen un poco para seguir mostrando progreso.
      const total = this.cantidades[capa.id] ?? 0
      const crecimiento = total > MAX_POR_TIPO ? 1 + Math.log10(total / MAX_POR_TIPO) * 0.35 : 1
      if (ap.forma === 'segmento') {
        this.colocarCascara(capa, crecimiento)
        continue
      }
      for (let i = 0; i < visibles; i++) {
        const a = fases[i] + this.tiempo * ap.velocidad
        const bamboleo = Math.sin(this.tiempo * 0.7 + fases[i]) * 0.08
        this.dummy.position.set(Math.cos(a) * ap.radio, bamboleo, Math.sin(a) * ap.radio)
        this.dummy.rotation.set(fases[i], -a, fases[i] * 0.5 + this.tiempo * 0.3)
        this.dummy.scale.setScalar(crecimiento)
        this.dummy.updateMatrix()
        malla.setMatrixAt(i, this.dummy.matrix)
      }
      if (visibles > 0) malla.instanceMatrix.needsUpdate = true
    }

    this.ondas = this.ondas.filter((o) => {
      o.vida -= dt * 2.2
      if (o.vida <= 0) {
        this.eliminarOnda(o)
        return false
      }
      o.malla.scale.setScalar(1 + (1 - o.vida) * 2.2)
      ;(o.malla.material as THREE.MeshBasicMaterial).opacity = o.vida * 0.9
      return true
    })
    if (this.vidaRayo > 0) {
      this.vidaRayo = Math.max(0, this.vidaRayo - dt * 2.5)
      // El rayo se afina y se apaga; el cilindro está abierto, así que solo escalamos su grosor.
      this.rayo.scale.set(this.vidaRayo, 1, this.vidaRayo)
      ;(this.rayo.material as THREE.MeshBasicMaterial).opacity = this.vidaRayo * 0.85
      this.rayo.visible = this.vidaRayo > 0
    }

    // Cámara: se aleja suavemente según crece la órbita y lleva un vaivén lento.
    this.distancia += (this.distanciaObjetivo - this.distancia) * Math.min(1, dt * 1.5)
    const d = this.distancia
    this.camara.position.set(Math.sin(this.tiempo * 0.05) * d * 0.18, d * 0.42 + Math.sin(this.tiempo * 0.08) * 0.05 * d, d)
    this.camara.lookAt(0, 0, 0)
    this.renderer.render(this.scene, this.camara)
  }
}

/** Textura radial blanca → transparente para el resplandor de la estrella. */
function texturaResplandor(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,240,200,0.8)')
  g.addColorStop(0.5, 'rgba(255,200,120,0.25)')
  g.addColorStop(1, 'rgba(255,180,80,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
