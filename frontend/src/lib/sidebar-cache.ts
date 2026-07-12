export interface SidebarDataset {
  id: number;
  name: string;
  page_label: string | null;
  sidebar_sort: number;
}

let _cache: { items: SidebarDataset[]; ts: number } | null = null;
const TTL = 2 * 60 * 1000; // 2 minutes

type Listener = () => void;
const listeners = new Set<Listener>();

export function getCachedSidebarDatasets(): SidebarDataset[] | null {
  if (!_cache || Date.now() - _cache.ts > TTL) return null;
  return _cache.items;
}

export function setCachedSidebarDatasets(items: SidebarDataset[]): void {
  _cache = { items, ts: Date.now() };
}

export function invalidateSidebarCache(): void {
  _cache = null;
  listeners.forEach((fn) => {
    try { fn(); } catch { /* noop */ }
  });
}

export function subscribeSidebarCache(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
