import * as THREE from 'three'

const loader = new THREE.TextureLoader()

// Basis-Texturen pro URL + colorSpace. Clones teilen sich die Source (ein
// GPU-Upload), behalten aber eigene offset/repeat - noetig fuer die
// Frame-Offsets pro Enemy.
const cache = new Map<string, Promise<THREE.Texture>>()

function loadBaseTexture(url: string, colorSpace: THREE.ColorSpace): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      tex => {
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter

        // 🔥 WICHTIG für Pixel-Art
        tex.generateMipmaps = false

        tex.colorSpace = colorSpace

        tex.needsUpdate = true

        resolve(tex)
      },
      undefined,
      reject
    )
  })
}

export function loadPixelTexture(
  url: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace
): Promise<THREE.Texture> {
  // colorSpace gehoert in den Key: derselbe Pfad kann bewusst unterschiedlich
  // getaggt gebraucht werden, sonst gewinnt der erste Aufrufer.
  const key: string = `${url}|${colorSpace}`
  let base: Promise<THREE.Texture> | undefined = cache.get(key)
  if (!base) {
    base = loadBaseTexture(url, colorSpace)
    cache.set(key, base)
  }
  // clone() teilt sich die Source -> ein GPU-Upload fuer alle Klone (three
  // zaehlt die Referenzen pro Source), aber eigene offset/repeat pro Instanz.
  // Kein needsUpdate hier: das wuerde source.version bumpen und die bereits
  // hochgeladene Textur unnoetig neu uebertragen.
  return base.then((tex: THREE.Texture) => tex.clone())
}

// Harter Reset des Caches (Tests / Level-Wechsel). Nicht in Game.dispose() aufrufen -
// der Cache soll Retries ueberleben.
export function disposeTextureCache(): void {
  for (const pending of cache.values()) {
    pending.then((tex: THREE.Texture) => tex.dispose()).catch(() => {})
  }
  cache.clear()
}
