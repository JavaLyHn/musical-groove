import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildPillarLayout } from '../util/field.js';

const UP = new THREE.Vector3(0, 1, 0);
const RIPPLES = 10;
const COVER_TINT_AMT = 0.42; // tint strength when an album cover is present (0 = off)
const HIST_LEN = 72;         // band-history rows the radial delay reads back into (~1.2s @60fps)

// GPU heightfield: the per-instance ELEVATION is computed in the vertex shader
// from per-band uniforms + simplex noise, so each frequency band drives its own
// SPATIAL MOTIF across the whole cap (subBass = centre lifts, bass = clustered
// chunks, lowMid = flowing waves, mid = a diagonal river, highMid = scattered
// spikes, air = outer sparkle). The CPU only smooths ~8 band scalars per frame
// and manages ripple slots — no per-instance matrix writes. We keep
// MeshStandardMaterial + onBeforeCompile so three's fog / tone-mapping / colour
// management / instancing all stay intact; we just inject height + emissive.
export function createPillarField() {
  const f = CONFIG.field;
  const w = CONFIG.wave;
  const m = CONFIG.motion;
  const layout = buildPillarLayout(CONFIG.grid, CONFIG.spacing, CONFIG.sphereRadius, CONFIG.capAngle);
  const n = layout.length;

  const geo = new THREE.BoxGeometry(f.pillarWidth, 1, f.pillarWidth);
  geo.translate(0, 0.5, 0); // local y in [0,1]; the shader scales it by the height

  // Per-instance attributes the shader needs: flat field coords (for noise), the
  // radial position (centre..edge), and per-column randoms.
  const aField = new Float32Array(n * 2);
  const aRing = new Float32Array(n);
  const aRnd = new Float32Array(n);
  const aPhase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const L = layout[i];
    aField[i * 2] = L.x;
    aField[i * 2 + 1] = L.z;
    aRing[i] = L.ringT;
    aRnd[i] = L.bias;
    aPhase[i] = L.phase;
  }
  geo.setAttribute('aField', new THREE.InstancedBufferAttribute(aField, 2));
  geo.setAttribute('aRing', new THREE.InstancedBufferAttribute(aRing, 1));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(aRnd, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));

  // Band-envelope HISTORY texture (x = 8 bands, y = time rows). Each frame we push the
  // newest envelopes as the LAST row and shift older rows toward 0; the vertex shader
  // reads a row `radius * uMaxDelayRows` back, so a beat sweeps centre -> rim.
  const histData = new Float32Array(8 * HIST_LEN);
  const histTex = new THREE.DataTexture(histData, 8, HIST_LEN, THREE.RedFormat, THREE.FloatType);
  histTex.minFilter = THREE.NearestFilter;
  histTex.magFilter = THREE.NearestFilter;
  histTex.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0e22, roughness: 0.6, metalness: 0.0,
    emissive: 0xffffff, emissiveIntensity: 1.0,
  });

  let U = null; // captured uniforms, updated each frame

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uHeightScale: { value: f.heightScale },
      uBaseHeight: { value: f.baseHeight },
      uIdleAmp: { value: f.idleAmp },
      uSubBass: { value: 0 }, uBass: { value: 0 }, uLowMid: { value: 0 }, uMid: { value: 0 },
      uHighMid: { value: 0 }, uPresence: { value: 0 }, uBrilliance: { value: 0 }, uAir: { value: 0 },
      uRipplePos: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector2()) },
      uRippleTST: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector3()) },
      uRippleSpeed: { value: w.speed }, uRippleWidth: { value: w.width }, uRippleFade: { value: w.decay },
      uWhiteElev: { value: f.whiteElev }, uBrightFloor: { value: f.brightFloor }, uRadialDim: { value: f.radialDim },
      uCoreBoost: { value: f.coreBoost }, uEmissiveGain: { value: f.emissiveGain },
      uSegPitch: { value: f.segPitch }, uGapRatio: { value: f.gapRatio },
      uRamp: { value: CONFIG.colors.ramp.map((h) => new THREE.Color(h)) },
      uRampWarm: { value: CONFIG.colors.rampWarm.map((h) => new THREE.Color(h)) },
      uRippleColor: { value: new THREE.Color(CONFIG.colors.accent) },
      uWarmth: { value: 0 }, uBrightness: { value: 0 }, uSharpness: { value: 0 },
      // album-art tint: recolours the field toward the current cover's dominant hue
      uCoverTint: { value: new THREE.Color(1, 1, 1) }, uCoverTintAmt: { value: 0 },
      // radial phase delay: per-band history + how far (rows) the rim lags the centre
      uHistory: { value: histTex },
      uMaxDelayRows: { value: CONFIG.motion.radialDelay },
      uLevelFloor: { value: CONFIG.motion.levelFloor },
    });
    U = shader.uniforms;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERT_COMMON)
      .replace('#include <begin_vertex>', VERT_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAG_COMMON)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE);
  };

  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false; // vertices are displaced in-shader; skip culling

  // Static instance transforms: position + surface-normal orientation, NO height
  // scale (the shader does the height). Written once.
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const L = layout[i];
    _p.set(L.x, L.y, L.z);
    _q.setFromUnitVectors(UP, new THREE.Vector3(L.nx, L.ny, L.nz));
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;

  // ---- per-frame CPU state: 8 per-band envelopes + ripple ring buffer ----
  const bandEnv = new Float32Array(8);
  const ripples = Array.from({ length: RIPPLES }, () => ({ pos: new THREE.Vector2(), time: -1e3, strength: 0, type: 0 }));
  let rippleIdx = 0;
  const RIPPLE_MAX_AGE = 1.6;

  function spawnRipple(t, strength, type, x = 0, z = 0) {
    const r = ripples[rippleIdx];
    r.pos.set(x, z);
    r.time = t;
    r.strength = strength;
    r.type = type;
    rippleIdx = (rippleIdx + 1) % RIPPLES;
  }

  // album-art tint, lerped toward the latest cover colour so the field's colour
  // temperature eases across on a track change (set from the page via setCoverColor).
  const coverCur = [1, 1, 1];
  const coverTgt = [1, 1, 1];
  let coverAmtCur = 0;
  let coverAmtTgt = 0;
  /** @param {[number, number, number] | null} rgb  sRGB 0..1, or null to fade the tint out */
  function setCoverColor(rgb) {
    if (rgb && rgb.length === 3) {
      coverTgt[0] = rgb[0]; coverTgt[1] = rgb[1]; coverTgt[2] = rgb[2];
      coverAmtTgt = COVER_TINT_AMT;
    } else {
      coverAmtTgt = 0; // ease the tint away; keep the last hue so it fades, not snaps
    }
  }

  let levelSmooth = 0;
  function update(spectrum, levels, level, beat, timbre, dt) {
    const t = performance.now() / 1000;
    // release tail: level rises fast but melts down slowly when the music drops/stops
    levelSmooth += (level - levelSmooth) * (level > levelSmooth ? 0.4 : 0.04);

    // aggregate the normalized bands into 8 groups, each with its OWN time scale: low
    // bands rise + fall slowly (a big swell), high bands snap up + fall fast (sparkle).
    const per = Math.max(1, Math.floor(spectrum.length / 8));
    for (let b = 0; b < 8; b++) {
      let s = 0;
      for (let i = 0; i < per; i++) s += spectrum[b * per + i] || 0;
      s /= per;
      const fb = b / 7; // 0 = lowest band, 1 = highest
      const atk = m.bandAtkSlow + (m.bandAtkFast - m.bandAtkSlow) * fb;
      const decF = Math.pow(m.bandDecSlow + (m.bandDecFast - m.bandDecSlow) * fb, dt * 60);
      bandEnv[b] = s > bandEnv[b] ? bandEnv[b] + (s - bandEnv[b]) * atk : bandEnv[b] * decF;
    }
    // push the newest envelopes as the last history row (older rows shift toward 0),
    // so the vertex shader can read each ring's value delayed by its radius.
    histData.copyWithin(0, 8);
    histData.set(bandEnv, (HIST_LEN - 1) * 8);
    histTex.needsUpdate = true;

    // beats -> ripples: kick = central radial ring (cyan), hat = small offset white pop
    if (beat.kick > 0) spawnRipple(t, beat.kick, 0, 0, 0);
    if (beat.hat > 0) {
      const a = aPhase[(rippleIdx * 7919) % n] || 0; // cheap varied angle
      const d = 20 + (aRnd[(rippleIdx * 104729) % n] || 0.5) * 70;
      spawnRipple(t, beat.hat * 0.6, 1, Math.cos(a) * d, Math.sin(a) * d);
    }
    for (let i = 0; i < RIPPLES; i++) {
      if (ripples[i].strength > 0 && t - ripples[i].time > RIPPLE_MAX_AGE) ripples[i].strength = 0;
    }

    if (!U) return; // material not compiled yet
    U.uTime.value = t;
    U.uLevel.value = levelSmooth;
    U.uWarmth.value = timbre.warmth; U.uBrightness.value = timbre.brightness; U.uSharpness.value = timbre.sharpness;
    U.uSubBass.value = bandEnv[0]; U.uBass.value = bandEnv[1]; U.uLowMid.value = bandEnv[2]; U.uMid.value = bandEnv[3];
    U.uHighMid.value = bandEnv[4]; U.uPresence.value = bandEnv[5]; U.uBrilliance.value = bandEnv[6]; U.uAir.value = bandEnv[7];
    for (let i = 0; i < RIPPLES; i++) {
      U.uRipplePos.value[i].copy(ripples[i].pos);
      U.uRippleTST.value[i].set(ripples[i].time, ripples[i].strength, ripples[i].type);
    }

    // ease the cover tint toward its target (~0.5s cross on a track change)
    const kc = 1 - Math.exp(-dt * 2.2);
    coverCur[0] += (coverTgt[0] - coverCur[0]) * kc;
    coverCur[1] += (coverTgt[1] - coverCur[1]) * kc;
    coverCur[2] += (coverTgt[2] - coverCur[2]) * kc;
    coverAmtCur += (coverAmtTgt - coverAmtCur) * kc;
    U.uCoverTint.value.setRGB(coverCur[0], coverCur[1], coverCur[2], THREE.SRGBColorSpace);
    U.uCoverTintAmt.value = coverAmtCur;
  }

  return { mesh, update, setCoverColor, _layout: layout };
}

