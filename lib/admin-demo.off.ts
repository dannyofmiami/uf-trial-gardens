// The stand-in for lib/admin-demo.ts in every build except build:demo (see next.config.mjs):
// demo mode off, so /admin and the home page banner use the real admin API.
import type { demoCall as DemoCall } from './admin-demo';

export const ADMIN_DEMO = false;
export const demoBanner = () => null;
export const resetDemoBanner = () => {};
export const demoCall: typeof DemoCall = async () => ({ ok: false, status: 404, data: {} });
