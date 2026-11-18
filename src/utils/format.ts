const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(iso: string | undefined, withSeconds = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(iso, false)}`;
}

/** 経過時間を「15分」「2時間5分」形式で返す */
export function formatElapsed(fromIso: string | undefined, now: number = Date.now()): string {
  if (!fromIso) return '—';
  const sec = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間${min % 60 ? `${min % 60}分` : ''}`;
  return `${Math.floor(h / 24)}日`;
}

export function minutesSince(iso: string | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function formatRelative(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const sec = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (sec < 10) return 'たった今';
  return `${formatElapsed(iso, now)}前`;
}

export function percent(part: number, total: number, digits = 1): string {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(digits).replace(/\.0$/, '')}%`;
}

export const nowIso = () => new Date().toISOString();