// ---------------------------------------------------------------------------
// GLSL injected via onBeforeCompile
// ---------------------------------------------------------------------------

const SNOISE = `
vec3 stMod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 stMod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 stPermute(vec3 x){return stMod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
  i=stMod289(i);
  vec3 p=stPermute(stPermute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}`;

const VERT_COMMON = `#include <common>
attribute vec2 aField;
attribute float aRing;
attribute float aRnd;
attribute float aPhase;
uniform float uTime, uLevel, uHeightScale, uBaseHeight, uIdleAmp;
uniform sampler2D uHistory;
uniform float uMaxDelayRows, uLevelFloor;
uniform vec2 uRipplePos[${RIPPLES}];
uniform vec3 uRippleTST[${RIPPLES}];
uniform float uRippleSpeed, uRippleWidth, uRippleFade;
varying float vElev, vRing, vRnd, vYNorm, vSegY, vRippleN, vRippleW;
// read band b (0..7) from the history texture at time-row coord y (0..1)
float histBand(float b, float y){ return texture2D(uHistory, vec2((b + 0.5) / 8.0, y)).r; }
${SNOISE}`;

const VERT_BEGIN = `#include <begin_vertex>
vYNorm = position.y;
vRing = aRing;
vRnd = aRnd;
float ring = aRing;

// idle floor: a gentle, ever-present swell so the whole dome is always alive
vec2 mp = aField * 0.04 + vec2(uTime * 0.08, uTime * 0.05);
float baseN = (snoise(mp) + 1.0) * 0.5;
float swell = sin(aField.x * 0.04 + aField.y * 0.03 - uTime * 0.5) * 0.5 + 0.5;
float idle = uIdleAmp * mix(baseN, swell, 0.5);

// RADIAL PHASE DELAY (the hero): read this column's bands from the history texture
// delayed by its radius. centre = now, rim = up to uMaxDelayRows frames ago -> a beat
// rises at the core and the swell sweeps visibly outward as a ring, not all at once.
float _off = ring * uMaxDelayRows;
float _y = clamp((${HIST_LEN}.0 - 0.5 - _off) / ${HIST_LEN}.0, 0.5 / ${HIST_LEN}.0, (${HIST_LEN}.0 - 0.5) / ${HIST_LEN}.0);
float b0 = histBand(0.0, _y), b1 = histBand(1.0, _y), b2 = histBand(2.0, _y), b3 = histBand(3.0, _y);
float b4 = histBand(4.0, _y), b5 = histBand(5.0, _y), b6 = histBand(6.0, _y), b7 = histBand(7.0, _y);

// per-band SPATIAL MOTIFS, each on its OWN (delayed) envelope — no shared common mode
float subRegion = smoothstep(0.55, 0.0, ring);
float subLift = b0 * subRegion * 6.0;
float bN = snoise(aField * 0.08 - vec2(0.0, uTime * 0.2));
float bassRegion = smoothstep(0.7, 0.1, ring + bN * 0.08);
float bassLift = b1 * bassRegion * smoothstep(0.0, 1.0, aRnd + 0.3) * 5.0;
float lmN = snoise(aField * 0.05 + vec2(uTime * 0.1, 0.0));
float lowMidLift = b2 * (lmN * 0.5 + 0.5) * 3.0;
float river = sin(aField.x * 0.12 + aField.y * 0.12 + snoise(aField * 0.08) * 2.0 - uTime * 2.0);
float midLift = b3 * max(0.0, river) * 3.5;
float hmRegion = smoothstep(0.2, 0.95, ring);
float hmLift = 0.0;
if (fract(aRnd * 13.3) > 0.78) hmLift = b4 * hmRegion * fract(aRnd * 7.7) * 4.5;
float airLift = (b5 + b6 + b7) * 0.33 * smoothstep(0.3, 1.0, ring) * fract(aRnd * 5.3) * 2.0;
// common mode KILLED: loudness only scales height uLevelFloor..1; per-band drive decides WHAT moves
float audio = (subLift + bassLift + lowMidLift + midLift + hmLift + airLift) * uHeightScale * mix(uLevelFloor, 1.0, uLevel);

float elev = idle + audio;

// beat ripples expanding from the core (and offset hat pops)
float rN = 0.0, rW = 0.0;
for (int i = 0; i < ${RIPPLES}; i++) {
  vec3 tst = uRippleTST[i];
  if (tst.y <= 0.0) continue;
  float d = length(aField - uRipplePos[i]);
  float age = uTime - tst.x;
  float radius = age * uRippleSpeed;
  float dd = d - radius;
  float wv = exp(-dd * dd / (uRippleWidth * uRippleWidth));
  float fade = exp(-age * uRippleFade);
  float pulse = wv * fade * tst.y;
  bool white = tst.z > 0.5;
  elev += pulse * (white ? 2.0 : 5.0);
  if (white) rW += pulse; else rN += pulse;
}

vElev = elev;
vRippleN = rN;
vRippleW = rW;
float totalHeight = uBaseHeight + elev;
vSegY = position.y * totalHeight;
transformed.y = position.y * totalHeight;`;

