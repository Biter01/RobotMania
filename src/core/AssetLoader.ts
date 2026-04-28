import * as THREE from 'three'

const loader = new THREE.TextureLoader()

export function loadPixelTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      tex => {
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter
        resolve(tex)
      },
      undefined,
      reject
    )
  })
}
