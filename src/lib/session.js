// جلسة القفل المحلية: بعد إدخال PIN صحيح نحفظ علامة في localStorage
// حتى لا يُطلب الرمز في كل زيارة من نفس الجهاز/المتصفح.
// (قاعدة عمل من المتطلبات — القفل حماية من الفضوليين، ليس تشفيراً)

const KEY = 'kitabi_unlocked';

export function isUnlocked() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveUnlock() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* وضع التصفح الخاص قد يمنع التخزين — يُطلب الرمز كل مرة، وهذا مقبول */
  }
}

export function clearUnlock() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* تجاهل */
  }
}
