import * as THREE from 'three'

const loader = new THREE.TextureLoader()

// Basis-Texturen pro URL + colorSpace. Clones teilen sich die Source (ein
// GPU-Upload), behalten aber eigene offset/repeat - noetig fuer die
// Frame-Offsets pro Enemy.
const cache = new Map<string, Promise<THREE.Texture>>()

export interface PixelTextureOptions {
  // Nur fuer Welt-Geometrie (Wand-Tiles): grosse Texturen auf weit entfernten
  // Flaechen flimmern ohne Mipmaps stark. magFilter bleibt in beiden Faellen
  // NearestFilter, aus der Naehe bleiben die Pixel also hart.
  mipmaps?: boolean
}

// Anisotropy haengt am Renderer, den die Asset-Consumer nicht kennen. Game setzt
// das Maximum einmal beim Start; 1 ist der neutrale Default (u. a. fuer Tests).
let maxAnisotropy: number = 1

export function setMaxAnisotropy(value: number): void {
  maxAnisotropy = value
}

function loadBaseTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  mipmaps: boolean
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      tex => {
        tex.magFilter = THREE.NearestFilter

        if (mipmaps) {
          tex.minFilter = THREE.NearestMipmapLinearFilter
          tex.generateMipmaps = true
          // Wichtig fuer Waende im flachen Blickwinkel (langer Korridor).
          tex.anisotropy = maxAnisotropy
        } else {
          tex.minFilter = THREE.NearestFilter

          // 🔥 WICHTIG für Pixel-Art
          tex.generateMipmaps = false
        }

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
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  opts: PixelTextureOptions = {}
): Promise<THREE.Texture> {
  const mipmaps: boolean = opts.mipmaps ?? false
  // colorSpace gehoert in den Key: derselbe Pfad kann bewusst unterschiedlich
  // getaggt gebraucht werden, sonst gewinnt der erste Aufrufer.
  // mipmaps ebenso - Klone teilen sich die source und damit den GPU-Upload, eine
  // gemipmappte und eine ungemipmappte Variante wuerden sich gegenseitig
  // ueberschreiben. Getrennte Keys = getrennte Base-Texturen.
  const key: string = `${url}|${colorSpace}|${mipmaps}`
  let base: Promise<THREE.Texture> | undefined = cache.get(key)
  if (!base) {
    base = loadBaseTexture(url, colorSpace, mipmaps)
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
