import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDayPages,
  listAllPages,
  createPage,
  updatePage,
  createBlock,
  updateBlock,
  setBlockCompleted,
  deleteBlock,
  onTablesChange,
} from '../data/storage';
import {
  todayKey,
  shiftDateKey,
  parseDateKey,
  formatWeekday,
  formatDateWithYear,
  relativeDayLabel,
} from '../utils/dates';
import {
  GearIcon,
  CalendarIcon,
  TrashIcon,
  CheckIcon,
  TaskCircleIcon,
  IndentIcon,
  OutdentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  FormatIcon,
  KeyboardHideIcon,
  SelectIcon,
  CopyIcon,
  XIcon,
} from '../components/ui/Icons';
import './screens.css';
import './DayScreen.css';

const SYNC_TABLES = ['pages', 'blocks'];
const DAY_RAIL_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
const shortWeekdayFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  weekday: 'short',
});
const dayNumberFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  day: 'numeric',
});
const noteTimeFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  day: 'numeric',
  month: 'short',
});

/* أنماط النص — تقابل قائمة الأنماط في لوحة تنسيق ملاحظات آبل */
const TEXT_STYLES = [
  { value: 'xl', label: 'العنوان', className: 'style-title' },
  { value: 'lg', label: 'عنوان', className: 'style-heading' },
  { value: 'md', label: 'نص أساسي', className: 'style-body' },
  { value: 'sm', label: 'نص صغير', className: 'style-small' },
];

function pageMetaKey(dateKey) {
  return `kitabi-page-meta:${dateKey}`;
}

function readLocalPageMeta(dateKey) {
  try {
    return JSON.parse(localStorage.getItem(pageMetaKey(dateKey))) ?? {};
  } catch {
    return {};
  }
}

function writeLocalPageMeta(dateKey, patch) {
  const next = { ...readLocalPageMeta(dateKey), ...patch };
  localStorage.setItem(pageMetaKey(dateKey), JSON.stringify(next));
  return next;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeRichHtml(content) {
  return content
    .replace(/\u200b/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<span\b(?![^>]*class=("|')rich-size-(sm|md|lg|xl)\1)[^>]*>/gi, '<span>')
    .replace(/<(?!\/?(?:span|strong|b|em|i|u|s|del|strike|br|div|p)\b)[^>]+>/gi, '');
}

function contentToHtml(content) {
  if (!content) return '';
  if (isBold(content)) return `<strong>${escapeHtml(content.slice(2, -2))}</strong>`;
  if (/<\/?(?:span|strong|b|em|i|u|s|del|strike|br|div|p|font)\b/i.test(content)) {
    return sanitizeRichHtml(content);
  }
  return escapeHtml(content).replace(/\n/g, '<br>');
}

function htmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\u200b/g, '');
}

function contentText(content) {
  return contentToHtml(content)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmptyContent(content) {
  return !content || content.replace(/<[^>]*>/g, '').replace(/&nbsp;|\u200b/g, '').trim() === '';
}

function noteUpdatedAt(page) {
  const values = [page.updated_at, page.created_at, ...(page.blocks ?? []).map((b) => b.updated_at)];
  return Math.max(...values.filter(Boolean).map((value) => new Date(value).getTime()));
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtStart(el) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** يضع المؤشر بعد عدد محدد من الأحرف — لنقطة الالتحام عند دمج سطرين */
function placeCaretAtTextOffset(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    if (remaining <= len) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= len;
  }
  placeCaretAtEnd(el);
}

function selectionBelongsTo(el) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return el.contains(range.commonAncestorContainer);
}

/** هل المؤشر واقف في بداية السطر؟ (مثل آبل: Backspace هنا يزيل الدائرة أو يدمج) */
function caretAtLineStart(el) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) return false;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().replace(/\u200b/g, '') === '';
}

/**
 * قصّ ما بعد المؤشر من السطر وإرجاعه — سلوك Enter في ملاحظات آبل:
 * ما قبل المؤشر يبقى، وما بعده ينزل لسطر جديد.
 */
function splitAfterCaret(el) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const after = document.createRange();
  after.selectNodeContents(el);
  after.setStart(range.startContainer, range.startOffset);
  const div = document.createElement('div');
  div.appendChild(after.extractContents());
  return div.innerHTML;
}

function selectLineContents(el) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}

function applyInlineTextSize(el, size) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return false;
  if (range.collapsed) return false;

  const span = document.createElement('span');
  span.className = `rich-size-${size}`;
  span.appendChild(range.extractContents());
  range.insertNode(span);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  selection.addRange(nextRange);
  return true;
}

