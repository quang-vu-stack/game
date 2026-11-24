import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function mountOffice(container: HTMLElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.domElement.setAttribute('aria-label', 'Mô hình 3D văn phòng xây dựng')
  container.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xdce6df)
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
  camera.position.set(13, 12, 16)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.8, 0)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 9
  controls.maxDistance = 28
  controls.maxPolarAngle = 1.48

  scene.add(new THREE.HemisphereLight(0xfff8e8, 0x658276, 2.5))
  const sun = new THREE.DirectionalLight(0xffefce, 2.3)
  sun.position.set(-5, 12, 7)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.normalBias = 0.04
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 })
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)

  function box(parent: THREE.Object3D, color: number, size: number[], position: number[]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color }))
    mesh.position.set(position[0], position[1], position[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  box(scene, 0x376057, [11, 0.32, 8], [0, -0.16, 0])
  for (let i = 0; i < 11; i++) {
    box(scene, i % 2 ? 0xdac298 : 0xe8d3ae, [0.985, 0.05, 7.9], [i - 5, 0.02, 0])
  }
  box(scene, 0x52796f, [11, 2.9, 0.14], [0, 1.45, -3.93])
  box(scene, 0xd8dbca, [0.14, 2.9, 7.9], [-5.43, 1.45, 0])
  for (const x of [-1.5, 0.3, 2.1, 3.9]) {
    box(scene, 0x254640, [1.65, 1.4, 0.08], [x, 1.78, -3.84])
    box(scene, 0x9bd0c4, [1.49, 1.23, 0.08], [x, 1.78, -3.79])
  }
  box(scene, 0xefede0, [0.06, 1.32, 2.9], [-5.31, 1.67, -0.9])
  for (let i = 0; i < 3; i++) {
    box(scene, 0x6e8780, [0.075, 0.05, 1.83 - i * 0.35], [-5.27, 1.95 - i * 0.27, -0.9])
  }

  const staff: THREE.Group[] = []
  for (const [x, z, shirt] of [[-3, -2.2, 0xdf8e4f], [0, -1.55, 0x327f76], [3.1, -0.9, 0x6683a1]]) {
    box(scene, 0xb47850, [2.3, 0.14, 1.12], [x, 0.93, z])
    for (const side of [-0.94, 0.94]) {
      box(scene, 0x364641, [0.13, 0.9, 0.88], [x + side, 0.45, z])
    }
    box(scene, 0x203832, [0.78, 0.51, 0.1], [x, 1.3, z - 0.22])
    box(scene, 0x96c7b9, [0.67, 0.4, 0.05], [x, 1.3, z - 0.145])
    box(scene, 0xf9f6e8, [0.42, 0.045, 0.3], [x - 0.7, 1.03, z + 0.14])

    const person = new THREE.Group()
    person.position.set(x, 0, z + 0.91)
    box(person, 0x30433f, [0.47, 0.14, 0.45], [0, 0.56, 0.03])
    box(person, shirt, [0.47, 0.57, 0.33], [0, 0.9, 0])
    box(person, 0xd8a17a, [0.37, 0.37, 0.35], [0, 1.37, 0])
    box(person, 0x413a30, [0.39, 0.105, 0.37], [0, 1.55, 0])
    box(person, 0x263e38, [0.12, 0.53, 0.13], [0, 0.28, 0.05])
    staff.push(person)
    scene.add(person)
  }

  box(scene, 0x70998a, [4.4, 0.025, 2.25], [0, 0.062, 2.52])
  box(scene, 0x8b5940, [2.5, 0.13, 1.2], [0, 0.77, 2.52])
  for (const x of [-0.9, 0.9]) box(scene, 0x31433d, [0.13, 0.75, 0.74], [x, 0.37, 2.52])
  for (const [x, z] of [[4.75, -3], [-4.5, 2.9], [4.65, 2.5]]) {
    box(scene, 0xb45c40, [0.48, 0.43, 0.48], [x, 0.22, z])
    box(scene, 0x2c694f, [0.49, 0.73, 0.46], [x, 0.74, z]).rotation.y = 0.25
    box(scene, 0x6a9a68, [0.41, 0.47, 0.41], [x + 0.12, 1.06, z]).rotation.y = -0.34
  }

  function resize() {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  renderer.setAnimationLoop(time => {
    staff.forEach((person, index) => {
      person.rotation.y = Math.sin(time / 1300 + index) * 0.17
    })
    controls.update()
    renderer.render(scene, camera)
  })

  return () => {
    observer.disconnect()
    renderer.setAnimationLoop(null)
    controls.dispose()
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (object.material instanceof THREE.Material) object.material.dispose()
      }
    })
    renderer.dispose()
    renderer.domElement.remove()
  }
}
