import * as THREE from 'three'

const loader = new THREE.TextureLoader()

/**
 * Base textures per URL + colorSpace + mipmaps. Clones share the source (one
 * GPU upload) but keep their own offset/repeat - needed for the per-enemy
 * frame offsets.
 */
const cache = new Map<string, Promise<THREE.Texture>>()

/** Options for {@link loadPixelTexture}. */
export interface PixelTextureOptions {
  /**
   * Only for world geometry (blocks): large textures on distant surfaces
   * flicker badly without mipmaps. magFilter stays NearestFilter either way,
   * so pixels remain sharp up close.
   */
  mipmaps?: boolean
}

/**
 * Anisotropy depends on the renderer, which asset consumers do not know. Game
 * sets the maximum once at startup; 1 is the neutral default (e.g. for tests).
 */
let maxAnisotropy: number = 1

/**
 * Sets the anisotropic filtering level used for mipmapped textures.
 * @param value - The renderer's maximum anisotropy.
 */
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
          // Important for walls seen at a grazing angle (long corridors).
          tex.anisotropy = maxAnisotropy
        } else {
          tex.minFilter = THREE.NearestFilter

          // Important for pixel art: no mipmaps, no blurring.
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

/**
 * Loads a texture with pixel-art filtering and returns a cached clone.
 *
 * Every call returns its own clone, so callers may change offset/repeat freely
 * and own (and must dispose) the returned texture.
 *
 * @param url - Path of the image.
 * @param colorSpace - Color space the texture is tagged with.
 * @param opts - See {@link PixelTextureOptions}.
 * @returns A clone of the cached base texture.
 */
export function loadPixelTexture(
  url: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  opts: PixelTextureOptions = {}
): Promise<THREE.Texture> {
  const mipmaps: boolean = opts.mipmaps ?? false
  // colorSpace belongs in the key: the same path may deliberately be needed with
  // different tags, otherwise the first caller wins.
  // So does mipmaps - clones share the source and thus the GPU upload, so a
  // mipmapped and a non-mipmapped variant would overwrite each other.
  // Separate keys = separate base textures.
  const key: string = `${url}|${colorSpace}|${mipmaps}`
  let base: Promise<THREE.Texture> | undefined = cache.get(key)
  if (!base) {
    base = loadBaseTexture(url, colorSpace, mipmaps)
    cache.set(key, base)
  }
  // clone() shares the source -> one GPU upload for all clones (three counts
  // references per source), but each instance has its own offset/repeat.
  // No needsUpdate here: it would bump source.version and re-upload the
  // already uploaded texture for nothing.
  return base.then((tex: THREE.Texture) => tex.clone())
}

/**
 * Hard reset of the cache (tests / level changes). Do not call this from
 * `Game.dispose()` - the cache is meant to survive retries.
 */
export function disposeTextureCache(): void {
  for (const pending of cache.values()) {
    pending.then((tex: THREE.Texture) => tex.dispose()).catch(() => {})
  }
  cache.clear()
}
