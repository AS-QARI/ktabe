/* آخر لقطة ناجحة للقراءة عند فقدان الشبكة. ليست بديلاً عن Supabase؛
   هي شبكة أمان شخصية تجعل دفتر الأمس متاحاً حتى في الطائرة. */
const KEY = 'kitabi-offline-snapshot-v1';

export function readOfflineSnapshot() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}

export function writeOfflineSnapshot(data) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...data, cached_at: new Date().toISOString() })); }
  catch { /* التخزين قد يكون ممتلئاً أو محجوباً في التصفح الخاص */ }
}

export function pagesFromSnapshot(snapshot) {
  if (!snapshot?.pages || !snapshot?.blocks) return null;
  return snapshot.pages.map((page) => ({
    ...page,
    blocks: snapshot.blocks.filter((block) => block.page_id === page.id),
  }));
}
