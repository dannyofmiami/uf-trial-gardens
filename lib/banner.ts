// The home-page announcement banner. It's a small JSON file the browser fetches at page

export type Banner = {
  enabled: boolean;
  title: string;
  message: string;
  linkLabel: string;
  linkUrl: string;
  showFrom: string;   // YYYY-MM-DD or '' -- first day to show
  showUntil: string;  // YYYY-MM-DD or '' -- last day to show
  updatedAt?: string;
};

export const BANNER_PATH = '/content/banner.json';

export const EMPTY_BANNER: Banner = {
  enabled: false, title: '', message: '', linkLabel: '', linkUrl: '', showFrom: '', showUntil: '',
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function isBannerActive(b: Banner | null | undefined, on = today()): b is Banner {
  if (!b || !b.enabled || !b.title.trim()) return false;
  if (b.showFrom && on < b.showFrom) return false;
  if (b.showUntil && on > b.showUntil) return false;
  return true;
}

// only site-relative paths or https links -- never javascript: or other schemes
export function safeLink(url: string): { href: string; external: boolean } | null {
  const u = url.trim();
  if (/^\/(?!\/)/.test(u)) return { href: u, external: false };
  if (/^https:\/\/[^\s]+$/i.test(u)) return { href: u, external: true };
  return null;
}
