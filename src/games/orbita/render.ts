/**
 * Escena 3D con Three.js: un planeta, su estrella y, en órbitas concéntricas,
 * un objeto por cada edificio comprado (con tope por tipo para rendir bien).
 * La cámara se aleja sola a medida que se pueblan las órbitas exteriores.
 */
import * as THREE from 'three'
import type { Escena } from '../../core/arranque'
import type { Incremental } from '../../core/incremental'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { APARIENCIAS, CONFIG, type Apariencia } from './data'
import { atlas, modelo, texturasPlaneta } from './modelos'

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
  nacimientos: number[] // instante (tiempo de escena) en que apareció cada unidad, para animar su llegada
  visibles: number
}

type Onda = { malla: THREE.Mesh; vida: number }

export class EscenaOrbita implements Escena {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camara: THREE.PerspectiveCamera
  private planeta: THREE.Mesh
  private atmosfera: THREE.Mesh
  private nubes: THREE.Mesh
  private estrella: THREE.Sprite
  private luzEstrella: THREE.PointLight
  private capas = new Map<string, Capa>()
  private ondas: Onda[] = []
  private rayo: THREE.Mesh
  private vidaRayo = 0
  private supernova: THREE.Mesh
  private vidaSupernova = 0
  private vidas = -1
  private cometa: THREE.Group
  private vidaCometa = 0
  private proximoCometa = 25
  private origenCometa = new THREE.Vector3()
  private destinoCometa = new THREE.Vector3()
  private tiempo = 0
  private pulso = 0
  private distancia = 9
  private distanciaObjetivo = 9
  private cantidades: Record<string, number> = {}
  private canvas: HTMLCanvasElement
  private juego: Incremental
  private dummy = new THREE.Object3D()
  private movil: boolean
  // Elementos que aparecen según el árbol permanente y la historia de la partida.
  private anillos: THREE.Mesh
  private luna: THREE.Mesh
  private nebulosa: THREE.Sprite
  private fondo: THREE.Points
  private sol: THREE.DirectionalLight
  private nucleo: THREE.Mesh
  private matPlaneta: THREE.MeshStandardMaterial
  private matModelos: THREE.MeshStandardMaterial
  private brilloCiudades = 0.35
  private estrellaLocal = new THREE.Vector3()
  private escalaEstrella = 7
  private opacidadAtmosfera = 0.18

  constructor(canvas: HTMLCanvasElement, juego: Incremental) {
    this.canvas = canvas
    this.juego = juego
    // En pantallas densas (móvil) el antialias multimuestra sale caro y apenas se nota.
    const dpr = window.devicePixelRatio || 1
    this.movil = dpr > 1.5 || window.innerWidth < 820
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.movil, alpha: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(dpr, this.movil ? 1.5 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.camara = new THREE.PerspectiveCamera(45, 1, 0.1, 120)
    // Entorno neutro para que los metales y los espejos reflejen algo (sin él salen negros).
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.35
    pmrem.dispose()
    // Un solo material para todos los modelos: el atlas pone el detalle y las partes que brillan.
    const { mapa, emisivo } = atlas()
    this.matModelos = new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: emisivo, emissive: 0xffffff, emissiveIntensity: 1.4, vertexColors: true, metalness: 0.4, roughness: 0.48 })

    // Luz: la estrella (fuera de plano, arriba a la derecha) más una ambiental tenue.
    const sol = new THREE.DirectionalLight(0xfff2d6, 2.6)
    sol.position.copy(POS_ESTRELLA)
    this.scene.add(sol)
    this.sol = sol
    this.scene.add(new THREE.AmbientLight(0x404a66, 0.5))
    // Luz de relleno fría desde abajo (la que devuelve el planeta), para que la cara en sombra no sea negra.
    this.scene.add(new THREE.HemisphereLight(0x6b7fa8, 0x1a2a4a, 0.55))
    this.luzEstrella = new THREE.PointLight(0xffd27a, 0, 40, 1.5)
    this.luzEstrella.position.copy(POS_ESTRELLA)
    this.scene.add(this.luzEstrella)

