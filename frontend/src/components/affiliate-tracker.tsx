'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';

export function AffiliateTracker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const ref = searchParams.get('ref');

  useEffect(() => {
    if (!ref) return;

    if (!/^\d{1,10}$/.test(ref.trim())) return;

    const utm = {
      utmSource: searchParams.get('utm_source') ?? undefined,
      utmMedium: searchParams.get('utm_medium') ?? undefined,
      utmCampaign: searchParams.get('utm_campaign') ?? undefined,
      utmContent: searchParams.get('utm_content') ?? undefined,
      utmTerm: searchParams.get('utm_term') ?? undefined,
    };

    void api
      .post('/affiliates/track', {
        ref: ref.trim(),
        landingUrl: `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
        ...utm,
      })
      .catch(() => {

      });

  }, [ref, pathname]);

  return null;
}
