import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from its previous value to `target` over `duration` ms.
 * Returns the current animated value.
 *
 * Usage:
 *   const animated = useCountUp(totalNW, 400);
 *   // render fmtINR(animated)
 *
 * - Starts animating whenever `target` changes (non-null → new value).
 * - Skips animation on first render (jumps straight to value).
 * - Safe with null/undefined: returns 0 while target is falsy.
 */
export function useCountUp(target, duration = 400) {
  const [current, setCurrent] = useState(target || 0);
  const prevRef  = useRef(target || 0);
  const timerRef = useRef(null);
  const mountRef = useRef(false);

  useEffect(() => {
    if (target == null) return;

    // Skip animation on very first mount
    if (!mountRef.current) {
      mountRef.current = true;
      prevRef.current  = target;
      setCurrent(target);
      return;
    }

    const from  = prevRef.current;
    const to    = target;
    const steps = Math.max(16, Math.round(duration / 16)); // ~60 fps
    const delta = (to - from) / steps;
    let   step  = 0;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      step++;
      if (step >= steps) {
        clearInterval(timerRef.current);
        setCurrent(to);
        prevRef.current = to;
      } else {
        setCurrent(from + delta * step);
      }
    }, duration / steps);

    return () => clearInterval(timerRef.current);
  }, [target, duration]);

  return current;
}