    // La estrella: un resplandor (sprite) con un núcleo brillante.
    this.estrella = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texturaResplandor(), color: 0xffe3a3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    this.estrella.position.copy(POS_ESTRELLA)
    this.estrella.scale.setScalar(7)
    this.scene.add(this.estrella)
    const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff4d0, toneMapped: false }))
    nucleo.position.copy(POS_ESTRELLA)
    this.scene.add(nucleo)
    this.nucleo = nucleo

    // Rayo de la llamarada: un cilindro fino y luminoso entre la estrella y el planeta, reutilizado en cada clic.
    const largo = POS_ESTRELLA.length() - RADIO_PLANETA
    this.rayo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.3, largo, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }),
    )
    // El cilindro nace vertical: lo colocamos a medio camino y lo orientamos hacia la estrella.
    const dir = POS_ESTRELLA.clone().normalize()
    this.rayo.position.copy(dir).multiplyScalar(RADIO_PLANETA + largo / 2)
    this.rayo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    this.rayo.visible = false
    this.scene.add(this.rayo)

    // Supernova: una esfera luminosa que se expande desde la estrella al prestigiar.
    this.supernova = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }),
    )
    this.supernova.position.copy(POS_ESTRELLA)
    this.supernova.visible = false
    this.scene.add(this.supernova)

    // Cometa ocasional: cabeza brillante con cola, cruza la escena de vez en cuando (solo decorativo).
    this.cometa = new THREE.Group()
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: 0xdff6ff, toneMapped: false }))
    const cola = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 2.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }),
    )
    // El cono apunta hacia -Z (dirección de avance invertida): la cola queda detrás de la cabeza.
    cola.rotation.x = -Math.PI / 2
    cola.position.z = 1.1
    this.cometa.add(cabeza, cola)
    this.cometa.visible = false
    this.scene.add(this.cometa)

    // Planeta y atmósfera
    const seg = this.movil ? 40 : 64
    const texturas = texturasPlaneta()
    this.matPlaneta = new THREE.MeshStandardMaterial({ map: texturas.mapa, emissiveMap: texturas.luces, emissive: 0xffffff, emissiveIntensity: this.brilloCiudades, roughness: 0.75, metalness: 0.05, envMapIntensity: 0.2 })
    this.planeta = new THREE.Mesh(new THREE.SphereGeometry(RADIO_PLANETA, seg, seg), this.matPlaneta)
    this.scene.add(this.planeta)
    this.atmosfera = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO_PLANETA * 1.1, seg, seg),
      new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.18, side: THREE.BackSide }),
    )
    this.scene.add(this.atmosfera)
    this.nubes = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO_PLANETA * 1.03, seg, seg),
      new THREE.MeshStandardMaterial({ map: texturaNubes(), transparent: true, opacity: 0.6, roughness: 1, depthWrite: false }),
    )
    this.scene.add(this.nubes)

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
    this.fondo = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.8 }))
    this.scene.add(this.fondo)

    // Desbloqueos del árbol: anillos del planeta, luna natural y nebulosa de fondo. Ocultos hasta comprarlos.
    this.anillos = new THREE.Mesh(
      new THREE.RingGeometry(RADIO_PLANETA * 1.25, RADIO_PLANETA * 1.6, 64),
      new THREE.MeshBasicMaterial({ color: 0xd8c6a2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.anillos.rotation.set(Math.PI / 2 + 0.45, 0, 0.2)
    this.anillos.visible = false
    this.scene.add(this.anillos)
    this.luna = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 1 }))
    this.luna.visible = false
    this.scene.add(this.luna)
    this.nebulosa = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaResplandor(), color: 0x7a5cff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
    this.nebulosa.position.set(-16, 5, -34)
    this.nebulosa.scale.set(46, 30, 1)
    this.nebulosa.visible = false
    this.scene.add(this.nebulosa)

    // Capas de órbita, una por tipo de edificio
    for (const e of CONFIG.edificios) {
      const ap = APARIENCIAS[e.id]
      const malla = new THREE.InstancedMesh(this.geometria(e.id, ap), this.matModelos, MAX_POR_TIPO)
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
      this.capas.set(e.id, { id: e.id, malla, apariencia: ap, grupo, anillo, fases, nacimientos: new Array(MAX_POR_TIPO).fill(-10), visibles: 0 })
    }

    this.redimensionar()
    new ResizeObserver(() => this.redimensionar()).observe(canvas)
    this.poblacion(0)
    this.distancia = this.distanciaObjetivo
  }

  /** Modelo del edificio (ver modelos.ts) a la escala de su apariencia. Los segmentos Dyson llevan el radio de la cáscara. */
  private geometria(id: string, ap: Apariencia): THREE.BufferGeometry {
    const s = ap.tamano * 1.6
    const g = modelo(id, this.movil ? 'bajo' : 'alto', ap.forma === 'segmento' ? ap.radio / s : 2)
    g.scale(s, s, s)
    g.computeBoundingSphere()
    return g
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
    // Un prestigio nuevo (cambia el número de vidas) dispara la supernova.
    const vidas = this.juego.estado.vidas
    if (this.vidas >= 0 && vidas !== this.vidas) {
      this.vidaSupernova = 1
      this.supernova.visible = true
      this.pulso = 1.5
    }
    this.vidas = vidas
    let radioExterior = APARIENCIAS.panel.radio
    for (const [id, capa] of this.capas) {
      const n = c[id] ?? 0
      const visibles = Math.min(MAX_POR_TIPO, n)
      // Cada compra nueva entra con una pequeña animación de llegada.
      for (let i = capa.visibles; i < visibles; i++) capa.nacimientos[i] = this.tiempo
      capa.visibles = visibles
      capa.malla.count = visibles
      ;(capa.anillo.material as THREE.MeshBasicMaterial).opacity = n > 0 ? 0.22 : 0
      if (n > 0 && capa.apariencia.forma !== 'segmento') radioExterior = Math.max(radioExterior, capa.apariencia.radio)
    }
    // Encuadre: lo justo para que la órbita más exterior poblada quepa entera.
    // En pantallas estrechas (móvil en vertical) hay que alejarse algo más.
    const estrechez = Math.max(1, 1.45 / this.camara.aspect) ** 0.6
    this.distanciaObjetivo = (5 + radioExterior * 1.3) * estrechez
  }

  /** La escena evoluciona con el árbol permanente, los núcleos, las vidas y las mejoras compradas. */
  cambio() {
    const j = this.juego
    this.anillos.visible = j.tieneDesbloqueo('anillos')
    this.luna.visible = j.tieneDesbloqueo('luna')
    this.nebulosa.visible = j.tieneDesbloqueo('nebulosa')

    // Estrella: de amarilla a blanca con los núcleos acumulados; azul y más grande con el nodo Gigante azul.
    const azul = j.tieneDesbloqueo('estrella_azul')
    const t = azul ? 1 : Math.min(1, j.estado.prestigio / 40)
    const color = new THREE.Color(0xffe3a3).lerp(new THREE.Color(azul ? 0x9fd0ff : 0xfff8ec), t)
    ;(this.estrella.material as THREE.SpriteMaterial).color.copy(color)
    ;(this.nucleo.material as THREE.MeshBasicMaterial).color.copy(new THREE.Color(0xfff4d0).lerp(new THREE.Color(azul ? 0xd8ecff : 0xffffff), t))
    this.sol.color.copy(new THREE.Color(0xfff2d6).lerp(new THREE.Color(azul ? 0xcfe4ff : 0xffffff), t))
    this.escalaEstrella = azul ? 9.5 : 7 + t

    // Planeta: con cada vida (Supernova) las ciudades brillan más de noche y la atmósfera se espesa.
    const vida = Math.min(1, j.estado.vidas / 8)
    this.brilloCiudades = 0.35 + vida * 1.6
    this.matPlaneta.emissiveIntensity = this.brilloCiudades
    this.opacidadAtmosfera = 0.18 + vida * 0.14

    // Cielo: las mejoras globales compradas lo llenan de estrellas más brillantes.
    const globales = ['global_1', 'global_2', 'global_3', 'global_4', 'global_5', 'global_6'].filter((id) => j.tieneMejora(id)).length
    ;(this.fondo.material as THREE.PointsMaterial).opacity = 0.6 + globales * 0.07
    ;(this.fondo.material as THREE.PointsMaterial).size = 0.14 + globales * 0.02
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
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
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

  /** Cada 25-70 s cruza un cometa por detrás del planeta, de un lado a otro de la escena. */
  private animarCometa(dt: number) {
    if (this.vidaCometa <= 0) {
      this.proximoCometa -= dt
      if (this.proximoCometa > 0) return
      this.proximoCometa = 25 + Math.random() * 45
      this.vidaCometa = 1
      const lado = Math.random() < 0.5 ? -1 : 1
      const alto = -3 + Math.random() * 7
      this.origenCometa.set(lado * 16, alto, -6 - Math.random() * 8)
      this.destinoCometa.set(-lado * 16, alto - 2 + Math.random() * 4, -4 - Math.random() * 8)
      this.cometa.position.copy(this.origenCometa)
      this.cometa.lookAt(this.destinoCometa)
      this.cometa.visible = true
    }
    this.vidaCometa -= dt / 6
    if (this.vidaCometa <= 0) {
      this.cometa.visible = false
      return
    }
    this.cometa.position.lerpVectors(this.destinoCometa, this.origenCometa, this.vidaCometa)
  }

  /** Escala de una unidad según el tiempo desde que apareció: crece desde 0 con un pequeño rebote. */
  private llegada(nacimiento: number): number {
    const t = (this.tiempo - nacimiento) / 0.7
    if (t >= 1) return 1
    if (t <= 0) return 0.001
    // Rebote suave: pasa de 1,25 y vuelve a 1.
    return t < 0.6 ? (t / 0.6) * 1.25 : 1.25 - ((t - 0.6) / 0.4) * 0.25
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
      this.dummy.scale.setScalar(crecimiento * this.llegada(capa.nacimientos[i]))
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
    ;(this.atmosfera.material as THREE.MeshBasicMaterial).opacity = this.opacidadAtmosfera + this.pulso * 0.3
    this.planeta.rotation.y += dt * 0.08
    this.nubes.rotation.y += dt * 0.11
    this.nubes.scale.setScalar(esc)
    this.estrella.scale.setScalar(this.escalaEstrella + Math.sin(this.tiempo * 1.3) * 0.25 + this.pulso * 3)
    this.anillos.rotation.z = 0.2 + Math.sin(this.tiempo * 0.1) * 0.05
    if (this.luna.visible) this.luna.position.set(Math.cos(this.tiempo * 0.5) * 1.75, Math.sin(this.tiempo * 0.5) * 0.6, Math.sin(this.tiempo * 0.5) * 1.75)
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
      // Paneles, espejos y velas miran a la estrella; el resto apunta sus antenas al planeta.
      const miraEstrella = ap.forma === 'panel' || ap.forma === 'vela'
      if (miraEstrella) capa.grupo.worldToLocal(this.estrellaLocal.copy(POS_ESTRELLA))
      const giro = ap.forma === 'toro' ? 0.35 : 0.06
      for (let i = 0; i < visibles; i++) {
        const a = fases[i] + this.tiempo * ap.velocidad
        const bamboleo = Math.sin(this.tiempo * 0.7 + fases[i]) * 0.08
        this.dummy.position.set(Math.cos(a) * ap.radio, bamboleo, Math.sin(a) * ap.radio)
        if (miraEstrella) this.dummy.lookAt(this.estrellaLocal)
        else this.dummy.lookAt(0, 0, 0)
        this.dummy.rotateZ(fases[i] + this.tiempo * giro)
        this.dummy.scale.setScalar(crecimiento * this.llegada(capa.nacimientos[i]))
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
    if (this.vidaSupernova > 0) {
      this.vidaSupernova = Math.max(0, this.vidaSupernova - dt * 0.55)
      const t = 1 - this.vidaSupernova
      this.supernova.scale.setScalar(1 + t * 45)
      ;(this.supernova.material as THREE.MeshBasicMaterial).opacity = this.vidaSupernova ** 1.5 * 0.9
      this.luzEstrella.intensity = Math.max(this.luzEstrella.intensity, this.vidaSupernova * 200)
      this.supernova.visible = this.vidaSupernova > 0
    }
    this.animarCometa(dt)

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

/** Textura de nubes: manchas blancas suaves sobre fondo transparente, sin costuras en horizontal. */
function texturaNubes(): THREE.Texture {
  const w = 512, h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  let semilla = 11
  const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * w
    // Menos nubes en los polos (bordes verticales de la textura).
    const y = h * (0.15 + rnd() * 0.7)
    const r = 12 + rnd() * 28
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    // Dibujada tres veces para que la costura izquierda/derecha no se note.
    for (const dx of [-w, 0, w]) ctx.fillRect(x + dx - r, y - r, r * 2, r * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