/** يمدد ارتفاع السطر مع التفاف النص — فيبقى النص جالساً على التسطير */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, el.offsetHeight)}px`;
}

/** استخراج محتوى Bold من النص: هل يحتوي على ** عند الطرفين؟ */
function isBold(content) {
  return content.startsWith('**') && content.endsWith('**') && content.length >= 5;
}

/**
 * شاشة "يومي" — تجربة كتابة مطابقة لتطبيق ملاحظات آبل:
 * مستند متصل يبدأ من الأعلى، Enter يقسم السطر عند المؤشر،
 * Enter على مهمة فارغة يخرج من قائمة المهام، Backspace في بداية
 * المهمة يزيل الدائرة ثم يدمج مع السطر السابق، سحب أفقي للإزاحة،
 * وضغط مطول على الدائرة لالتقاط المهمة وإعادة ترتيبها.
 */
export default function DayScreen({ dateKey, onDateChange, onOpenSettings }) {
  const [pages, setPages] = useState(null); // null = يحمّل
  const [allPages, setAllPages] = useState([]);
  const [error, setError] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [caretIntent, setCaretIntent] = useState('end'); // 'end' | 'start' | { offset }
  const [flip, setFlip] = useState('next');
  const [localPageMeta, setLocalPageMeta] = useState(() => readLocalPageMeta(dateKey));
  const [activePageId, setActivePageId] = useState(null);
  const [pendingOpenPageId, setPendingOpenPageId] = useState(null);
  const [notesScope, setNotesScope] = useState('day');
  const [draggingId, setDraggingId] = useState(null);
  const [dragGhost, setDragGhost] = useState(null); // بطاقة الشبح التي تتبع الإصبع
  const [dropSlot, setDropSlot] = useState(null); // فتحة الإفلات: خط إدراج أو تعشيش
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastEditRef = useRef(0);
  const saveTimers = useRef(new Map());
  const pageSaveTimer = useRef(null);
  const inputRefs = useRef(new Map());
  const dateInputRef = useRef(null);
  const paperLinesRef = useRef(null);
  const dropSlotRef = useRef(null); // مرآة dropSlot للقراءة وقت الإفلات
  const dragCtx = useRef(null); // سياق السحب الجاري: لقطة الأسطر والتمرير
  const ghostRef = useRef(null);

  const markEdit = () => {
    lastEditRef.current = Date.now();
  };

  const load = useCallback(async () => {
    try {
      const [dayPages, everyPage] = await Promise.all([
        getDayPages(dateKey),
        listAllPages(),
      ]);
      setPages(dayPages);
      setAllPages(everyPage);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [dateKey]);

  useEffect(() => {
    setPages(null);
    setFocusedId(null);
    setActivePageId(null);
    setSelectMode(false);
    setFormatMenuOpen(false);
    load();
  }, [load]);

  useEffect(() => {
    setLocalPageMeta(readLocalPageMeta(dateKey));
  }, [dateKey]);

  useEffect(() => {
    const updateMobileChrome = () => {
      const viewport = window.visualViewport;
      const docHeight = document.documentElement.clientHeight || window.innerHeight;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const layoutHeight = Math.max(window.innerHeight, docHeight);
      const inset = Math.max(0, layoutHeight - viewportHeight - viewportTop);
      setKeyboardInset(Math.round(inset));
    };

    updateMobileChrome();
    window.addEventListener('resize', updateMobileChrome);
    window.addEventListener('orientationchange', updateMobileChrome);
    window.visualViewport?.addEventListener('resize', updateMobileChrome);
    window.visualViewport?.addEventListener('scroll', updateMobileChrome);
    return () => {
      window.removeEventListener('resize', updateMobileChrome);
      window.removeEventListener('orientationchange', updateMobileChrome);
      window.visualViewport?.removeEventListener('resize', updateMobileChrome);
      window.visualViewport?.removeEventListener('scroll', updateMobileChrome);
    };
  }, []);

  // تزامن لحظي بين الأجهزة — يتوقف مؤقتاً أثناء الكتابة المحلية
  useEffect(() => {
    let t;
    const off = onTablesChange(SYNC_TABLES, () => {
      if (Date.now() - lastEditRef.current < 4000) return;
      clearTimeout(t);
      t = setTimeout(load, 300);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, [load]);

  const sortedPages = useMemo(
    () => [...(pages ?? [])].sort((a, b) => a.page_no - b.page_no),
    [pages]
  );
  const sortedAllPages = useMemo(
    () => [...allPages].sort((a, b) => noteUpdatedAt(b) - noteUpdatedAt(a)),
    [allPages]
  );
  const page = sortedPages.find((p) => p.id === activePageId) ?? null;
  const blocks = useMemo(() => page?.blocks ?? [], [page]);
  const pageMeta = {
    ...localPageMeta,
    ...(page?.title != null ? { title: page.title } : {}),
    ...(page?.text_size != null ? { text_size: page.text_size } : {}),
  };

  /** شجرة السطور مسطّحة ومتصلة — مثل مستند ملاحظات آبل، بلا فراغات */
  const rows = useMemo(() => {
    const roots = blocks
      .filter((b) => !b.parent_id)
      .sort((a, b) => a.position - b.position);
    const childrenByParent = new Map();
    for (const block of blocks.filter((b) => b.parent_id)) {
      if (!childrenByParent.has(block.parent_id)) childrenByParent.set(block.parent_id, []);
      childrenByParent.get(block.parent_id).push(block);
    }
    for (const children of childrenByParent.values()) {
      children.sort((a, b) => a.position - b.position);
    }
    const out = [];
    const append = (block, depth) => {
      out.push({ block, depth });
      for (const child of childrenByParent.get(block.id) ?? []) append(child, depth + 1);
    };
    roots.forEach((root) => append(root, 0));
    return out;
  }, [blocks]);

  const focusedRow = rows.find((r) => r.block.id === focusedId) ?? null;
  const dayBlocks = useMemo(
    () => sortedPages.flatMap((p) => p.blocks ?? []),
    [sortedPages]
  );
  const dayTasks = dayBlocks.filter((b) => b.kind === 'task');
  const dayDoneTasks = dayTasks.filter((b) => b.is_completed);
  const dayProgress =
    dayTasks.length === 0 ? 0 : Math.round((dayDoneTasks.length / dayTasks.length) * 100);
  const noteCards = useMemo(
    () =>
      sortedPages.map((p) => {
        const pageBlocks = [...(p.blocks ?? [])].sort((a, b) => a.position - b.position);
        const firstText = pageBlocks.map((b) => contentText(b.content)).find(Boolean);
        const taskCount = pageBlocks.filter((b) => b.kind === 'task').length;
        const doneCount = pageBlocks.filter((b) => b.kind === 'task' && b.is_completed).length;
        return {
          page: p,
          title: p.title?.trim() || `ملاحظة ${p.page_no}`,
          preview: firstText || 'اضغط وافتح مساحة كتابة جديدة لهذه الملاحظة.',
          lineCount: pageBlocks.length,
          taskCount,
          doneCount,
        };
      }),
    [sortedPages]
  );
  const allNoteCards = useMemo(
    () =>
      sortedAllPages.map((p) => {
        const pageBlocks = [...(p.blocks ?? [])].sort((a, b) => a.position - b.position);
        const firstText = pageBlocks.map((b) => contentText(b.content)).find(Boolean);
        const taskCount = pageBlocks.filter((b) => b.kind === 'task').length;
        const doneCount = pageBlocks.filter((b) => b.kind === 'task' && b.is_completed).length;
        return {
          page: p,
          title: p.title?.trim() || `ملاحظة ${p.page_no}`,
          preview: firstText || 'اضغط وافتح مساحة كتابة هذه الملاحظة.',
          lineCount: pageBlocks.length,
          taskCount,
          doneCount,
          dateLabel: noteTimeFmt.format(parseDateKey(p.page_date)),
        };
      }),
    [sortedAllPages]
  );
  const visibleNoteCards = notesScope === 'all' ? allNoteCards : noteCards;

  useEffect(() => {
    if (!pendingOpenPageId || pages === null) return;
    if (pages.some((p) => p.id === pendingOpenPageId)) {
      setActivePageId(pendingOpenPageId);
      setPendingOpenPageId(null);
    }
  }, [pages, pendingOpenPageId]);
  const dayRail = useMemo(
    () =>
      DAY_RAIL_OFFSETS.map((offset) => {
        const key = shiftDateKey(dateKey, offset);
        const dayDate = parseDateKey(key);
        return {
          key,
          offset,
          weekday: shortWeekdayFmt.format(dayDate).replace('.', ''),
          day: dayNumberFmt.format(dayDate),
          isToday: key === todayKey(),
          isSelected: key === dateKey,
        };
      }),
    [dateKey]
  );

  // تركيز السطر الجديد/التالي بعد اكتمال الرسم.
  useEffect(() => {
    if (!pendingFocus) return;
    if (inputRefs.current.has(pendingFocus)) {
      setFocusedId(pendingFocus);
      setPendingFocus(null);
    }
  });

  /* ================= تعديل السطور (محلي فوراً + حفظ خلفي) ================= */

  const mutate = (fn) =>
    setPages((ps) =>
      ps.map((p) => (p.id === page.id ? { ...p, blocks: fn(p.blocks) } : p))
    );

  const touchPageInAllPages = (pageId, updater) => {
    const updatedAt = new Date().toISOString();
    setAllPages((ps) =>
      ps.map((p) =>
        p.id === pageId ? { ...updater(p), updated_at: updatedAt } : p
      )
    );
  };

  const savePagePatch = async (patch) => {
    markEdit();
    try {
      const p = await ensurePage();
      setLocalPageMeta(writeLocalPageMeta(dateKey, patch));
      setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
      touchPageInAllPages(p.id, (x) => ({ ...x, ...patch }));
      clearTimeout(pageSaveTimer.current);
      pageSaveTimer.current = setTimeout(() => {
        updatePage(p.id, patch).catch(() => {});
      }, 500);
    } catch {
      setLocalPageMeta(writeLocalPageMeta(dateKey, patch));
    }
  };

  const editContent = (block, value) => {
    markEdit();
    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, content: value } : b)));
    touchPageInAllPages(block.page_id, (p) => ({
      ...p,
      blocks: (p.blocks ?? []).map((b) =>
        b.id === block.id ? { ...b, content: value, updated_at: new Date().toISOString() } : b
      ),
    }));
    clearTimeout(saveTimers.current.get(block.id));
    saveTimers.current.set(
      block.id,
      setTimeout(() => {
        updateBlock(block.id, { content: value }).catch(() => {});
      }, 700)
    );
  };

  const ensurePage = async () => {
    if (page) return page;
    const created = await createPage(dateKey, 1);
    const nextPage = { ...created, blocks: [] };
    setPages([nextPage]);
    setActivePageId(nextPage.id);
    return nextPage;
  };

  const addNotePage = async () => {
    markEdit();
    try {
      const nextNo =
        sortedPages.length > 0 ? Math.max(...sortedPages.map((p) => p.page_no || 0)) + 1 : 1;
      const created = await createPage(dateKey, nextNo);
      const nextPage = { ...created, blocks: [] };
      setPages((ps) => [...(ps ?? []), nextPage].sort((a, b) => a.page_no - b.page_no));
      setAllPages((ps) => [nextPage, ...ps]);
      setActivePageId(nextPage.id);
      setFocusedId(null);
      setCaretIntent('end');
    } catch {
      load();
    }
  };

  const openNoteCard = (targetPage) => {
    setFocusedId(null);
    setFormatMenuOpen(false);
    if (targetPage.page_date === dateKey) {
      setActivePageId(targetPage.id);
      return;
    }
    setPendingOpenPageId(targetPage.id);
    setFlip(targetPage.page_date < dateKey ? 'prev' : 'next');
    onDateChange(targetPage.page_date);
  };

  /** أول كتابة في يوم فارغ: ننشئ الصفحة (إن لزم) وسطرها الأول */
  const startWriting = async () => {
    markEdit();
    try {
      const p = await ensurePage();
      const b = await createBlock({
        page_id: p.id,
        kind: 'text',
        content: '',
        position: 1,
      });
      setPages((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, blocks: [...x.blocks, b] } : x))
      );
      touchPageInAllPages(p.id, (x) => ({ ...x, blocks: [...(x.blocks ?? []), b] }));
      setCaretIntent('end');
      setPendingFocus(b.id);
    } catch {
      load();
    }
  };

  /**
   * النقر في المساحة الفارغة أسفل النص — مثل آبل: المؤشر ينتقل لنهاية
   * المستند؛ إذا كان آخر سطر فارغاً نركّزه بدل إنشاء سطر جديد.
   */
  const appendAtEnd = async () => {
    const last = rows.at(-1);
    if (last && isEmptyContent(last.block.content)) {
      setCaretIntent('end');
      setPendingFocus(last.block.id);
      return;
    }
    markEdit();
    try {
      const p = await ensurePage();
      const roots = (p.blocks ?? []).filter((b) => !b.parent_id);
      const position = roots.length
        ? Math.max(...roots.map((b) => b.position || 0)) + 1
        : 1;
      const b = await createBlock({
        page_id: p.id,
        kind: 'text',
        content: '',
        position,
      });
      setPages((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, blocks: [...x.blocks, b] } : x))
      );
      touchPageInAllPages(p.id, (x) => ({ ...x, blocks: [...(x.blocks ?? []), b] }));
      setCaretIntent('end');
      setPendingFocus(b.id);
    } catch {
      load();
    }
  };

  /** Enter: سطر جديد بعد الحالي بنفس النوع — وما بعد المؤشر ينزل معه */
  const insertAfter = async (row, carry = '') => {
    markEdit();
    const { block } = row;
    const siblings = blocks
      .filter((b) => (b.parent_id ?? null) === (block.parent_id ?? null))
      .sort((a, b) => a.position - b.position);
    const idx = siblings.findIndex((b) => b.id === block.id);
    const next = siblings[idx + 1];
    const position = next ? (block.position + next.position) / 2 : block.position + 1;
    try {
      const b = await createBlock({
        page_id: page.id,
        parent_id: block.parent_id,
        kind: block.kind,
        content: carry,
        position,
      });
      mutate((bs) => [...bs, b]);
      touchPageInAllPages(page.id, (p) => ({ ...p, blocks: [...(p.blocks ?? []), b] }));
      setCaretIntent('start');
      setPendingFocus(b.id);
    } catch {
      load();
    }
  };

  /** لصق نص متعدد الأسطر: كل سطر يصبح فقرة/مهمة مستقلة — مثل آبل */
  const insertBlocksAfter = async (row, htmls) => {
    if (htmls.length === 0) return;
    markEdit();
    const { block } = row;
    const siblings = blocks
      .filter((b) => (b.parent_id ?? null) === (block.parent_id ?? null))
      .sort((a, b) => a.position - b.position);
    const idx = siblings.findIndex((b) => b.id === block.id);
    const next = siblings[idx + 1];
    const step = next ? (next.position - block.position) / (htmls.length + 1) : 1;
    try {
      const created = [];
      for (let i = 0; i < htmls.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const b = await createBlock({
          page_id: page.id,
          parent_id: block.parent_id,
          kind: block.kind,
          content: htmls[i],
          position: block.position + step * (i + 1),
        });
        created.push(b);
      }
      mutate((bs) => [...bs, ...created]);
      touchPageInAllPages(page.id, (p) => ({ ...p, blocks: [...(p.blocks ?? []), ...created] }));
      setCaretIntent('end');
      setPendingFocus(created.at(-1).id);
    } catch {
      load();
    }
  };

  const removeRow = (row) => {
    markEdit();
    const i = rows.findIndex((r) => r.block.id === row.block.id);
    const prev = rows[i - 1];
    mutate((bs) =>
      bs.filter((b) => b.id !== row.block.id && b.parent_id !== row.block.id)
    );
    deleteBlock(row.block.id).catch(() => load());
    if (prev) {
      setCaretIntent('end');
      setPendingFocus(prev.block.id);
    }
  };

  /**
   * دمج السطر مع السطر السابق — سلوك Backspace في بداية السطر عند آبل:
   * النص يلتحق بنهاية السطر السابق والمؤشر يقف عند نقطة الالتحام.
   */
  const mergeIntoPrevious = (row, prev) => {
    const el = inputRefs.current.get(row.block.id);
    const prevEl = inputRefs.current.get(prev.block.id);
    const currentHtml = sanitizeRichHtml(el?.innerHTML ?? contentToHtml(row.block.content));
    const prevHtml = sanitizeRichHtml(prevEl?.innerHTML ?? contentToHtml(prev.block.content));
    const merged = sanitizeRichHtml(prevHtml + currentHtml);
    const offset = htmlToText(prevHtml).length;

    markEdit();
    mutate((bs) =>
      bs
        .filter((b) => b.id !== row.block.id)
        .map((b) => (b.id === prev.block.id ? { ...b, content: merged } : b))
    );
    clearTimeout(saveTimers.current.get(prev.block.id));
    saveTimers.current.set(
      prev.block.id,
      setTimeout(() => {
        updateBlock(prev.block.id, { content: merged }).catch(() => {});
      }, 400)
    );
    deleteBlock(row.block.id).catch(() => load());
    setCaretIntent({ offset });
    setPendingFocus(prev.block.id);
  };

  const toggleComplete = (block) => {
    markEdit();
    navigator.vibrate?.(10);
    const done = !block.is_completed;
    const completedAt = done ? new Date().toISOString() : null;
    mutate((bs) =>
      bs.map((b) =>
        b.id === block.id
          ? { ...b, is_completed: done, completed_at: completedAt }
          : b
      )
    );
    touchPageInAllPages(block.page_id, (p) => ({
      ...p,
      blocks: (p.blocks ?? []).map((b) =>
        b.id === block.id ? { ...b, is_completed: done, completed_at: completedAt } : b
      ),
    }));
    setBlockCompleted(block.id, done).catch(() => load());
  };

  /** تحويل نص ↔ مهمة (زر قائمة المهام في شريط الأدوات — مثل آبل) */
  const convertKind = (block) => {
    markEdit();
    navigator.vibrate?.(8);
	    const patch =
	      block.kind === 'text'
	        ? { kind: 'task' }
	        : { kind: 'text', is_completed: false, completed_at: null };
	    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, ...patch } : b)));
    touchPageInAllPages(block.page_id, (p) => ({
      ...p,
      blocks: (p.blocks ?? []).map((b) => (b.id === block.id ? { ...b, ...patch } : b)),
    }));
	    updateBlock(block.id, patch).catch(() => load());
	  };

  /** أقرب مهمة رئيسية فوق هذا السطر الرئيسي — المرشّح ليكون أباً له */
  const prevRootTask = (block) => {
    if (!block || block.parent_id) return null;
    const roots = blocks
      .filter((b) => !b.parent_id)
      .sort((a, b) => a.position - b.position);
    const idx = roots.findIndex((b) => b.id === block.id);
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (roots[i].kind === 'task') return roots[i];
    }
    return null;
  };

  const canIndent =
    focusedRow &&
    focusedRow.depth === 0 &&
    focusedRow.block.kind === 'task' &&
    Boolean(prevRootTask(focusedRow.block));

  /**
   * إدخال سطر (مع أبنائه إن وجدوا) تحت مهمة أخرى عند فهرس محدد.
   * index هو موضع الإدراج بين الأبناء الحاليين (بدون المسحوب نفسه)،
   * وnull تعني الإلحاق في النهاية. الأبناء ينضمون لنفس الأب الجديد —
   * العمق يبقى مستويين كحد أقصى لأن بقية الشاشات تفترض ذلك.
   */
  const nestUnderParent = (blockId, parentId, index = null) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !parentId || parentId === blockId) return;
    const ownChildren = blocks
      .filter((b) => b.parent_id === blockId)
      .sort((a, b) => a.position - b.position);
    const siblings = blocks
      .filter((b) => b.parent_id === parentId && b.id !== blockId)
      .sort((a, b) => a.position - b.position);
    const at =
      index == null
        ? siblings.length
        : Math.max(0, Math.min(index, siblings.length));
    const ordered = [...siblings.slice(0, at), block, ...ownChildren, ...siblings.slice(at)];

    const patches = new Map();
    ordered.forEach((b, i) => {
      const patch = {};
      if ((b.parent_id ?? null) !== parentId) patch.parent_id = parentId;
      if (b.position !== i + 1) patch.position = i + 1;
      if (Object.keys(patch).length > 0) patches.set(b.id, patch);
    });
    if (patches.size === 0) return;

    markEdit();
    mutate((bs) => bs.map((b) => (patches.has(b.id) ? { ...b, ...patches.get(b.id) } : b)));
    for (const [id, patch] of patches) {
      updateBlock(id, patch).catch(() => load());
    }
    setCaretIntent('end');
    setPendingFocus(blockId);
  };

  /** إزاحة للداخل: إدخال المهمة الحالية تحت أقرب مهمة رئيسية فوقها */
  const indentUnderPrevious = (row) => {
    const { block } = row;
    if (block.kind !== 'task' || block.parent_id) return;
    const parent = prevRootTask(block);
    if (!parent) return;
    navigator.vibrate?.(10);
    nestUnderParent(block.id, parent.id);
  };

  const outdent = (row) => {
    const { block } = row;
    const parent = blocks.find((b) => b.id === block.parent_id);
    if (!parent) return;
    navigator.vibrate?.(10);
    const roots = blocks
      .filter((b) => !b.parent_id)
      .sort((a, b) => a.position - b.position);
    const pIdx = roots.findIndex((b) => b.id === parent.id);
    const nextRoot = roots[pIdx + 1];
    const position = nextRoot
      ? (parent.position + nextRoot.position) / 2
      : parent.position + 1;
    markEdit();
    const patch = { parent_id: null, position };
    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, ...patch } : b)));
    updateBlock(block.id, patch).catch(() => load());
    setCaretIntent('end');
    setPendingFocus(block.id);
  };

  /* ============ إعادة ترتيب المهام بالسحب — محرك موحّد مثل آبل ============
     التقاط بالضغط المطول على الدائرة (أو سحب مباشر بالفأرة)، بطاقة شبح
     تتبع الإصبع، مناطق إفلات هندسية من لقطة ثابتة (لا رفرفة)، مؤشر
     إدراج بمستوى الإدراج نفسه (جذر/فرعي)، وتمرير تلقائي عند الحواف. */

  /** نقل المهمة لمستوى الجذور قبل جذر محدد أو لنهاية المستند */
  const moveTaskToEdge = (blockId, edge) => {
    const dragged = blocks.find((b) => b.id === blockId);
    if (!dragged || dragged.kind !== 'task') return;
    const roots = blocks
      .filter((b) => !b.parent_id && b.id !== blockId)
      .sort((a, b) => a.position - b.position);
    let position;
    if (edge === 'end') {
      position = (roots.at(-1)?.position ?? 0) + 1;
    } else {
      const idx = roots.findIndex((b) => b.id === edge);
      if (idx === -1) return;
      const before = roots[idx];
      const prev = roots[idx - 1];
      position = prev ? (prev.position + before.position) / 2 : before.position - 1;
    }
    markEdit();
    const patch = { parent_id: null, position };
    mutate((bs) => bs.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
    updateBlock(blockId, patch).catch(() => load());
    setCaretIntent('end');
    setPendingFocus(blockId);
  };

  const setSlot = (slot) => {
    dropSlotRef.current = slot;
    setDropSlot(slot);
  };

  /**
   * لقطة هندسية لأسطر المستند وقت الالتقاط: إحداثيات كل سطر ومستواه
   * وفهرسه بين إخوته. تُصحَّح لاحقاً بفارق التمرير فقط — بلا إعادة
   * قياس للـ DOM في كل حركة، فتبقى مناطق الإفلات ثابتة لا ترتجف.
   */
  const collectDragRects = (dragId) => {
    const scroller = paperLinesRef.current;
    if (!scroller) return null;
    const byId = new Map(rows.map((r) => [r.block.id, r]));
    const childIds = new Set(
      blocks.filter((b) => b.parent_id === dragId).map((b) => b.id)
    );
    const perParentCounter = new Map();
    const rects = [];
    for (const el of scroller.querySelectorAll('.paper-line[data-block-id]')) {
      const id = el.dataset.blockId;
      const row = byId.get(id);
      if (!row || id === dragId || childIds.has(id)) continue;
      const rect = el.getBoundingClientRect();
      const parentId = row.block.parent_id ?? null;
      const pKey = parentId ?? '__root__';
      const indexInParent = perParentCounter.get(pKey) ?? 0;
      perParentCounter.set(pKey, indexInParent + 1);
      rects.push({
        id,
        top: rect.top,
        height: rect.height,
        parentId,
        indexInParent,
        isTask: row.block.kind === 'task',
        hasChildren: blocks.some((b) => b.parent_id === id && b.id !== dragId),
      });
    }
    return {
      rects,
      scroller,
      baseScroll: scroller.scrollTop,
      contTop: scroller.getBoundingClientRect().top,
    };
  };

  /**
   * فتحة الإفلات من موضع المؤشر — مناطق واضحة لكل سطر:
   * الثلث الأعلى: إدراج قبله بمستواه، الثلث الأوسط (للمهام الرئيسية):
   * تعشيش تحته، الثلث الأسفل: إدراج بعده — وأسفلُ جذرٍ له أبناء يعني
   * «أول الفرعيات» فيمكن الوصول لأي موضع بدقة.
   */
  const slotFromPointer = (y) => {
    const ctx = dragCtx.current;
    if (!ctx || ctx.rects.length === 0) return null;
    const scrollDelta = ctx.scroller.scrollTop - ctx.baseScroll;
    const contentY = (viewY) =>
      viewY - ctx.contTop + ctx.scroller.scrollTop;

    const gapAtRoot = (beforeRootId, boundaryY) => ({
      kind: 'gap',
      parentId: null,
      beforeRootId,
      top: contentY(boundaryY),
      indent: 0,
      key: `root:${beforeRootId}`,
    });
    const gapInParent = (parentId, index, boundaryY) => ({
      kind: 'gap',
      parentId,
      index,
      top: contentY(boundaryY),
      indent: 1,
      key: `sub:${parentId}:${index}`,
    });
    const nextRootIdFrom = (from) =>
      ctx.rects.slice(from).find((q) => q.parentId === null)?.id ?? 'end';

    for (let i = 0; i < ctx.rects.length; i += 1) {
      const r = ctx.rects[i];
      const top = r.top - scrollDelta;
      const bottom = top + r.height;
      if (y >= bottom) continue;

      const rel = y < top ? 0 : (y - top) / Math.max(r.height, 1);
      const canNest = r.isTask && r.parentId === null;
      const beforeBand = canNest ? 0.3 : 0.5;
      const afterBand = canNest ? 0.7 : 0.5;

      if (rel < beforeBand) {
        return r.parentId === null
          ? gapAtRoot(r.id, top)
          : gapInParent(r.parentId, r.indexInParent, top);
      }
      if (canNest && rel < afterBand) {
        return { kind: 'nest', targetId: r.id, key: `nest:${r.id}` };
      }
      if (r.parentId === null) {
        return r.hasChildren
          ? gapInParent(r.id, 0, bottom)
          : gapAtRoot(nextRootIdFrom(i + 1), bottom);
      }
      return gapInParent(r.parentId, r.indexInParent + 1, bottom);
    }
    const last = ctx.rects.at(-1);
    return gapAtRoot('end', last.top - scrollDelta + last.height);
  };

  /** إعادة حساب الفتحة الحالية مع نطاق ميت صغير يمنع الرفرفة بين فتحتين */
  const refreshSlot = () => {
    const ctx = dragCtx.current;
    if (!ctx) return;
    const slot = slotFromPointer(ctx.lastY);
    const prev = dropSlotRef.current;
    if (!slot) {
      if (prev) setSlot(null);
      return;
    }
    if (prev && prev.key === slot.key) return;
    if (prev && Math.abs(ctx.lastY - ctx.slotY) < 4) return;
    ctx.slotY = ctx.lastY;
    setSlot(slot);
  };

  /** تحريك الشبح + التمرير التلقائي قرب الحواف + تحديث الفتحة */
  const moveTaskDrag = (x, y) => {
    const ctx = dragCtx.current;
    if (!ctx) return;
    ctx.lastX = x;
    ctx.lastY = y;
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate3d(${x - ctx.grabX}px, ${y - ctx.grabY}px, 0)`;
    }

    const rect = ctx.scroller.getBoundingClientRect();
    const EDGE = 64;
    let speed = 0;
    if (y < rect.top + EDGE) speed = -Math.ceil((rect.top + EDGE - y) / 7);
    else if (y > rect.bottom - EDGE) speed = Math.ceil((y - (rect.bottom - EDGE)) / 7);
    ctx.scrollSpeed = speed;
    if (speed !== 0 && !ctx.scrollRaf) {
      const step = () => {
        const c = dragCtx.current;
        if (!c || !c.scrollSpeed) {
          if (c) c.scrollRaf = null;
          return;
        }
        const before = c.scroller.scrollTop;
        c.scroller.scrollTop = before + c.scrollSpeed;
        if (c.scroller.scrollTop !== before) refreshSlot();
        c.scrollRaf = requestAnimationFrame(step);
      };
      ctx.scrollRaf = requestAnimationFrame(step);
    }
    refreshSlot();
  };

  /** التقاط مهمة: لقطة الأسطر + بطاقة شبح بعرض السطر تتبع الإصبع */
  const beginTaskDrag = (block, x, y, rowWidth) => {
    const collected = collectDragRects(block.id);
    if (!collected) return false;
    navigator.vibrate?.(16);
    const width = Math.min(Math.max(rowWidth, 180), 420);
    dragCtx.current = {
      id: block.id,
      ...collected,
      grabX: width - 18, // الإصبع عند دائرة الشبح (طرفها الأيمن في RTL)
      grabY: 58, // الشبح فوق الإصبع — فلا يغطي خط الإدراج تحته
      lastX: x,
      lastY: y,
      scrollSpeed: 0,
      scrollRaf: null,
      slotY: y,
    };
    setDraggingId(block.id);
    setDragGhost({
      text: contentText(block.content) || 'مهمة',
      done: Boolean(block.is_completed),
      width,
    });
    setSlot(slotFromPointer(y));
    return true;
  };

  /** إنهاء السحب: تثبيت الفتحة المختارة أو الإلغاء */
  const endTaskDrag = (commit) => {
    const ctx = dragCtx.current;
    if (ctx?.scrollRaf) cancelAnimationFrame(ctx.scrollRaf);
    const slot = dropSlotRef.current;
    const id = ctx?.id;
    dragCtx.current = null;
    setSlot(null);
    setDraggingId(null);
    setDragGhost(null);
    if (!commit || !slot || !id) return;
    navigator.vibrate?.(8);
    if (slot.kind === 'nest') nestUnderParent(id, slot.targetId);
    else if (slot.parentId) nestUnderParent(id, slot.parentId, slot.index);
    else moveTaskToEdge(id, slot.beforeRootId);
  };

  // موضع الشبح الأول — بعد أول رسم له مباشرة
  useEffect(() => {
    const ctx = dragCtx.current;
    if (dragGhost && ghostRef.current && ctx) {
      ghostRef.current.style.transform = `translate3d(${ctx.lastX - ctx.grabX}px, ${ctx.lastY - ctx.grabY}px, 0)`;
    }
  }, [dragGhost]);

  /* ================= لوحة المفاتيح — سلوك الكتابة ================= */

  const onKeyDown = (e, row) => {
    const el = inputRefs.current.get(row.block.id);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const html = el ? el.innerHTML : contentToHtml(row.block.content);
      // مثل آبل: Enter على مهمة فارغة يخرج من قائمة المهام
      if (row.block.kind === 'task' && isEmptyContent(html)) {
        if (row.depth > 0) outdent(row);
        else convertKind(row.block);
        return;
      }
      // تقسيم السطر عند المؤشر: ما بعده ينزل للسطر الجديد
      let carry = '';
      if (el) {
        carry = sanitizeRichHtml(splitAfterCaret(el) ?? '');
        if (isEmptyContent(carry)) carry = '';
        autoGrow(el);
        editContent(row.block, sanitizeRichHtml(el.innerHTML));
      }
      insertAfter(row, carry);
    } else if (e.key === 'Backspace') {
      const html = el ? el.innerHTML : '';
      // مثل آبل: Backspace في بداية مهمة يزيل الدائرة أولاً
      if (row.block.kind === 'task' && el && caretAtLineStart(el)) {
        e.preventDefault();
        convertKind(row.block);
        return;
      }
      if (isEmptyContent(html) && rows.length > 1) {
        e.preventDefault();
        removeRow(row);
        return;
      }
      // Backspace في بداية سطر غير فارغ: دمج مع السطر السابق
      if (el && caretAtLineStart(el) && !isEmptyContent(html)) {
        const i = rows.findIndex((r) => r.block.id === row.block.id);
        const prev = rows[i - 1];
        const hasChildren = blocks.some((b) => b.parent_id === row.block.id);
        if (prev && !hasChildren) {
          e.preventDefault();
          mergeIntoPrevious(row, prev);
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      applyCommandToFocusedSelection(row.block, 'bold');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (row.depth > 0) outdent(row);
      } else if (row.depth === 0 && row.block.kind === 'task') {
        indentUnderPrevious(row);
      }
    }
  };

  /** لصق: سطر واحد يُدرج مكانه، وتعدد الأسطر يتحول لفقرات/مهام مستقلة */
  const handlePaste = (e, row) => {
    if (focusedId !== row.block.id) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const lines = text.split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    const el = inputRefs.current.get(row.block.id);
    document.execCommand('insertText', false, lines[0] ?? '');
    if (el) requestAnimationFrame(() => autoGrow(el));
    const rest = lines.slice(1);
    if (rest.length > 0) {
      if (el) editContent(row.block, sanitizeRichHtml(el.innerHTML));
      insertBlocksAfter(row, rest.map((l) => escapeHtml(l)));
    }
  };

  const saveFocusedEditor = (block) => {
    const el = inputRefs.current.get(block.id);
    if (!el) return;
    editContent(block, sanitizeRichHtml(el.innerHTML));
  };

  /**
   * تطبيق أمر تنسيق (عريض/مائل/تسطير/يتوسطه خط) — مثل لوحة آبل:
   * بلا تحديد يُطبَّق على السطر كاملاً، ومع تحديد على الجزء المحدد.
   */
  const applyCommandToFocusedSelection = (block, command) => {
    const el = inputRefs.current.get(block.id);
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const autoSelected = !selectionBelongsTo(el) || !selection || selection.isCollapsed;
    if (autoSelected) {
      if (isEmptyContent(el.innerHTML)) return;
      selectLineContents(el);
    }
    document.execCommand(command, false, null);
    // التحديد التلقائي مؤقت — نطويه كي لا تستبدل الكتابةُ التالية السطرَ كله
    if (autoSelected) window.getSelection()?.collapseToEnd();
    saveFocusedEditor(block);
  };

  const applySizeToFocusedSelection = (block, size) => {
    const el = inputRefs.current.get(block.id);
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const autoSelected = !selectionBelongsTo(el) || !selection || selection.isCollapsed;
    if (autoSelected) {
      if (isEmptyContent(el.innerHTML)) return;
      selectLineContents(el);
    }
    if (applyInlineTextSize(el, size)) {
      if (autoSelected) window.getSelection()?.collapseToEnd();
      saveFocusedEditor(block);
    }
  };

  const dismissKeyboard = () => {
    setFormatMenuOpen(false);
    const el = focusedId ? inputRefs.current.get(focusedId) : null;
    el?.blur();
    setFocusedId(null);
  };

  /* ================= وضع تحديد النص عبر الأسطر =================
     كل سطر عنصر contentEditable مستقل، والمتصفح يحبس التحديد داخل
     العنصر القابل للتحرير. وضع التحديد يعطّل التحرير مؤقتاً فتصبح
     الصفحة كلها نصاً واحداً قابلاً للتحديد الحر. */

  const enterSelectMode = () => {
    const el = focusedId ? inputRefs.current.get(focusedId) : null;
    setFormatMenuOpen(false);
    setSelectMode(true);
    setFocusedId(null);
    el?.blur();
  };

  const exitSelectMode = () => {
    window.getSelection()?.removeAllRanges();
    setSelectMode(false);
    setCopied(false);
  };

  const selectAllLines = () => {
    const root = paperLinesRef.current;
    const selection = window.getSelection();
    if (!root || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(root);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const copySelection = async () => {
    const text = window
      .getSelection()
      ?.toString()
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand('copy');
    }
    navigator.vibrate?.(10);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /* ================= التنقل بين الأيام ================= */

  const goDay = (delta) => {
    navigator.vibrate?.(8);
    setFlip(delta < 0 ? 'prev' : 'next');
    onDateChange(shiftDateKey(dateKey, delta));
  };

  const goDate = (key) => {
    if (!key || key === dateKey) return;
    setFlip(key < dateKey ? 'prev' : 'next');
    onDateChange(key);
  };

  const pickDate = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (el.showPicker) el.showPicker();
    else el.click();
  };

  const d = parseDateKey(dateKey);
  const isToday = dateKey === todayKey();

  return (
    <main
      className="screen day-screen"
      style={{
        '--keyboard-inset': `${keyboardInset}px`,
      }}
    >
      {/* شريط علوي */}
      <div className="day-topbar">
        <input
          ref={dateInputRef}
          type="date"
          className="day-date-input"
          value={dateKey}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => goDate(e.target.value)}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="الانتقال لتاريخ محدد"
          onClick={pickDate}
        >
          <CalendarIcon size={22} />
        </button>
        {!isToday && (
          <button type="button" className="btn-text day-today-btn" onClick={() => goDate(todayKey())}>
            العودة لليوم
          </button>
        )}
        <button
          type="button"
          className="icon-btn day-settings-btn"
          aria-label="الإعدادات"
          onClick={onOpenSettings}
        >
          <GearIcon size={24} />
        </button>
      </div>

      <section className="day-compact-nav" aria-label="التنقل اليومي">
        <div className="day-rail" aria-label="التنقل بين الأيام">
          {dayRail.map((item) => (
            <button
              key={item.key}
              type="button"
              className={[
                'day-rail-item',
                item.isSelected ? 'selected' : '',
                item.isToday ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={item.isSelected ? 'date' : undefined}
              onClick={() => goDate(item.key)}
            >
              <span>{item.weekday}</span>
              <strong>{item.day}</strong>
            </button>
          ))}
        </div>
        <div className="day-progress-pill" style={{ '--progress': `${dayProgress}%` }}>
          <strong>{dayProgress}%</strong>
          <span>إنجاز</span>
        </div>
      </section>

      <div className="book">
        <div
          key={`${dateKey}-${page?.id ?? 'notes'}`}
          className={`paper flip-${flip}`}
        >
          <header className={`paper-head${page ? ' note-open' : ''}`}>
            {page && (
              <button
                type="button"
                className="note-back"
                aria-label="العودة للملاحظات"
                onClick={() => {
                  setActivePageId(null);
                  setFocusedId(null);
                  setFormatMenuOpen(false);
                }}
              >
                ملاحظاتي
              </button>
            )}
            <div className="paper-date">
              <span className="paper-weekday">{relativeDayLabel(dateKey)} · {formatWeekday(d)}</span>
              <span className="paper-daynum">{formatDateWithYear(d)}</span>
              {page ? (
                <input
                  className="day-title-input"
                  value={pageMeta.title ?? ''}
                  placeholder="عنوان الملاحظة"
                  onChange={(e) => savePagePatch({ title: e.target.value })}
                />
              ) : (
                <h1 className="notes-title">ملاحظات اليوم</h1>
              )}
            </div>
            <button
              type="button"
              className="note-add-head"
              aria-label="ملاحظة جديدة"
              onClick={addNotePage}
            >
              +
            </button>
          </header>

          {error && (
            <div className="error-banner">
              <span>تعذّر تحميل الصفحة</span>
              <button type="button" onClick={load}>أعد المحاولة</button>
            </div>
          )}

          {pages === null && !error && (
            <div className="inline-loading"><div className="spinner" /></div>
          )}

          {pages !== null && !error && !page && (
            <section className="notes-list" aria-label="ملاحظات اليوم">
              <div className="notes-scope-switch" aria-label="نطاق الملاحظات">
                <button
                  type="button"
                  className={notesScope === 'day' ? 'active' : ''}
                  onClick={() => setNotesScope('day')}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  className={notesScope === 'all' ? 'active' : ''}
                  onClick={() => setNotesScope('all')}
                >
                  كل الملاحظات
                </button>
              </div>

              {visibleNoteCards.length === 0 ? (
                <button type="button" className="empty-note-card" onClick={addNotePage}>
                  <span>{notesScope === 'all' ? 'لا توجد ملاحظات' : 'لا توجد ملاحظات اليوم'}</span>
                  <strong>ابدأ ملاحظة جديدة</strong>
                  <p>اكتب فكرة، مهمة، أو صفحة كاملة لهذا اليوم.</p>
                </button>
		              ) : (
		                visibleNoteCards.map((card) => (
		                  <button
		                    key={card.page.id}
		                    type="button"
		                    className="note-card"
		                    onClick={() => openNoteCard(card.page)}
		                  >
		                    <span className="note-card-index">
                          {notesScope === 'all' ? `${card.dateLabel} · ` : ''}
                          ملاحظة {card.page.page_no}
                        </span>
		                    <strong>{card.title}</strong>
		                    <p>{card.preview}</p>
	                    <span className="note-card-meta">
	                      {card.lineCount || 'بدون'} سطر
	                      {card.taskCount > 0 && ` · ${card.doneCount}/${card.taskCount} مهام`}
	                    </span>
	                  </button>
	                ))
	              )}
            </section>
          )}

          {pages !== null && !error && page && (
            <div
              className={`paper-lines${selectMode ? ' select-mode' : ''}${draggingId ? ' is-dragging' : ''}`}
              ref={paperLinesRef}
              onPointerDown={() => {
                // مثل آبل: لمس الورقة يغلق لوحة التنسيق المفتوحة
                if (formatMenuOpen) setFormatMenuOpen(false);
              }}
              onClick={(e) => {
                if (selectMode || draggingId) return;
                // لا ننشئ سطراً إذا كان هناك تحديد نص قائم — النقرة تتبع نهاية السحب
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed) return;
                if (e.target === paperLinesRef.current) appendAtEnd();
              }}
            >
              {/* مؤشر الإدراج — خط بمستوى الفتحة المستهدفة (جذر/فرعي) */}
              {dropSlot?.kind === 'gap' && (
                <span
                  className="drop-line"
                  aria-hidden="true"
                  style={{
                    top: `${dropSlot.top}px`,
                    insetInlineStart: dropSlot.indent ? '58px' : '14px',
                  }}
                />
              )}
              {rows.length === 0 ? (
                <button type="button" className="paper-starter" onClick={startWriting}>
                  اضغط هنا وابدأ الكتابة…
                </button>
              ) : (
                rows.map((row) => (
                  <PaperLine
                    key={row.block.id}
                    row={row}
                    isFocused={focusedId === row.block.id}
                    caretIntent={caretIntent}
                    selectMode={selectMode}
                    refCb={(el) => {
                      if (el) {
                        inputRefs.current.set(row.block.id, el);
                        autoGrow(el);
                      } else {
                        inputRefs.current.delete(row.block.id);
                      }
                    }}
                    onChange={editContent}
                    onKeyDown={onKeyDown}
                    onPaste={handlePaste}
                    onToggle={toggleComplete}
                    onFocus={setFocusedId}
                    onBlur={() =>
                      setTimeout(
                        () => setFocusedId((f) => (f === row.block.id ? null : f)),
                        150
                      )
                    }
                    dragging={draggingId === row.block.id}
                    anyDragging={Boolean(draggingId)}
                    isNestTarget={
                      dropSlot?.kind === 'nest' && dropSlot.targetId === row.block.id
                    }
                    onDragBegin={beginTaskDrag}
                    onDragMove={moveTaskDrag}
                    onDragFinish={endTaskDrag}
                    onSwipeIndent={() => {
                      if (row.depth === 0) indentUnderPrevious(row);
                    }}
                    onSwipeOutdent={() => {
                      if (row.depth > 0) outdent(row);
                    }}
                  />
                ))
              )}
              <button
                type="button"
                className="paper-tail"
                aria-label="متابعة الكتابة في نهاية الصفحة"
                onClick={appendAtEnd}
              />
            </div>
          )}

          {/* ذيل الورقة خفيف بدون صفحات متعددة */}
          <footer className="paper-foot" />
        </div>
      </div>

      {/* بطاقة الشبح — تتبع الإصبع أثناء سحب مهمة */}
      {dragGhost && (
        <div className="drag-ghost" ref={ghostRef} style={{ width: `${dragGhost.width}px` }}>
          <div className="drag-ghost-card">
            <span className={`drag-ghost-circle${dragGhost.done ? ' done' : ''}`}>
              <CheckIcon size={12} />
            </span>
            <span className="drag-ghost-text">{dragGhost.text}</span>
          </div>
        </div>
      )}

      {/* شريط وضع التحديد */}
      {selectMode && (
        <div className="line-toolbar select-toolbar" onPointerDown={(e) => e.preventDefault()}>
          <button type="button" className="line-tool" onClick={selectAllLines}>
            <SelectIcon size={19} /> تحديد الكل
          </button>
          <button type="button" className="line-tool" onClick={copySelection}>
            <CopyIcon size={19} /> {copied ? 'تم النسخ ✓' : 'نسخ'}
          </button>
          <button type="button" className="line-tool" onClick={exitSelectMode}>
            <CheckIcon size={17} /> تم
          </button>
        </div>
      )}

      {/* شريط الأدوات فوق الكيبورد — بأسلوب شريط ملاحظات آبل */}
      {!selectMode && focusedRow && (
        <div
          className={`line-toolbar kb-bar${keyboardInset > 60 ? ' kb-attached' : ''}`}
          onPointerDown={(e) => e.preventDefault()}
        >
          {/* تنسيق النص Aa */}
          <div className="kb-format-anchor">
            <button
              type="button"
              className={`line-tool kb-tool${formatMenuOpen ? ' active-tool' : ''}`}
              aria-label="تنسيق النص"
              aria-haspopup="menu"
              aria-expanded={formatMenuOpen}
              onClick={() => setFormatMenuOpen((open) => !open)}
            >
              <FormatIcon size={23} />
            </button>

            {formatMenuOpen && (
              <div className="format-panel" role="menu">
                <div className="format-panel-head">
                  <span>التنسيق</span>
                  <button
                    type="button"
                    className="format-close"
                    aria-label="إغلاق التنسيق"
                    onClick={() => setFormatMenuOpen(false)}
                  >
                    <XIcon size={15} />
                  </button>
                </div>

                <div className="format-styles">
                  {TEXT_STYLES.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      className={`format-style ${style.className}`}
                      role="menuitem"
                      onClick={() => applySizeToFocusedSelection(focusedRow.block, style.value)}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>

                <div className="format-actions">
                  <button
                    type="button"
                    className="format-action"
                    aria-label="عريض"
                    title="خط عريض (Ctrl+B)"
                    onClick={() => applyCommandToFocusedSelection(focusedRow.block, 'bold')}
                  >
                    <BoldIcon size={19} />
                  </button>
                  <button
                    type="button"
                    className="format-action"
                    aria-label="مائل"
                    onClick={() => applyCommandToFocusedSelection(focusedRow.block, 'italic')}
                  >
                    <ItalicIcon size={19} />
                  </button>
                  <button
                    type="button"
                    className="format-action"
                    aria-label="تسطير"
                    onClick={() => applyCommandToFocusedSelection(focusedRow.block, 'underline')}
                  >
                    <UnderlineIcon size={19} />
                  </button>
                  <button
                    type="button"
                    className="format-action"
                    aria-label="يتوسطه خط"
                    onClick={() => applyCommandToFocusedSelection(focusedRow.block, 'strikeThrough')}
                  >
                    <StrikethroughIcon size={19} />
                  </button>
                </div>

                <div className="format-actions">
                  <button
                    type="button"
                    className="format-action format-indent"
                    disabled={!canIndent}
                    title="إزاحة للداخل (Tab أو سحب لليسار)"
                    onClick={() => indentUnderPrevious(focusedRow)}
                  >
                    <IndentIcon size={19} />
                  </button>
                  <button
                    type="button"
                    className="format-action format-indent"
                    disabled={focusedRow.depth === 0}
                    title="إزاحة للخارج (Shift+Tab أو سحب لليمين)"
                    onClick={() => outdent(focusedRow)}
                  >
                    <OutdentIcon size={19} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* زر قائمة المهام — مثل زر الـ checklist عند آبل */}
          <button
            type="button"
            className={`line-tool kb-tool${focusedRow.block.kind === 'task' ? ' active-tool' : ''}`}
            aria-label={focusedRow.block.kind === 'task' ? 'إلغاء المهمة' : 'تحويل لمهمة'}
            onClick={() => convertKind(focusedRow.block)}
          >
            <TaskCircleIcon size={23} />
          </button>

          <button
            type="button"
            className="line-tool kb-tool"
            aria-label="تحديد نص عبر عدة أسطر"
            onClick={enterSelectMode}
          >
            <SelectIcon size={22} />
          </button>

          <button
            type="button"
            className="line-tool kb-tool danger"
            aria-label="حذف السطر"
            onClick={() => removeRow(focusedRow)}
          >
            <TrashIcon size={21} />
          </button>

          <span className="kb-spacer" />

          <button
            type="button"
            className="line-tool kb-tool kb-dismiss"
            aria-label="إخفاء لوحة المفاتيح"
            onClick={dismissKeyboard}
          >
            <KeyboardHideIcon size={23} />
          </button>
        </div>
      )}
    </main>
  );
}

/**
 * سطر واحد في المستند — مثل فقرة/عنصر قائمة في ملاحظات آبل.
 * النصوص العادية: بلا دائرة. المهام: دائرة تمتلئ برتقالياً عند الإكمال
 * بلا شطب للنص (سلوك آبل). السحب الأفقي على المهمة يزيحها، والضغط
 * المطول على الدائرة (أو سحبها مباشرة بالفأرة) يلتقطها لإعادة الترتيب.
 */
function PaperLine({
  row,
  isFocused,
  caretIntent,
  selectMode,
  refCb,
  onChange,
  onKeyDown,
  onPaste,
  onToggle,
  onFocus,
  onBlur,
  dragging,
  anyDragging,
  isNestTarget,
  onDragBegin,
  onDragMove,
  onDragFinish,
  onSwipeIndent,
  onSwipeOutdent,
}) {
  const { block, depth } = row;
  const isTask = block.kind === 'task';
  const bold = isBold(block.content);
  const longPressTimer = useRef(null);
  const circleDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const pressRef = useRef(null);
  const selectPointerRef = useRef(null);
  const swipeRef = useRef(null);

  // مؤقّت الضغط المطول لا يعيش أطول من السطر نفسه
  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  const displayValue = contentToHtml(block.content);
  const editorRef = useRef(null);

  // مزامنة الحالة → DOM. نعتمد على التركيز الحقيقي لا على علامة blur:
  // كروم يسقط التركيز بصمت (بلا حدث blur) عند إزالة contentEditable من
  // عنصر مركّز، فأي علامة تُدار عبر أحداث focus/blur قد تعلق قديمة.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || document.activeElement === el) return;
    const nextHtml = contentToHtml(block.content);
    if (el.innerHTML !== nextHtml) el.innerHTML = nextHtml;
    requestAnimationFrame(() => autoGrow(el));
  }, [block.id, block.content]);

  useEffect(() => {
    const el = editorRef.current;
    if (!isFocused || !el || document.activeElement === el) return;
    el.focus();
    if (caretIntent && typeof caretIntent === 'object') {
      placeCaretAtTextOffset(el, caretIntent.offset);
    } else if (caretIntent === 'start') {
      placeCaretAtStart(el);
    } else {
      placeCaretAtEnd(el);
    }
    requestAnimationFrame(() => autoGrow(el));
    // caretIntent يُقرأ وقت الانتقال للتركيز فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, block.id]);

  const setEditorRef = (el) => {
    editorRef.current = el;
    refCb(el);
    if (el && el.dataset.blockId !== block.id) {
      el.dataset.blockId = block.id;
      el.innerHTML = displayValue;
      requestAnimationFrame(() => autoGrow(el));
    }
  };

  return (
    <div
      data-block-id={block.id}
      style={depth > 0 ? { paddingInlineStart: `${Math.min(depth, 3) * 30}px` } : undefined}
      className={[
        'paper-line',
        depth > 0 ? 'sub' : '',
        isTask ? 'is-task' : '',
        isTask && block.is_completed ? 'done' : '',
        bold ? 'is-bold' : '',
        isNestTarget ? 'subtask-drop-target' : '',
        dragging ? 'dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={(e) => {
        if (selectMode || !isTask) return;
        if (e.target.closest?.('.line-circle')) return;
        swipeRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      }}
      onPointerUp={(e) => {
        const start = swipeRef.current;
        swipeRef.current = null;
        if (!start || selectMode || !isTask || anyDragging) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Date.now() - start.t > 600 || Math.abs(dy) > 28 || Math.abs(dx) < 56) return;
        // مثل سحب آبل للإزاحة — معكوس لاتجاه RTL: لليسار = للداخل
        if (dx < 0) onSwipeIndent();
        else onSwipeOutdent();
      }}
    >
      <div className="line-gutter">
        {isTask ? (
          <button
            type="button"
            className="line-circle"
            role="checkbox"
            aria-checked={block.is_completed}
            aria-label={block.is_completed ? 'إلغاء الإكمال' : 'إكمال المهمة'}
            onPointerDown={(e) => {
              if (selectMode || anyDragging) return;
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              // نلتقط العنصر والمؤشر الآن — currentTarget يصير null بعد انتهاء الحدث
              const circleEl = e.currentTarget;
              const pointerId = e.pointerId;
              circleDraggingRef.current = false;
              didDragRef.current = false;

              const startDrag = () => {
                const press = pressRef.current;
                if (!press || circleDraggingRef.current) return;
                const rowEl = circleEl.closest('.paper-line');
                const width = rowEl
                  ? rowEl.getBoundingClientRect().width - 20
                  : 260;
                const x = press.lastX ?? press.x;
                const y = press.lastY ?? press.y;
                if (!onDragBegin(block, x, y, width)) return;
                circleDraggingRef.current = true;
                didDragRef.current = true;
                try {
                  circleEl.setPointerCapture?.(pointerId);
                } catch {
                  /* المؤشر لم يعد نشطاً — نكمل السحب بدون capture */
                }
              };

              pressRef.current = {
                x: e.clientX,
                y: e.clientY,
                type: e.pointerType,
                startDrag,
              };
              clearTimeout(longPressTimer.current);
              // الفأرة تلتقط أسرع، واللمس بضغطة مطولة قصيرة — مثل آبل
              const delay = e.pointerType === 'mouse' ? 180 : 300;
              longPressTimer.current = setTimeout(startDrag, delay);
            }}
            onPointerMove={(e) => {
              if (circleDraggingRef.current) {
                onDragMove(e.clientX, e.clientY);
                return;
              }
              const press = pressRef.current;
              if (!press) return;
              press.lastX = e.clientX;
              press.lastY = e.clientY;
              // بالفأرة: تحريك ٦px يبدأ السحب فوراً دون انتظار المؤقّت
              const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
              if (press.type === 'mouse' && dist > 6) {
                clearTimeout(longPressTimer.current);
                press.startDrag();
              }
            }}
            onPointerUp={() => {
              clearTimeout(longPressTimer.current);
              pressRef.current = null;
              if (circleDraggingRef.current) {
                circleDraggingRef.current = false;
                onDragFinish(true);
              }
            }}
            onPointerCancel={() => {
              clearTimeout(longPressTimer.current);
              pressRef.current = null;
              if (circleDraggingRef.current) {
                circleDraggingRef.current = false;
                onDragFinish(false);
              }
            }}
            onClick={(e) => {
              // بعد سحبة لا تُحتسب النقرة إكمالاً للمهمة
              if (selectMode || didDragRef.current || dragging) {
                didDragRef.current = false;
                e.preventDefault();
                return;
              }
              onToggle(block);
            }}
          >
            <CheckIcon size={13} />
          </button>
        ) : (
          /* لا دائرة شبحية — الورقة نظيفة */
          <div className="line-gutter-spacer" />
        )}
      </div>
      {/* بلا tabIndex لغير المُركّز: الضغط (mousedown) كان يركّز السطر فوراً
          فيصبح contentEditable أثناء السحب ويحبس تحديد النص داخل سطر واحد */}
      <div
        ref={setEditorRef}
        className={`line-input rich-line-input${bold ? ' bold-text' : ''}`}
        contentEditable={isFocused ? true : undefined}
        suppressContentEditableWarning
        dir="rtl"
        lang="ar"
        spellCheck="true"
        role={isFocused ? 'textbox' : undefined}
        aria-multiline={isFocused ? 'true' : undefined}
        tabIndex={!selectMode && isFocused ? 0 : undefined}
        onPointerDown={(e) => {
          selectPointerRef.current = {
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const start = selectPointerRef.current;
          if (!start) return;
          const dx = Math.abs(e.clientX - start.x);
          const dy = Math.abs(e.clientY - start.y);
          if (dx > 6 || dy > 6) start.moved = true;
        }}
        onClick={() => {
          if (selectMode) return;
          if (selectPointerRef.current?.moved) {
            selectPointerRef.current = null;
            return;
          }
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selection.toString().trim()) return;
          selectPointerRef.current = null;
          onFocus(block.id);
        }}
        onInput={(e) => {
          if (!isFocused) return;
          autoGrow(e.currentTarget);
          onChange(block, sanitizeRichHtml(e.currentTarget.innerHTML));
        }}
        onPaste={(e) => {
          if (!isFocused) return;
          onPaste(e, row);
        }}
        onKeyDown={(e) => onKeyDown(e, row)}
        onFocus={(e) => {
          if (selectMode) return;
          onFocus(block.id);
          const target = e.currentTarget;
          requestAnimationFrame(() => {
            autoGrow(target);
            // 'nearest': لا تمرير إذا كان السطر ظاهراً — يبقى مكانه تحت إصبع المستخدم
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }}
        onBlur={(e) => {
          const clean = sanitizeRichHtml(e.currentTarget.innerHTML);
          if (clean !== e.currentTarget.innerHTML) e.currentTarget.innerHTML = clean;
          autoGrow(e.currentTarget);
          onChange(block, clean);
          onBlur();
        }}
      />
    </div>
  );
}
