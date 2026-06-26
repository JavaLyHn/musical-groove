/*!
 * 声音星球 — © 2026 LyHN (github.com/JavaLyHn). All rights reserved.
 * The "LyHN" watermark below is composited INTO the final WebGL image (not a DOM overlay).
 * It is part of the render and may not be removed or disabled. See LICENSE.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from '../config.js';

// Author watermark baked into the final pass. Drawing it as a texture here (rather than a
// removable DOM node) ties the mark to the render pipeline itself.
function makeMarkTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = "600 58px 'Snell Roundhand','Zapfino','Apple Chancery',cursive";
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(95,208,224,0.9)';
  g.shadowBlur = 9;
  g.fillStyle = 'rgba(196,230,242,1)';
  g.fillText('LyHN', c.width - 12, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
    uAccentColor: { value: new THREE.Color(CONFIG.post.accentColor) },
    uAccentIntensity: { value: CONFIG.post.accentIntensity },
    uMark: { value: makeMarkTexture() },                       // author watermark texture
    uMarkRect: { value: new THREE.Vector4(0.8, 0.02, 0.18, 0.07) }, // x,y,w,h in UV (bottom-right)
    uMarkAmt: { value: 0.22 },                                 // subtle additive glow
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uAccentColor;
    uniform float uAccentIntensity;
    uniform sampler2D uMark;
    uniform vec4 uMarkRect;
    uniform float uMarkAmt;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      float edge = smoothstep(0.10, 0.32, r2);         // confine CA to the outer frame, not the whole screen
      vec2 off = d * r2 * edge * uAberration;          // radial CA, edges only (~1-2px)
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      // accent wash: push the bright (bloomed) areas toward one accent hue — a single
      // knob to swing the whole glow blue<->warm. uAccentIntensity 0 = no change.
      float _lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * mix(vec3(1.0), uAccentColor * 1.6, clamp(_lum, 0.0, 1.0)), uAccentIntensity);
      float v = smoothstep(0.9, 0.35, length(d) * uStrength);    // vignette
      col *= mix(0.46, 1.0, v);                                  // a touch deeper -> more cinematic framing
      col += (hash(vUv * uResolution + uTime) - 0.5) * uGrain;    // animated film grain
      col += (hash(vUv * uResolution * 0.5 + 19.0) - 0.5) / 255.0; // dither (anti-band)
      // author watermark — composited into the image itself (not a removable DOM node)
      vec2 mk = (vUv - uMarkRect.xy) / uMarkRect.zw;
      if (mk.x >= 0.0 && mk.x <= 1.0 && mk.y >= 0.0 && mk.y <= 1.0) {
        vec4 wm = texture2D(uMark, vec2(mk.x, 1.0 - mk.y));
        col += wm.rgb * wm.a * uMarkAmt;
      }
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

  // keep the watermark a fixed pixel size + aspect (matching the 256x96 texture) in the
  // bottom-right corner, regardless of viewport size.
  const MARK_W = 132, MARK_H = MARK_W * (96 / 256), MARK_MARGIN = 16;
  function setSize(w, h) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
    final.uniforms.uResolution.value.set(w, h);
    const uw = MARK_W / w, uh = MARK_H / h;
    final.uniforms.uMarkRect.value.set(1 - uw - MARK_MARGIN / w, MARK_MARGIN / h, uw, uh);
  }

  let bloomPulse = 0;
  function update(dt, bass = 0, kick = 0) {
    final.uniforms.uTime.value += dt;
    // beat bloom spike: fast attack, smooth decay (堆芯爆闪). The KICK transient drives it now
    // (sharp, on-the-beat) on top of a gentler continuous bass component.
    bloomPulse = Math.max(bloomPulse * (1 - 5 * dt), Math.max(kick, bass * 0.6));
    bloom.strength = CONFIG.post.bloomStrength + bloomPulse * CONFIG.post.bloomSpike;
    bloom.threshold = CONFIG.post.bloomThreshold; // live for ?gui
    // accent wash, read live so the ?gui panel can swing the glow's hue in real time
    final.uniforms.uAccentIntensity.value = CONFIG.post.accentIntensity;
    final.uniforms.uAccentColor.value.set(CONFIG.post.accentColor);
  }

  setSize(window.innerWidth, window.innerHeight);
  return { composer, setSize, update };
}
