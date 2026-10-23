/// <reference types="vite/client" />

declare module "canvas-confetti" {
  interface Options {
    particleCount?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    scalar?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    ticks?: number;
    gravity?: number;
    drift?: number;
    shapes?: string[];
    flat?: boolean;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }
  function confetti(options?: Options): Promise<null>;
  export default confetti;
}
