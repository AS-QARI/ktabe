import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDayPages,
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
} from '../utils/dates';
import {
  GearIcon,
  CalendarIcon,
  TrashIcon,
  CheckIcon,
  TextIcon,
  TaskCircleIcon,
  IndentIcon,
  OutdentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BoldIcon,
} from '../components/ui/Icons';
import './screens.css';
import './DayScreen.css';

const SYNC_TABLES = ['pages', 'blocks'];
const INLINE_TEXT_SIZE_OPTIONS = [
  { value: 'sm', label: 'ص', title: 'نص صغير' },
  { value: 'md', label: 'ع', title: 'نص عادي' },
  { value: 'lg', label: 'ك', title: 'نص كبير' },
  { value: 'xl', label: 'أكبر', title: 'نص أكبر' },
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
    .replace(/<(?!\/?(?:span|strong|b|em|br|div|p)\b)[^>]+>/gi, '');
}

function contentToHtml(content) {
  if (!content) return '';
  if (isBold(content)) return `<strong>${escapeHtml(content.slice(2, -2))}</strong>`;
  if (/<\/?(?:span|strong|b|em|br|div|p|font)\b/i.test(content)) return sanitizeRichHtml(content);
  return escapeHtml(content).replace(/\n/g, '<br>');
}

function isEmptyContent(content) {
  return !content || content.replace(/<[^>]*>/g, '').replace(/&nbsp;|\u200b/g, '').trim() === '';
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectionBelongsTo(el) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return el.contains(range.commonAncestorContainer);
}

function applyInlineTextSize(el, size) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return false;

  const span = document.createElement('span');
  span.className = `rich-size-${size}`;
  if (range.collapsed) return false;

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

/** تطبيق/إزالة Bold على محتوى */
function toggleBoldContent(content) {
  if (isBold(content)) {
    return content.slice(2, -2);
  }
  return `**${content}**`;
}

/**
 * شاشة "يومي" — دفتر ورقي حديث:
 * صفحة مسطّرة لكل يوم، تكتب فيها بحرية وتضغط في أي مكان للكتابة هناك.
 * الكتابة تتمدد للأسفل تلقائياً دون الحاجة لصفحة جديدة.
 */
