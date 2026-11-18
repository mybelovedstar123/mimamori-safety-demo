let seq = 0;

/** 画面内で一意な ID を生成（モック用途） */
export function createId(prefix: string): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36).padStart(3, '0')}`;
}
