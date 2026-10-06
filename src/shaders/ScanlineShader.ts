
import * as THREE from 'three'

/**
 * Post-processing pass that darkens and brightens alternating screen rows for a
 * CRT-like look, with a light color tint.
 */
export const ScanlineShader = {
  uniforms: {
    tDiffuse:   { value: null as THREE.Texture | null },

    resolution: { value: window.innerHeight * window.devicePixelRatio },

    // Strength of the scanline effect: positive values make bright lines brighter and dark lines darker.
    intensity:  { value: 0.03 },

    scanlineColor: { value: new THREE.Color(0x9bc0eb) }
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
    uniform float resolution;
    uniform float intensity;
    uniform vec3 scanlineColor;
  
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      float row = mod(floor(vUv.y * resolution), 5.0);

      // Mask centered around 1.0: bright rows get slightly brighter,
      // dark rows slightly darker -> the average brightness stays 1.0
      float mask = 1.0 + intensity * (0.5 - row);

      // Scanline color only on the dark rows as a subtle tint
      //vec3 tint = mix(vec3(1.0), scanlineColor, row * intensity * 0.5);
  
      gl_FragColor = vec4(color.rgb * mask + scanlineColor * 0.12 , color.a);
    }
  `,
}

