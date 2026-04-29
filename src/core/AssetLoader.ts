import * as THREE from 'three'

const loader = new THREE.TextureLoader()

export function loadPixelTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      tex => {
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter

        // 🔥 WICHTIG für Pixel-Art
        tex.generateMipmaps = false

        // optional, aber sauber:
        tex.colorSpace = THREE.SRGBColorSpace

        tex.needsUpdate = true

        resolve(tex)
      },
      undefined,
      reject
    )
  })
}
