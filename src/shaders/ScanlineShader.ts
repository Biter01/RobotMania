import * as THREE from 'three'

export const ScanlineShader = {
  uniforms: {
    tDiffuse:   { value: null as THREE.Texture | null },

    // Physische Bildschirmhöhe in Pixeln – wird von Game.ts beim Init und Resize gesetzt
    resolution: { value: window.innerHeight * window.devicePixelRatio },

    // Stärke der Scanlines
    intensity:  { value: 0.05 },

    // 👉 NEU: Farbe der Scanlines
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

      // Maske zentriert um 1.0: helle Zeilen werden leicht aufgehellt,
      // dunkle Zeilen leicht abgedunkelt → Durchschnittshelligkeit bleibt 1.0
      float mask = 1.0 + intensity * (0.5 - row);

      // Scanline-Farbe nur auf den dunklen Zeilen als subtiles Tinting
      //vec3 tint = mix(vec3(1.0), scanlineColor, row * intensity * 0.5);
  
      gl_FragColor = vec4(color.rgb * mask + scanlineColor * 0.12 , color.a);
    }
  `,
}