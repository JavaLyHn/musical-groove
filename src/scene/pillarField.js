import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildPillarLayout, pillarTargetHeight } from '../util/field.js';
import { colorRamp } from '../util/math.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createPillarField() {
  const f = CONFIG.field;
  const layout = buildPillarLayout(CONFIG.grid, CONFIG.spacing, CONFIG.sphereRadius, CONFIG.capAngle);
  const n = layout.length;

  const geo = new THREE.BoxGeometry(f.pillarWidth, 1, f.pillarWidth); // unit-tall, base at y=-0.5..0.5
  geo.translate(0, 0.5, 0); // base sits on origin; scaling Y grows upward

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0e22, roughness: 0.55, metalness: 0.0,
    emissive: 0xffffff, emissiveIntensity: 1.55, vertexColors: false,
  });

  // Per-instance height attribute + segmented-stripe shader injection.
  const aHeight = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSegPitch = { value: f.segPitch };
    shader.uniforms.uGapRatio = { value: f.gapRatio };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHeight;\nvarying float vSegY;\nvarying float vYNorm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvYNorm = position.y;\nvSegY = position.y * aHeight;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSegPitch;\nuniform float uGapRatio;\nvarying float vSegY;\nvarying float vYNorm;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' +
        'float _seg = smoothstep(uGapRatio, uGapRatio + 0.10, fract(vSegY / uSegPitch));\n' +
        'float _top = smoothstep(0.78, 1.0, vYNorm);\n' +
        'totalEmissiveRadiance *= vColor;\n' +
        'totalEmissiveRadiance *= mix(0.22, 1.0, _seg);\n' +
        'totalEmissiveRadiance += vColor * _top * 1.6;');
  };

  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.geometry.setAttribute('aHeight', aHeight);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  // enable per-instance color (sets vColor in the shader)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

  const heights = new Float32Array(n).fill(f.baseHeight);
  const vels = new Float32Array(n);
  const maxR = layout.reduce((m, L) => Math.max(m, L.r), 0) || 1;
  const waves = [];        // active beat shockwaves: { age }
  let prevBass = 0;
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _nrm = new THREE.Vector3();
  const _col = new THREE.Color();

  function writeInstance(i, h) {
    const L = layout[i];
    _nrm.set(L.nx, L.ny, L.nz);
    _q.setFromUnitVectors(UP, _nrm);
    _p.set(L.x, L.y, L.z);
    _s.set(1, h, 1);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    aHeight.setX(i, h);
    const hNorm = Math.min(h / (f.centerPeak + f.reactive), 1);
    _col.copy(colorRamp(hNorm));
    mesh.instanceColor.setXYZ(i, _col.r, _col.g, _col.b);
  }

  // initial static draw
  for (let i = 0; i < n; i++) writeInstance(i, heights[i]);
  mesh.instanceMatrix.needsUpdate = true;
  aHeight.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  function update(spectrum, levels, dt) {
    const t = performance.now() / 1000;
    const w = CONFIG.wave;

    // onset detection on the bass rising edge -> spawn a radial shockwave
    if (levels.bass > 0.45 && levels.bass - prevBass > 0.07) waves.push({ age: 0 });
    prevBass = levels.bass;
    for (let k = waves.length - 1; k >= 0; k--) {
      waves[k].age += dt;
      if (waves[k].age * w.speed > maxR + w.width * 3) waves.splice(k, 1);
    }

    // slow fall is framerate-independent (f.decay is defined per 1/60 s)
    const fall = Math.pow(f.decay, dt * 60);

    for (let i = 0; i < n; i++) {
      const L = layout[i];
      let target = pillarTargetHeight(L.ringT, L.r, spectrum, levels, t, f);
      for (let k = 0; k < waves.length; k++) {
        const d = (L.r - waves[k].age * w.speed) / w.width;
        target += w.amp * Math.exp(-d * d) * Math.exp(-waves[k].age * w.decay);
      }
      // attack-fast / decay-slow: snap up, melt down (the VU-meter soul)
      let h = heights[i];
      h = target > h ? h + (target - h) * f.attack
                     : f.baseHeight + (h - f.baseHeight) * fall;
      heights[i] = Math.max(f.baseHeight, h);
      writeInstance(i, heights[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    aHeight.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { mesh, update, _heights: heights, _vels: vels, _writeInstance: writeInstance, _layout: layout };
}
