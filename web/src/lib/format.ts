const KIB = 1024;
const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

/** 12288 -> "12 KiB", 12582912 -> "12.0 MiB". */
export function formatBytes(bytes: number): string {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(1)} MiB`;
  if (bytes >= KIB) return `${trim(bytes / KIB)} KiB`;
  return `${bytes} B`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 100) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}


function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
