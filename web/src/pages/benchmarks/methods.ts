import type { Method } from '../../live/api';

/** Display name and chart colour for each method. Colours come from the design system's data palette. */
export const METHOD_INFO: Record<Method, { name: string; color: string; dashed?: boolean }> = {
  no_cache: { name: 'No cache', color: '#6B707A', dashed: true },
  dynamic: { name: 'KV cache', color: '#2F5BD3' },
  static: { name: 'Static cache', color: '#9B3FB5' },
  prefix_sharing: { name: 'Prefix sharing', color: '#0F6B5A' },
};
