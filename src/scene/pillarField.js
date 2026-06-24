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
    emissive: 0xffffff, emissiveIntensity: 1.05, vertexColors: false,
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
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

  // ---- peak-hold caps: a thin bright lip per pillar that jumps to the peak and sinks slowly ----
  const peak = new Float32Array(n).fill(f.baseHeight);
  const capGeo = new THREE.BoxGeometry(f.pillarWidth * 1.05, f.capThickness, f.pillarWidth * 1.05);
  const capMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const capMesh = new THREE.InstancedMesh(capGeo, capMat, n);
  capMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  capMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  capMesh.frustumCulled = false;

  const heights = new Float32Array(n).fill(f.baseHeight);
  const maxR = layout.reduce((m, L) => Math.max(m, L.r), 0) || 1;
  const waves = [];        // active beat shockwaves: { age }
  let prevBass = 0;
  // precompute each pillar's orient quaternion (surface normals never change)
  const quats = layout.map((L) =>
    new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(L.nx, L.ny, L.nz)));
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _col = new THREE.Color();
  const denom = f.baseHeight + f.centerPeak + f.reactive;

  function writeInstance(i, h) {
    const L = layout[i];
    _p.set(L.x, L.y, L.z);
    _s.set(1, h, 1);
    _m.compose(_p, quats[i], _s);
    mesh.setMatrixAt(i, _m);
    aHeight.setX(i, h);
    colorRamp(Math.min(h / denom, 1), _col); // write into _col (no per-frame allocation)
    _col.multiplyScalar(1 - 0.75 * L.ringT);  // brightness sinks toward the edges (white only at center)
    mesh.instanceColor.setXYZ(i, _col.r, _col.g, _col.b);
  }

  function writeCap(i) {
    const L = layout[i];
    const show = peak[i] - f.baseHeight > f.capThreshold ? 1 : 0; // restrained: only active pillars
    _p.set(L.x + L.nx * peak[i], L.y + L.ny * peak[i], L.z + L.nz * peak[i]);
    _s.set(show, show, show);                                     // scale 0 hides the cap
    _m.compose(_p, quats[i], _s);
    capMesh.setMatrixAt(i, _m);
    colorRamp(Math.min(peak[i] / denom, 1), _col);
    _col.multiplyScalar(1 - 0.75 * L.ringT);
    capMesh.instanceColor.setXYZ(i, _col.r, _col.g, _col.b);
  }

  // initial draw (caps hidden)
  for (let i = 0; i < n; i++) { writeInstance(i, heights[i]); writeCap(i); }
  mesh.instanceMatrix.needsUpdate = true;
  aHeight.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  capMesh.instanceMatrix.needsUpdate = true;
  capMesh.instanceColor.needsUpdate = true;

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

    const fall = Math.pow(f.decay, dt * 60);      // slow melt-down (framerate-independent)
    const capSink = Math.pow(f.capSink, dt * 60); // slow cap descent

    for (let i = 0; i < n; i++) {
      const L = layout[i];
      let target = pillarTargetHeight(L.ringT, L.r, spectrum, levels, t, f, L.phase, L.bias);
      for (let k = 0; k < waves.length; k++) {
        const d = (L.r - waves[k].age * w.speed) / w.width;
        target += w.amp * Math.exp(-d * d) * Math.exp(-waves[k].age * w.decay);
      }
      // attack-fast / decay-slow: snap up, melt down (the VU-meter soul)
      let h = heights[i];
      h = target > h ? h + (target - h) * f.attack
                     : f.baseHeight + (h - f.baseHeight) * fall;
      heights[i] = Math.max(f.baseHeight, h);
      // peak-hold: jump to the peak, then sink slowly
      peak[i] = Math.max(heights[i], f.baseHeight + (peak[i] - f.baseHeight) * capSink);
      writeInstance(i, heights[i]);
      writeCap(i);
    }
    mesh.instanceMatrix.needsUpdate = true;
    aHeight.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceColor.needsUpdate = true;
  }

  return { mesh, capMesh, update, _heights: heights, _writeInstance: writeInstance, _layout: layout };
}
