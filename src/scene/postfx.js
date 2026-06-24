import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from '../config.js';

// Final pass: radial chromatic aberration (edges) + vignette + animated film
// grain + dithering. The dither breaks banding in the dark navy gradient.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: CONFIG.post.vignette },
    uAberration: { value: CONFIG.post.aberration },
    uGrain: { value: CONFIG.post.grain },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * uAberration;                 // radial CA, grows toward edges
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float v = smoothstep(0.9, 0.35, length(d) * uStrength);    // vignette
      col *= mix(0.5, 1.0, v);
      col += (hash(vUv * uResolution + uTime) - 0.5) * uGrain;    // animated film grain
      col += (hash(vUv * uResolution * 0.5 + 19.0) - 0.5) / 255.0; // dither (anti-band)
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.post.bloomStrength, CONFIG.post.bloomRadius, CONFIG.post.bloomThreshold,
  );
  composer.addPass(bloom);

  const final = new ShaderPass(FinalShader);
  composer.addPass(final);

  function setSize(w, h) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
    final.uniforms.uResolution.value.set(w, h);
  }

  let bloomPulse = 0;
  function update(dt, bass = 0) {
    final.uniforms.uTime.value += dt;
    // beat bloom spike: fast attack, smooth decay (堆芯爆闪) — modest so it stays cool
    bloomPulse = Math.max(bloomPulse * (1 - 5 * dt), bass);
    bloom.strength = CONFIG.post.bloomStrength + bloomPulse * CONFIG.post.bloomSpike;
  }

  setSize(window.innerWidth, window.innerHeight);
  return { composer, setSize, update };
}
