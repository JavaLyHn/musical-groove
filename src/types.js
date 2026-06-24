// Shared JSDoc types. No runtime code — these are referenced from other files
// via `import('./types.js').TypeName` in JSDoc comments, which the TypeScript
// language service (and `npm run typecheck`) understands without any build step.

/**
 * Per-frame energy in three bands, each normalised to 0..1.
 * @typedef {{ bass: number, mid: number, treble: number }} Levels
 */

/**
 * The contract every audio source implements. The simulated source
 * (`audioSource.js`) and the real Web Audio source (`webAudioSource.js`) both
 * return this shape, so the visual layer never knows or cares which is live.
 * @typedef {Object} AudioSource
 * @property {() => Float32Array} getSpectrum  64-bin normalised spectrum (0..1), bass→treble.
 * @property {() => Levels}       getLevels    bass/mid/treble averages (0..1).
 * @property {(dt: number) => void} update     advance the source by `dt` seconds.
 * @property {string} [label]                  human-readable device label (real source only).
 * @property {() => void} [stop]               release the stream + audio context (real source only).
 */

export {};
