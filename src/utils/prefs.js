/* تفضيلات محلية في هذا المتصفح فقط (localStorage) — لا تُزامن بين الأجهزة. */

const NEW_TASK_AT_TOP_KEY = 'kitabi-new-task-at-top';

/** هل تُضاف المهمة الجديدة في بداية القائمة؟ الافتراضي نعم (السلوك الأصلي). */
export function getNewTaskAtTop() {
  return localStorage.getItem(NEW_TASK_AT_TOP_KEY) !== '0';
}

export function setNewTaskAtTop(atTop) {
  localStorage.setItem(NEW_TASK_AT_TOP_KEY, atTop ? '1' : '0');
}