export default function DayScreen({ dateKey, onDateChange, onOpenSettings }) {
  const [pages, setPages] = useState(null); // null = يحمّل
  const [error, setError] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [flip, setFlip] = useState('next');
  const [localPageMeta, setLocalPageMeta] = useState(() => readLocalPageMeta(dateKey));
  const [draggingId, setDraggingId] = useState(null);
  const [dropLine, setDropLine] = useState(null);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const lastEditRef = useRef(0);
  const saveTimers = useRef(new Map());
  const pageSaveTimer = useRef(null);
  const inputRefs = useRef(new Map());
  const dateInputRef = useRef(null);
  const paperLinesRef = useRef(null);

  const markEdit = () => {
    lastEditRef.current = Date.now();
  };

  const load = useCallback(async () => {
    try {
      setPages(await getDayPages(dateKey));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [dateKey]);

  useEffect(() => {
    setPages(null);
    setFocusedId(null);
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

  // نستخدم أول صفحة فقط — الصفحة قابلة للتمرير بلا حدود
  const page = pages && pages.length > 0 ? pages[0] : null;
  const blocks = useMemo(() => page?.blocks ?? [], [page]);
  const pageMeta = {
    ...localPageMeta,
    ...(page?.title != null ? { title: page.title } : {}),
    ...(page?.text_size != null ? { text_size: page.text_size } : {}),
  };

  /** شجرة السطور مسطّحة: جذور بترتيبها ثم أبناء كل جذر */
  const rows = useMemo(() => {
    const roots = blocks
      .filter((b) => !b.parent_id)
      .sort((a, b) => a.position - b.position);
    const out = [];
    for (const r of roots) {
      out.push({ block: r, depth: 0 });
      blocks
        .filter((b) => b.parent_id === r.id)
        .sort((a, b) => a.position - b.position)
        .forEach((k) => out.push({ block: k, depth: 1 }));
    }
    return out;
  }, [blocks]);

  const visualRows = useMemo(() => {
    const roots = blocks
      .filter((b) => !b.parent_id)
      .sort((a, b) => a.position - b.position);
    const out = [];
    let line = 1;

    for (const root of roots) {
      const targetLine = Math.max(line, Math.round(root.position || line));
      while (line < targetLine) {
        out.push({ type: 'blank', key: `blank-${line}`, line });
        line += 1;
      }

      out.push({ type: 'block', key: root.id, block: root, depth: 0, line });
      line += 1;

      blocks
        .filter((b) => b.parent_id === root.id)
        .sort((a, b) => a.position - b.position)
        .forEach((child, index, children) => {
          out.push({
            type: 'block',
            key: child.id,
            block: child,
            depth: 1,
            isLastChild: index === children.length - 1,
            line,
          });
          line += 1;
        });
    }

    return out;
  }, [blocks]);

  const focusedRow = rows.find((r) => r.block.id === focusedId) ?? null;

  // تركيز السطر الجديد/التالي بعد اكتمال الرسم
  useEffect(() => {
    if (!pendingFocus) return;
    const el = inputRefs.current.get(pendingFocus);
    if (el) {
      el.focus();
      if (typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(el.value.length, el.value.length);
      } else {
        placeCaretAtEnd(el);
      }
      setPendingFocus(null);
    }
  });

  /* ================= تعديل السطور (محلي فوراً + حفظ خلفي) ================= */

  const mutate = (fn) =>
    setPages((ps) =>
      ps.map((p) => (p.id === page.id ? { ...p, blocks: fn(p.blocks) } : p))
    );

  const savePagePatch = async (patch) => {
    markEdit();
    try {
      const p = await ensurePage();
      setLocalPageMeta(writeLocalPageMeta(dateKey, patch));
      setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
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
    clearTimeout(saveTimers.current.get(block.id));
    saveTimers.current.set(
      block.id,
      setTimeout(() => {
        updateBlock(block.id, { content: value }).catch(() => {});
      }, 700)
    );
  };

  /** أول كتابة في يوم فارغ: ننشئ الصفحة (إن لزم) وسطرها الأول */
  const startWriting = async () => {
    markEdit();
    try {
      let p = page;
      if (!p) {
        const created = await createPage(dateKey, 1);
        p = { ...created, blocks: [] };
        setPages([p]);
      }
      const b = await createBlock({
        page_id: p.id,
        kind: 'text',
        content: '',
        position: 1,
      });
      setPages((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, blocks: [...x.blocks, b] } : x))
      );
      setPendingFocus(b.id);
    } catch {
      load();
    }
  };

  /** Enter: سطر جديد بعد الحالي، بنفس النوع ونفس المستوى */
  const insertAfter = async (row) => {
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
        content: '',
        position,
      });
      mutate((bs) => [...bs, b]);
      setPendingFocus(b.id);
    } catch {
      load();
    }
  };

  const ensurePage = async () => {
    if (page) return page;
    const created = await createPage(dateKey, 1);
    const nextPage = { ...created, blocks: [] };
    setPages([nextPage]);
    return nextPage;
  };

  const insertTextAtLine = async (lineNo) => {
    markEdit();
    try {
      const p = await ensurePage();
      const desiredLine = Math.max(1, Math.round(lineNo));
      const b = await createBlock({
        page_id: p.id,
        kind: 'text',
        content: '',
        position: desiredLine,
      });
      setPages((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, blocks: [...x.blocks, b] } : x))
      );
      setPendingFocus(b.id);
    } catch {
      load();
    }
  };

  const lineFromPointer = (e) => {
    const el = paperLinesRef.current;
    if (!el) return visualRows.length + 1;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const ruleH = parseFloat(style.getPropertyValue('--rule-h')) || 38;
    return Math.floor((e.clientY - rect.top + el.scrollTop) / ruleH) + 1;
  };

  const createLineFromPointer = (e) => {
    insertTextAtLine(lineFromPointer(e));
  };

  /** نقرة في مساحة الورق الفارغة: سطر نص جديد في نهاية الصفحة */
  const appendAtEnd = async () => {
    const lastLine = visualRows.at(-1)?.line ?? rows.length;
    insertTextAtLine(lastLine + 1);
  };

  const removeRow = (row) => {
    markEdit();
    const i = rows.findIndex((r) => r.block.id === row.block.id);
    const prev = rows[i - 1];
    mutate((bs) =>
      bs.filter((b) => b.id !== row.block.id && b.parent_id !== row.block.id)
    );
    deleteBlock(row.block.id).catch(() => load());
    if (prev) setPendingFocus(prev.block.id);
  };

  const toggleComplete = (block) => {
    markEdit();
    navigator.vibrate?.(10);
    const done = !block.is_completed;
    mutate((bs) =>
      bs.map((b) =>
        b.id === block.id
          ? { ...b, is_completed: done, completed_at: done ? new Date().toISOString() : null }
          : b
      )
    );
    setBlockCompleted(block.id, done).catch(() => load());
  };

  /** تحويل نص ↔ مهمة */
  const convertKind = (block) => {
    markEdit();
    const patch =
      block.kind === 'text'
        ? { kind: 'task' }
        : { kind: 'text', is_completed: false, completed_at: null };
    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, ...patch } : b)));
    updateBlock(block.id, patch).catch(() => load());
  };

  /** تبديل الخط العريض */
  const toggleBoldBlock = (block) => {
    markEdit();
    const newContent = toggleBoldContent(block.content);
    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, content: newContent } : b)));
    clearTimeout(saveTimers.current.get(block.id));
    saveTimers.current.set(
      block.id,
      setTimeout(() => {
        updateBlock(block.id, { content: newContent }).catch(() => {});
      }, 700)
    );
  };

  const canAddSubtask =
    focusedRow && focusedRow.depth === 0 && focusedRow.block.kind === 'task';

  const createSubtask = async (row) => {
    const { block } = row;
    if (block.kind !== 'task') return;
    const kids = blocks
      .filter((b) => b.parent_id === block.id)
      .sort((a, b) => a.position - b.position);
    const position = kids.length ? Math.max(...kids.map((k) => k.position)) + 1 : 1;
    markEdit();
    try {
      const child = await createBlock({
        page_id: page.id,
        parent_id: block.id,
        kind: 'task',
        content: '',
        position,
      });
      mutate((bs) => [...bs, child]);
      setPendingFocus(child.id);
    } catch {
      load();
    }
  };

  const outdent = (row) => {
    const { block } = row;
    const parent = blocks.find((b) => b.id === block.parent_id);
    if (!parent) return;
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
    setPendingFocus(block.id);
  };

  const moveTaskToLine = (blockId, lineNo) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || block.kind !== 'task') return;

    const desiredLine = Math.max(1, Math.round(lineNo));
    const shiftedRoots = blocks
      .filter((b) => !b.parent_id && b.id !== blockId)
      .map((b) => {
        const line = Math.max(1, Math.round(b.position || 1));
        return line >= desiredLine ? { ...b, position: line + 1 } : { ...b, position: line };
      });
    const shiftedById = new Map(shiftedRoots.map((b) => [b.id, b.position]));
    const patch = { parent_id: null, position: desiredLine, kind: 'task' };

    markEdit();
    mutate((bs) =>
      bs.map((b) => {
        if (b.id === blockId) return { ...b, ...patch };
        if (shiftedById.has(b.id)) return { ...b, position: shiftedById.get(b.id) };
        return b;
      })
    );
    updateBlock(blockId, patch).catch(() => load());
    shiftedRoots.forEach((b) => {
      updateBlock(b.id, { position: b.position }).catch(() => load());
    });
    setPendingFocus(blockId);
  };

  const beginCircleDrag = (blockId) => {
    navigator.vibrate?.(18);
    setDraggingId(blockId);
    setDropLine(null);
  };

  const dragOverPoint = (x, y) => {
    if (!draggingId) return;
    const el = document.elementFromPoint(x, y);
    const line = el?.closest?.('.paper-line[data-block-id]');
    const lineNo = line?.dataset?.line
      ? Number(line.dataset.line)
      : lineFromPointer({ clientY: y });
    setDropLine(lineNo);
  };

  const finishCircleDrag = () => {
    if (draggingId && dropLine) moveTaskToLine(draggingId, dropLine);
    finishDrag();
  };

  const finishDrag = () => {
    setDraggingId(null);
    setDropLine(null);
  };

  const onKeyDown = (e, row) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertAfter(row);
    } else if (e.key === 'Backspace' && isEmptyContent(row.block.content) && rows.length > 1) {
      e.preventDefault();
      removeRow(row);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      applyBoldToFocusedSelection(row.block);
    }
  };

  const saveFocusedEditor = (block) => {
    const el = inputRefs.current.get(block.id);
    if (!el) return;
    editContent(block, el.innerHTML);
  };

  const applyBoldToFocusedSelection = (block) => {
    const el = inputRefs.current.get(block.id);
    if (!el) return;
    el.focus();
    if (!selectionBelongsTo(el)) placeCaretAtEnd(el);
    document.execCommand('bold', false, null);
    saveFocusedEditor(block);
  };

  const applySizeToFocusedSelection = (block, size) => {
    const el = inputRefs.current.get(block.id);
    if (!el) return;
    el.focus();
    if (!selectionBelongsTo(el)) placeCaretAtEnd(el);
    if (applyInlineTextSize(el, size)) {
      saveFocusedEditor(block);
    }
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

      <div className="book">
        <div
          key={`${dateKey}-${page?.id ?? 'blank'}`}
          className={`paper flip-${flip}`}
        >
          {/* رأس الورقة */}
          <header className="paper-head">
            <button
              type="button"
              className="page-turn"
              aria-label="اليوم السابق"
              onClick={() => goDay(-1)}
            >
              <ChevronRightIcon size={22} />
            </button>
            <div className="paper-date">
              <span className="paper-weekday">{formatWeekday(d)}</span>
              <span className="paper-daynum">{formatDateWithYear(d)}</span>
              <input
                className="day-title-input"
                value={pageMeta.title ?? ''}
                placeholder="عنوان اليوم"
                onChange={(e) => savePagePatch({ title: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="page-turn"
              aria-label="اليوم التالي"
              onClick={() => goDay(1)}
            >
              <ChevronLeftIcon size={22} />
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

          {pages !== null && !error && (
            <div
              className="paper-lines"
              ref={paperLinesRef}
              onClick={(e) => {
                if (e.target === paperLinesRef.current) createLineFromPointer(e);
              }}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                setDropLine(lineFromPointer(e));
              }}
              onDrop={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                moveTaskToLine(draggingId, lineFromPointer(e));
                finishDrag();
              }}
            >
              {rows.length === 0 ? (
                <button type="button" className="paper-starter" onClick={createLineFromPointer}>
                  اضغط هنا وابدأ الكتابة…
                </button>
              ) : (
                visualRows.map((item) =>
                  item.type === 'blank' ? (
                    <button
                      key={item.key}
                      type="button"
                      className={`paper-blank-line${dropLine === item.line ? ' drop-target' : ''}`}
                      aria-label="سطر فارغ للكتابة"
                      onClick={() => insertTextAtLine(item.line)}
                      onDragOver={(e) => {
                        if (!draggingId) return;
                        e.preventDefault();
                        setDropLine(item.line);
                      }}
                      onDrop={(e) => {
                        if (!draggingId) return;
                        e.preventDefault();
                        moveTaskToLine(draggingId, item.line);
                        finishDrag();
                      }}
                    />
                  ) : (
                    <PaperLine
                      key={item.block.id}
                      row={item}
                      isFocused={focusedId === item.block.id}
                      refCb={(el) => {
                        if (el) {
                          inputRefs.current.set(item.block.id, el);
                          autoGrow(el);
                        } else {
                          inputRefs.current.delete(item.block.id);
                        }
                      }}
                      onChange={editContent}
                      onKeyDown={onKeyDown}
                      onToggle={toggleComplete}
                      onConvert={convertKind}
                      onFocus={setFocusedId}
                      onBlur={() =>
                        setTimeout(
                          () => setFocusedId((f) => (f === item.block.id ? null : f)),
                          150
                        )
                      }
                      draggingId={draggingId}
                      dropLine={dropLine}
                      onDragStart={(id) => {
                        setDraggingId(id);
                        setDropLine(null);
                      }}
                      onDragEnd={finishDrag}
                      onDropOnLine={(lineNo) => {
                        if (draggingId) moveTaskToLine(draggingId, lineNo);
                      }}
                      onDropLine={setDropLine}
                      onCircleDragStart={beginCircleDrag}
                      onCircleDragMove={dragOverPoint}
                      onCircleDragEnd={finishCircleDrag}
                    />
                  )
                )
              )}
              <button
                type="button"
                className={`paper-tail${dropLine && dropLine > (visualRows.at(-1)?.line ?? 0) ? ' drop-target' : ''}`}
                aria-label="سطر جديد في نهاية الصفحة"
                onClick={createLineFromPointer}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  setDropLine(lineFromPointer(e));
                }}
                onDrop={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  moveTaskToLine(draggingId, lineFromPointer(e));
                  finishDrag();
                }}
              />
            </div>
          )}

          {/* ذيل الورقة خفيف بدون صفحات متعددة */}
          <footer className="paper-foot" />
        </div>
      </div>

      {/* شريط أدوات السطر المُركّز */}
      {focusedRow && (
        <div className="line-toolbar" onPointerDown={(e) => e.preventDefault()}>
          <button
            type="button"
            className="line-tool"
            onClick={() => convertKind(focusedRow.block)}
          >
            {focusedRow.block.kind === 'task' ? (
              <><TextIcon size={19} /> نص</>
            ) : (
              <><TaskCircleIcon size={19} /> مهمة</>
            )}
          </button>

          <button
            type="button"
            className="line-tool"
            onClick={() => applyBoldToFocusedSelection(focusedRow.block)}
            title="خط عريض (Ctrl+B)"
          >
            <BoldIcon size={19} /> عريض
          </button>

          <div className="line-size-menu">
            <button
              type="button"
              className={`line-tool size-menu-trigger${sizeMenuOpen ? ' active-tool' : ''}`}
              aria-haspopup="menu"
              aria-expanded={sizeMenuOpen}
              onClick={() => setSizeMenuOpen((open) => !open)}
            >
              الحجم
            </button>
            {sizeMenuOpen && (
              <div className="line-size-popover" role="menu">
                {INLINE_TEXT_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="line-size-tool"
                    role="menuitem"
                    title={option.title}
                    onClick={() => {
                      applySizeToFocusedSelection(focusedRow.block, option.value);
                      setSizeMenuOpen(false);
                    }}
                  >
                    {option.title.replace('نص ', '')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {focusedRow.depth === 0 ? (
            <button
              type="button"
              className="line-tool"
              disabled={!canAddSubtask}
              onClick={() => createSubtask(focusedRow)}
            >
              <IndentIcon size={19} /> فرعي
            </button>
          ) : (
            <button
              type="button"
              className="line-tool"
              onClick={() => outdent(focusedRow)}
            >
              <OutdentIcon size={19} /> رئيسي
            </button>
          )}

          <button
            type="button"
            className="line-tool danger"
            onClick={() => removeRow(focusedRow)}
          >
            <TrashIcon size={19} /> حذف
          </button>
        </div>
      )}
    </main>
  );
}

/**
 * سطر واحد على الورقة.
 * النصوص العادية: بلا دائرة على الإطلاق — نظيف كورقة حقيقية.
 * المهام: دائرة التأشير فقط عند جانب السطر.
 * النص العريض: يُخفى ** عند عدم التركيز ويُعرض بخط ثقيل.
 */
function PaperLine({ row, isFocused, refCb, onChange, onKeyDown, onToggle, onConvert, onFocus, onBlur, draggingId, dropLine, onDragStart, onDragEnd, onDropOnLine, onDropLine, onCircleDragStart, onCircleDragMove, onCircleDragEnd }) {
  const { block, depth } = row;
  const isTask = block.kind === 'task';
  const bold = isBold(block.content);
  const isDropTarget = dropLine === row.line && draggingId !== block.id;
  const longPressTimer = useRef(null);
  const circleDraggingRef = useRef(false);

  const displayValue = contentToHtml(block.content);
  const editorRef = useRef(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || focusedRef.current) return;
    const nextHtml = contentToHtml(block.content);
    if (el.innerHTML !== nextHtml) el.innerHTML = nextHtml;
    requestAnimationFrame(() => autoGrow(el));
  }, [block.id, block.content]);

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
      data-line={row.line}
      className={[
        'paper-line',
        depth > 0 ? 'sub' : '',
        row.isLastChild ? 'last-sub' : '',
        isTask ? 'is-task' : '',
        isTask && block.is_completed ? 'done' : '',
        bold ? 'is-bold' : '',
        isDropTarget ? 'drop-target' : '',
        draggingId === block.id ? 'dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={(e) => {
        if (!draggingId || draggingId === block.id) return;
        e.preventDefault();
        onDropLine(row.line);
      }}
      onDragLeave={() => {
        if (isDropTarget) onDropLine(null);
      }}
      onDrop={(e) => {
        if (!draggingId || draggingId === block.id) return;
        e.preventDefault();
        onDropOnLine(row.line);
        onDragEnd();
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
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', block.id);
              onDragStart(block.id);
            }}
            onDragEnd={onDragEnd}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              // نلتقط العنصر والمؤشر الآن — currentTarget يصير null بعد انتهاء الحدث
              const circleEl = e.currentTarget;
              const pointerId = e.pointerId;
              circleDraggingRef.current = false;
              clearTimeout(longPressTimer.current);
              longPressTimer.current = setTimeout(() => {
                circleDraggingRef.current = true;
                try {
                  circleEl.setPointerCapture?.(pointerId);
                } catch {
                  /* المؤشر لم يعد نشطاً — نكمل السحب بدون capture */
                }
                onCircleDragStart(block.id);
              }, 360);
            }}
            onPointerMove={(e) => {
              if (circleDraggingRef.current) onCircleDragMove(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              clearTimeout(longPressTimer.current);
              if (circleDraggingRef.current) {
                circleDraggingRef.current = false;
                onCircleDragEnd();
              }
            }}
            onPointerCancel={() => {
              clearTimeout(longPressTimer.current);
              if (circleDraggingRef.current) {
                circleDraggingRef.current = false;
                onDragEnd();
              }
            }}
            onClick={(e) => {
              if (circleDraggingRef.current || draggingId === block.id) {
                e.preventDefault();
                return;
              }
              onToggle(block);
            }}
          >
            <CheckIcon size={12} />
          </button>
        ) : (
          /* لا دائرة شبحية — الورقة نظيفة */
          <div className="line-gutter-spacer" />
        )}
      </div>
      <div
        ref={setEditorRef}
        className={`line-input rich-line-input${bold ? ' bold-text' : ''}`}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={isTask ? 'مهمة…' : ''}
        dir="rtl"
        lang="ar"
        spellCheck="true"
        role="textbox"
        aria-multiline="true"
        onInput={(e) => {
          autoGrow(e.currentTarget);
          onChange(block, sanitizeRichHtml(e.currentTarget.innerHTML));
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          requestAnimationFrame(() => autoGrow(e.currentTarget));
        }}
        onKeyDown={(e) => onKeyDown(e, row)}
        onFocus={(e) => {
          focusedRef.current = true;
          onFocus(block.id);
          const target = e.currentTarget;
          requestAnimationFrame(() => {
            autoGrow(target);
            // 'nearest': لا تمرير إذا كان السطر ظاهراً — يبقى مكانه تحت إصبع المستخدم
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }}
        onBlur={(e) => {
          focusedRef.current = false;
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


































