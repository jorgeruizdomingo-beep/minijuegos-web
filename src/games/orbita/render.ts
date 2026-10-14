/**
 * Escena 3D con Three.js: un planeta, su estrella y, en órbitas concéntricas,
 * un objeto por cada edificio comprado (con tope por tipo para rendir bien).
 */
import * as THREE from 'three'
import type { Escena } from '../../core/arranque'
import type { Incremental } from '../../core/incremental'
import { APARIENCIAS, CONFIG, type Apariencia } from './data'

const MAX_POR_TIPO = 60

type Capa = {
  id: string
  malla: THREE.InstancedMesh
  apariencia: Apariencia
  grupo: THREE.Group // inclinación de la órbita
  fases: number[]
  visibles: number
}

export class EscenaOrbita implements Escena {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camara: THREE.PerspectiveCamera
  private planeta: THREE.Mesh
  private atmosfera: THREE.Mesh
  private capas = new Map<string, Capa>()
  private ondas: { malla: THREE.Mesh; vida: number }[] = []
  private tiempo = 0
  private pulso = 0
  private cantidades: Record<string, number> = {}
  private canvas: HTMLCanvasElement
  private juego: Incremental
  private dummy = new THREE.Object3D()

  constructor(canvas: HTMLCanvasElement, juego: Incremental) {
    this.canvas = canvas
    this.juego = juego
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.camara = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camara.position.set(0, 5.5, 13)
    this.camara.lookAt(0, 0, 0)

    // Luz: la estrella, fuera de plano a la derecha, más una ambiental tenue.
    const sol = new THREE.DirectionalLight(0xfff2d6, 2.2)
    sol.position.set(8, 4, 6)
    this.scene.add(sol)
    this.scene.add(new THREE.AmbientLight(0x404a66, 0.9))

    // Planeta y atmósfera
    this.planeta = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.8, metalness: 0.05, emissive: 0x0a1a33, emissiveIntensity: 0.6 }),
    )
    this.scene.add(this.planeta)
    this.atmosfera = new THREE.Mesh(
      new THREE.SphereGeometry(1.32, 48, 48),
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
      m.position.setFromSphericalCoords(1.12, v, u)
      m.scale.set(1, 1, 0.35)
      m.lookAt(0, 0, 0)
      tierra.add(m)
    }
    this.planeta.add(tierra)

    // Estrellas de fondo
    const n = 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 40 + Math.random() * 30
      const u = Math.random() * Math.PI * 2
      const v = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(v) * Math.cos(u)
      pos[i * 3 + 1] = r * Math.sin(v) * Math.sin(u)
      pos[i * 3 + 2] = r * Math.cos(v)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8 })))

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
      // Línea de órbita tenue
      const anillo = new THREE.Mesh(
        new THREE.RingGeometry(ap.radio - 0.01, ap.radio + 0.01, 96),
        new THREE.MeshBasicMaterial({ color: ap.color, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
      )
      anillo.rotation.x = Math.PI / 2
      anillo.name = 'anillo'
      grupo.add(anillo)
      this.scene.add(grupo)
      const fases = Array.from({ length: MAX_POR_TIPO }, () => Math.random() * Math.PI * 2)
      this.capas.set(e.id, { id: e.id, malla, apariencia: ap, grupo, fases, visibles: 0 })
    }

    this.redimensionar()
    new ResizeObserver(() => this.redimensionar()).observe(canvas)
  }

  private geometria(ap: Apariencia): THREE.BufferGeometry {
    const s = ap.tamano * 1.6
    switch (ap.forma) {
      case 'panel': return new THREE.BoxGeometry(s * 2.2, s * 0.08, s * 1.2)
      case 'esfera': return new THREE.SphereGeometry(s, 16, 16)
      case 'cubo': return new THREE.BoxGeometry(s, s, s)
      case 'toro': return new THREE.TorusGeometry(s, s * 0.3, 10, 24)
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
    for (const [id, capa] of this.capas) {
      const n = c[id] ?? 0
      capa.visibles = Math.min(MAX_POR_TIPO, n)
      capa.malla.count = capa.visibles
      const anillo = capa.grupo.getObjectByName('anillo') as THREE.Mesh
      ;(anillo.material as THREE.MeshBasicMaterial).opacity = n > 0 ? 0.18 : 0
    }
  }

  clic(_x: number, _y: number) {
    this.pulso = 1
    const onda = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.45, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    )
    onda.lookAt(this.camara.position)
    this.scene.add(onda)
    this.ondas.push({ malla: onda, vida: 1 })
  }

  frame(dt: number) {
    this.tiempo += dt
    this.pulso = Math.max(0, this.pulso - dt * 3)
    const esc = 1 + this.pulso * 0.08
    this.planeta.scale.setScalar(esc)
    this.atmosfera.scale.setScalar(esc)
    ;(this.atmosfera.material as THREE.MeshBasicMaterial).opacity = 0.18 + this.pulso * 0.3
    this.planeta.rotation.y += dt * 0.08

    for (const capa of this.capas.values()) {
      const { malla, apariencia: ap, fases, visibles } = capa
      // Más de MAX_POR_TIPO unidades: los objetos crecen un poco para seguir mostrando progreso.
      const total = this.cantidades[capa.id] ?? 0
      const crecimiento = total > MAX_POR_TIPO ? 1 + Math.log10(total / MAX_POR_TIPO) * 0.6 : 1
      for (let i = 0; i < visibles; i++) {
        const a = fases[i] + this.tiempo * ap.velocidad
        const bamboleo = Math.sin(this.tiempo * 0.7 + fases[i]) * 0.08
        this.dummy.position.set(Math.cos(a) * ap.radio, bamboleo, Math.sin(a) * ap.radio)
        this.dummy.rotation.set(fases[i], -a, fases[i] * 0.5 + this.tiempo * 0.3)
        this.dummy.scale.setScalar(crecimiento)
        this.dummy.updateMatrix()
        malla.setMatrixAt(i, this.dummy.matrix)
      }
      malla.instanceMatrix.needsUpdate = true
    }

    this.ondas = this.ondas.filter((o) => {
      o.vida -= dt * 1.6
      if (o.vida <= 0) {
        this.scene.remove(o.malla)
        o.malla.geometry.dispose()
        ;(o.malla.material as THREE.Material).dispose()
        return false
      }
      const s = 1 + (1 - o.vida) * 2.5
      o.malla.scale.setScalar(s)
      ;(o.malla.material as THREE.MeshBasicMaterial).opacity = o.vida * 0.9
      return true
    })

    // Cámara con un vaivén lento para dar sensación de profundidad.
    this.camara.position.x = Math.sin(this.tiempo * 0.05) * 2.5
    this.camara.position.y = 5.5 + Math.sin(this.tiempo * 0.08) * 0.6
    this.camara.lookAt(0, 0, 0)
    this.renderer.render(this.scene, this.camara)
  }
}
