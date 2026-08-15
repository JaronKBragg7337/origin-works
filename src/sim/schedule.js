/**
 * A tiny deterministic scheduler.
 *
 * Stages are written as generators and advanced by a fixed timestep. There is
 * no setTimeout, no Date.now and no requestAnimationFrame in any process logic
 * — the clock the process sees is a counter of fixed steps, so the same inputs
 * produce the same result at any frame rate (V1-TEST I68).
 *
 * A `yield` returns a wait. Nothing advances because a timer said so
 * (V1-TEST I66): a `waitUntil` advances when the condition it names is true,
 * and a `wait` is used only for motion that genuinely takes time — a cylinder
 * stroking, a spindle spinning up.
 */

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
export const linear = (t) => t;

/** Wait a fixed duration. For real machine motion with a real duration. */
export function wait(seconds) {
  let left = seconds;
  return { kind: 'wait', label: `${seconds.toFixed(2)}s`, tick(dt) { left -= dt; return left <= 0; } };
}

/** Wait for a condition. This is how a stage hands off. */
export function waitUntil(fn, label = 'condition') {
  return { kind: 'until', label, tick() { return !!fn(); } };
}

/** Interpolate a value over time, calling `set` each step. */
export function tween(from, to, seconds, set, ease = easeInOut) {
  let t = 0;
  set(from);
  return {
    kind: 'tween', label: `tween ${seconds.toFixed(2)}s`,
    tick(dt) {
      t = Math.min(1, t + dt / Math.max(seconds, 1e-6));
      set(from + (to - from) * ease(t));
      return t >= 1;
    },
  };
}

/** Run several waits at once; finishes when all finish. */
export function all(...waits) {
  const list = waits.filter(Boolean);
  return {
    kind: 'all', label: `all(${list.length})`,
    tick(dt) {
      let done = true;
      for (const w of list) if (!w.done) { w.done = w.tick(dt); done = done && w.done; }
      return done;
    },
  };
}

/**
 * The runner. `step(dt)` advances the generator by one fixed timestep.
 * Faults are captured rather than thrown into the render loop, so an
 * interrupted cycle fails cleanly instead of orphaning parts (V1-TEST I67).
 */
export function createRunner(generatorFn, ctx) {
  let gen = generatorFn(ctx);
  let pending = null;
  let done = false;
  let fault = null;
  let steps = 0;

  return {
    get done() { return done; },
    get fault() { return fault; },
    get pending() { return pending?.label ?? null; },
    get steps() { return steps; },

    step(dt) {
      if (done || fault) return;
      steps++;
      if (pending) {
        let finished = false;
        try { finished = pending.tick(dt); }
        catch (e) { fault = e; return; }
        if (!finished) return;
        pending = null;
      }
      try {
        const { value, done: d } = gen.next();
        if (d) { done = true; return; }
        pending = value ?? null;
      } catch (e) {
        fault = e;
      }
    },

    restart() { gen = generatorFn(ctx); pending = null; done = false; fault = null; steps = 0; },
  };
}
