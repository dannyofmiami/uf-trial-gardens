'use client';

import { useEffect, useState } from 'react';
import { withBase } from '@/lib/data';
import { BANNER_PATH, isBannerActive, type Banner } from '@/lib/banner';
import BannerView from '@/components/BannerView';
import { ADMIN_DEMO, demoBanner } from '@admin-demo';

export default function SiteBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    // demo build: a banner saved in this browser's /admin wins (see lib/admin-demo.ts)
    const saved = ADMIN_DEMO ? demoBanner() : null;
    if (saved) { setBanner(saved); return; }
    let cancelled = false;
    fetch(withBase(BANNER_PATH), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Banner | null) => { if (!cancelled) setBanner(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return isBannerActive(banner) ? <BannerView banner={banner} /> : null;
}
