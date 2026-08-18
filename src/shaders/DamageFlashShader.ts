import * as THREE from 'three'

/**
 * DamageFlashShader
 *
 * A full-screen post-processing pass that tints the screen with a color
 * (default: red) when the player takes damage, using a vignette so the
 * center of the screen stays more readable than the edges.
 *
 * Uniforms:
 *  - tDiffuse:   the rendered image from the previous pass in the composer
 *                chain (automatically supplied by Three.js' ShaderPass).
 *  - intensity:  0..1 value driving how strong the flash currently is.
 *                Intended to be set every frame from game logic, e.g.
 *                player.getDamageFlashIntensity(), and to decay back to 0
 *                over time.
 *  - flashColor: the color the screen tints towards (e.g. red for damage).
 *
 * Fragment shader steps:
 *  1. Sample the original pixel color from the previous pass.
 *  2. Compute the pixel's distance from the screen center (0.5, 0.5 in UV
 *     space).
 *  3. Turn that distance into a smooth vignette mask via smoothstep:
 *     0 near the center, 1 near/beyond the edges.
 *  4. Combine the vignette mask with `intensity` to get the final blend
 *     `strength` per pixel. The center always keeps a minimum of 35% of
 *     the effect (via mix(0.35, 1.0, vignette)) so it never looks like a
 *     "clean hole" is punched into the flash.
 *  5. Mix the original color with flashColor using `strength` as the
 *     blend factor — the result is a red tint that's subtle in the center
 *     and strong at the edges, classic FPS damage-indicator style.
 *
 * Note: the vignette is circular and doesn't account for aspect ratio, so
 * on ultra-wide screens it will appear stronger on the left/right edges
 * than top/bottom. Correct `dist` by the aspect ratio if that becomes an
 * issue (similar to how `resolution` is handled in ScanlineShader).
 */

export const DamageFlashShader = {
  uniforms: {
    tDiffuse:   { value: null as THREE.Texture | null },
    intensity:  { value: 0.0 },
    flashColor: { value: new THREE.Color(0xcc1010) },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform vec3 flashColor;

    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      float dist = length(vUv - 0.5);
      float vignette = smoothstep(0.1, 0.75, dist);
      float strength = intensity * mix(0.35, 1.0, vignette);

      vec3 finalColor = mix(color.rgb, flashColor, strength);
      gl_FragColor = vec4(finalColor, color.a);
    }
  `,
}