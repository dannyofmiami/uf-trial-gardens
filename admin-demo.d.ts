// '@admin-demo' is lib/admin-demo.ts under build:demo, lib/admin-demo.off.ts otherwise
// (see next.config.mjs); both export this shape.
declare module '@admin-demo' {
  export const ADMIN_DEMO: boolean;
  export const demoBanner: () => import('./lib/banner').Banner | null;
  export const resetDemoBanner: () => void;
  export const demoCall: typeof import('./lib/admin-demo').demoCall;
}