const FRAG_COMMON = `#include <common>
uniform float uWhiteElev, uBrightFloor, uRadialDim, uSegPitch, uGapRatio, uCoreBoost, uEmissiveGain, uLevel;
uniform float uTime, uWarmth, uBrightness, uSharpness;
uniform float uSubBass, uBass, uLowMid, uMid, uHighMid, uPresence, uBrilliance, uAir;
uniform vec3 uRamp[5];
uniform vec3 uRampWarm[5];
uniform vec3 uRippleColor;
uniform vec3 uCoverTint;
uniform float uCoverTintAmt;
varying float vElev, vRing, vRnd, vYNorm, vSegY, vRippleN, vRippleW;
vec3 rampOf(vec3 r0, vec3 r1, vec3 r2, vec3 r3, vec3 r4, float t){
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(r0, r1, smoothstep(0.0, 0.25, t));
  c = mix(c, r2, smoothstep(0.25, 0.5, t));
  c = mix(c, r3, smoothstep(0.5, 0.75, t));
  c = mix(c, r4, smoothstep(0.75, 1.0, t));
  return c;
}
// palette = cool ramp blended toward the warm ramp by warmth, then a high-freq
// brightness wash toward cyan-white. So the colour follows the music's timbre.
vec3 paletteColor(float t){
  vec3 cool = rampOf(uRamp[0], uRamp[1], uRamp[2], uRamp[3], uRamp[4], t);
  vec3 warm = rampOf(uRampWarm[0], uRampWarm[1], uRampWarm[2], uRampWarm[3], uRampWarm[4], t);
  vec3 c = mix(cool, warm, clamp(uWarmth * 1.4 - 0.15, 0.0, 1.0));
  c = mix(c, vec3(0.5, 0.85, 1.0), uBrightness * 0.45 * t);
  // album-art tint: recolour toward the cover hue while PRESERVING the luminance ramp
  // (dark floor stays dark) and the white-hot tip (fade the tint out as t -> 1).
  float _L = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 _tinted = uCoverTint * (0.35 + 1.25 * _L);
  float _amt = uCoverTintAmt * (1.0 - smoothstep(0.72, 1.0, t));
  c = mix(c, _tinted, _amt);
  return c;
}`;

