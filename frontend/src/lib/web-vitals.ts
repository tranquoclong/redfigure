import { sendGAEvent } from '@next/third-parties/google';
import type { Metric } from 'web-vitals';

export function reportWebVital(metric: Metric): void {
  const value = Math.round(
    metric.name === 'CLS' ? metric.value * 1000 : metric.value,
  );

  sendGAEvent('event', 'web_vitals', {
    name: metric.name,
    value,
    id: metric.id,
    rating: metric.rating,
    navigation_type: metric.navigationType,

  });

}
