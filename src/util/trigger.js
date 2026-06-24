// @ts-check
// A clean reaction TRIGGER, mirroring the reference project's design: every reactive
// event (ripple, meteor, …) is just an energy signal + two knobs —
//   sensitivity : the energy threshold to fire
//   cooldown    : minimum FRAMES between fires (0 = no limit -> fire on every frame
//                 above threshold, so events overlap into interference)
// The knobs are read live from `cfg` each call, so a GUI can tweak them in real time.

/**
 * @param {{ sensitivity: number, cooldown: number }} cfg  knobs, read live
 * @returns {{ fire: (energy: number) => number }}  fire() returns the firing strength, else 0
 */
export function createTrigger(cfg) {
  let cd = 0;
  return {
    fire(energy) {
      if (cd > 0) cd--;
      if (energy >= cfg.sensitivity && cd <= 0) {
        cd = cfg.cooldown;
        return energy;
      }
      return 0;
    },
  };
}