const FRAG_EMISSIVE = `#include <emissivemap_fragment>
// steep curve on normalized elevation: the field stays at the dark-blue floor
// (rampColor near 0) until a column rises high; only the tallest reach white.
float _hN = clamp(vElev / uWhiteElev, 0.0, 1.0);
float _b = smoothstep(uBrightFloor, 0.95, _hN);
float _seg = smoothstep(uGapRatio, uGapRatio + 0.10, fract(vSegY / uSegPitch));
float _segMask = mix(0.22, 1.0, _seg);
vec3 _emis = paletteColor(_b) * _segMask;
_emis *= (1.0 - uRadialDim * vRing);            // depth dim toward the edges
_emis *= mix(1.0, uCoreBoost, 1.0 - vRing);     // CORE: the centre glows hotter -> a hot focus
_emis *= uEmissiveGain * (0.45 + 0.55 * uLevel); // exposure cut + loud->bright / quiet->dark
float _top = smoothstep(0.80, 1.0, vYNorm);
_emis += paletteColor(_b) * _top * 0.5 * _segMask * uEmissiveGain;

// --- surface micro-detail (upper part of pillars), driven by the high bands ---
float _upper = smoothstep(0.65, 1.0, vYNorm);
// air shimmer: sparse columns twinkle at their tops
if (fract(vRnd * 31.0) > 0.93) _emis += vec3(0.6, 0.9, 1.0) * uAir * 2.2 * _upper;
// presence/sharpness flickers: rare fast white flashes synced to time
if (fract(vRnd * 53.0) > 0.985) {
  float _fl = 0.5 + 0.5 * sin(uTime * 40.0 + vRnd * 100.0);
  _emis += vec3(1.0) * uPresence * (1.0 + uSharpness * 2.0) * _upper * _fl;
}
// brilliance micro-sparks
if (fract(vRnd * 89.0 + uTime * 2.0) > 0.985) _emis += vec3(1.0) * uBrilliance * 2.0 * _upper;

// soft knee (Reinhard) on the body emissive: compress the hot core's highlights so
// the peak stays 'bright white-hot CUBES' (gaps/structure survive) instead of a flat
// burned blob — the brighter a fragment, the more it's compressed.
float _mx = max(_emis.r, max(_emis.g, _emis.b));
_emis *= 1.0 / (1.0 + _mx * 0.5);

// ripple overrides bypass the exposure cut so the beat ring/pop pops on the dark field
_emis = mix(_emis, uRippleColor, clamp(vRippleN, 0.0, 1.0));
_emis = mix(_emis, vec3(1.0), clamp(vRippleW, 0.0, 1.0));
totalEmissiveRadiance = _emis;`;
