'use client';

import { useEffect, type RefObject } from 'react';
import { initHeroFluid } from './hero-fluid-effect.js';

// Mounts the WebGL swirl-brush effect (see hero-fluid-effect.js) over the
// hero section once it's in the DOM, and tears it down on unmount.
export function HeroFluid({ target }: { target: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const heroEl = target.current;
    if (!heroEl) return undefined;
    return initHeroFluid(heroEl);
  }, [target]);

  return null;
}
