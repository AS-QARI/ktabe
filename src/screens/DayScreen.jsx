import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDayPages,
  createPage,
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
  PlusIcon,
  TrashIcon,
  CheckIcon,
  TextIcon,
  TaskCircleIcon,
  IndentIcon,
  OutdentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../components/ui/Icons';
import './screens.css';
import './DayScreen.css';

const SYNC_TABLES = ['pages', 'blocks'];

/** يمدد ارتفاع السطر مع التفاف النص — فيبقى النص جالساً على التسطير */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * شاشة "يومي" — دفتر ورقي:
 * صفحة مسطّرة بالأحمر لكل يوم، تكتب فيها بحرية سطراً تحت سطر،
 * وأي سطر يتحول لمهمة بدائرة، وتحت المهمة سطور فرعية (مهام جانبية
 * أو تعليقات). الأسهم تقلب الصفحة كالكتاب لليوم السابق/التالي،
 * واليوم الواحد يحتمل أكثر من صفحة.
 */
export default function DayScreen({ dateKey, onDateChange, onOpenSettings }) {
  const [pages, setPages] = useState(null); // null = يحمّل
  const [error, setError] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [focusedId, setFocusedId] = useState(null);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [flip, setFlip] = useState('next'); // اتجاه حركة قلب الصفحة القادمة

  const lastEditRef = useRef(0); // حارس: لا يدع التزامن يمسح ما يُكتب الآن
  const saveTimers = useRef(new Map());
  const inputRefs = useRef(new Map());
  const dateInputRef = useRef(null);

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
    setPageIndex(0);
    setFocusedId(null);
    load();
  }, [load]);

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

  const page =
    pages && pages.length > 0 ? pages[Math.min(pageIndex, pages.length - 1)] : null;
  const blocks = useMemo(() => page?.blocks ?? [], [page]);

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

  const focusedRow = rows.find((r) => r.block.id === focusedId) ?? null;

  // تركيز السطر الجديد/التالي بعد اكتمال الرسم
  useEffect(() => {
    if (!pendingFocus) return;
    const el = inputRefs.current.get(pendingFocus);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      setPendingFocus(null);
    }
  });

  /* ================= تعديل السطور (محلي فوراً + حفظ خلفي) ================= */

  const mutate = (fn) =>
    setPages((ps) =>
      ps.map((p) => (p.id === page.id ? { ...p, blocks: fn(p.blocks) } : p))
    );

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

  /** أول كتابة في يوم/صفحة فارغة: ننشئ الصفحة (إن لزم) وسطرها الأول */
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

  /** Enter: سطر جديد بعد الحالي، بنفس النوع ونفس المستوى (كسلوك القوائم) */
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

  /** نقرة أسفل السطور: سطر نص رئيسي جديد في نهاية الصفحة */
  const appendAtEnd = async () => {
    if (rows.length === 0) {
      startWriting();
      return;
    }
    const last = rows[rows.length - 1];
    if (last.depth === 0 && last.block.content === '') {
      setPendingFocus(last.block.id);
      return;
    }
    markEdit();
    const roots = blocks.filter((b) => !b.parent_id);
    const position = Math.max(...roots.map((r) => r.position), 0) + 1;
    try {
      const b = await createBlock({
        page_id: page.id,
        kind: 'text',
        content: '',
        position,
      });
      mutate((bs) => [...bs, b]);
      setPendingFocus(b.id);
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

  /** تحويل نص ↔ مهمة (التحويل لنص يمسح حالة الإكمال) */
  const convertKind = (block) => {
    markEdit();
    const patch =
      block.kind === 'text'
        ? { kind: 'task' }
        : { kind: 'text', is_completed: false, completed_at: null };
    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, ...patch } : b)));
    updateBlock(block.id, patch).catch(() => load());
  };

  const canIndent =
    focusedRow &&
    focusedRow.depth === 0 &&
    !blocks.some((b) => b.parent_id === focusedRow.block.id) &&
    blocks.filter((b) => !b.parent_id).sort((a, b) => a.position - b.position)[0]?.id !==
      focusedRow.block.id;

  /** إزاحة السطر ليصبح فرعياً تحت السطر الرئيسي الذي قبله */
  const indent = (row) => {
    const { block } = row;
    const roots = blocks
      .filter((b) => !b.parent_id)
      .sort((a, b) => a.position - b.position);
    const idx = roots.findIndex((b) => b.id === block.id);
    if (idx <= 0) return;
    const parent = roots[idx - 1];
    const kids = blocks.filter((b) => b.parent_id === parent.id);
    const position = kids.length ? Math.max(...kids.map((k) => k.position)) + 1 : 1;
    markEdit();
    const patch = { parent_id: parent.id, position };
    mutate((bs) => bs.map((b) => (b.id === block.id ? { ...b, ...patch } : b)));
    updateBlock(block.id, patch).catch(() => load());
    setPendingFocus(block.id);
  };

  /** إعادة سطر فرعي لمستوى رئيسي (يوضع بعد أبيه مباشرة) */
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

  const onKeyDown = (e, row) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertAfter(row);
    } else if (e.key === 'Backspace' && row.block.content === '' && rows.length > 1) {
      e.preventDefault();
      removeRow(row);
    }
  };

  /* ================= التنقل بين الأيام والصفحات ================= */

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

  const addPage = async () => {
    markEdit();
    try {
      const no = (pages[pages.length - 1]?.page_no ?? 0) + 1;
      const p = await createPage(dateKey, no);
      setFlip('next');
      setPages((ps) => [...ps, { ...p, blocks: [] }]);
      setPageIndex(pages.length);
    } catch {
      load();
    }
  };

  const d = parseDateKey(dateKey);
  const isToday = dateKey === todayKey();

  return (
    <main className="screen day-screen">
      {/* شريط علوي نحيف: منتقي التاريخ يميناً، والإعدادات يساراً كباقي الشاشات */}
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
          {/* رأس الورقة: اليوم والتاريخ، وعن يمينه ويساره سهما قلب الصفحة */}
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
            <div className="paper-lines">
              {rows.length === 0 ? (
                <button type="button" className="paper-starter" onClick={startWriting}>
                  اضغط هنا وابدأ الكتابة…
                </button>
              ) : (
                rows.map((row) => (
                  <PaperLine
                    key={row.block.id}
                    row={row}
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
                    onToggle={toggleComplete}
                    onConvert={convertKind}
                    onFocus={setFocusedId}
                    onBlur={() =>
                      setTimeout(
                        () => setFocusedId((f) => (f === row.block.id ? null : f)),
                        150
                      )
                    }
                  />
                ))
              )}
              {rows.length > 0 && (
                <button
                  type="button"
                  className="paper-tail"
                  aria-label="سطر جديد في نهاية الصفحة"
                  onClick={appendAtEnd}
                />
              )}
            </div>
          )}

          {/* ذيل الورقة: نقاط صفحات اليوم + إضافة صفحة */}
          <footer className="paper-foot">
            {pages && pages.length > 1 && (
              <div className="page-dots" role="tablist" aria-label="صفحات اليوم">
                {pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`page-dot${i === pageIndex ? ' active' : ''}`}
                    aria-label={`صفحة ${p.page_no}`}
                    onClick={() => {
                      setFlip(i < pageIndex ? 'prev' : 'next');
                      setPageIndex(i);
                    }}
                  />
                ))}
              </div>
            )}
            {pages && pages.length > 1 && (
              <span className="page-no">
                صفحة {pageIndex + 1} من {pages.length}
              </span>
            )}
            <button type="button" className="btn-text add-page" onClick={addPage}>
              <PlusIcon size={16} />
              صفحة جديدة
            </button>
          </footer>
        </div>
      </div>

      {/* شريط أدوات السطر المُركّز — يطفو فوق شريط التنقل قرب الإبهام */}
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
          {focusedRow.depth === 0 ? (
            <button
              type="button"
              className="line-tool"
              disabled={!canIndent}
              onClick={() => indent(focusedRow)}
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

/** سطر واحد على الورقة: هامش (دائرة مهمة أو نقطة تحويل) + نص يجلس على التسطير */
function PaperLine({ row, refCb, onChange, onKeyDown, onToggle, onConvert, onFocus, onBlur }) {
  const { block, depth } = row;
  const isTask = block.kind === 'task';

  return (
    <div
      className={[
        'paper-line',
        depth > 0 ? 'sub' : '',
        isTask ? 'is-task' : '',
        isTask && block.is_completed ? 'done' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="line-gutter">
        {isTask ? (
          <button
            type="button"
            className="line-circle"
            role="checkbox"
            aria-checked={block.is_completed}
            aria-label={block.is_completed ? 'إلغاء الإكمال' : 'إكمال المهمة'}
            onClick={() => onToggle(block)}
          >
            <CheckIcon size={12} />
          </button>
        ) : (
          /* دائرة شبح: تظهر عند التركيز/المرور — نقرة تحوّل السطر لمهمة */
          <button
            type="button"
            className="line-circle ghost"
            aria-label="تحويل السطر لمهمة"
            tabIndex={-1}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onConvert(block)}
          >
            <CheckIcon size={12} />
          </button>
        )}
      </div>
      <textarea
        ref={refCb}
        className="line-input"
        value={block.content}
        rows={1}
        placeholder={isTask ? 'مهمة…' : ''}
        onChange={(e) => {
          autoGrow(e.target);
          onChange(block, e.target.value);
        }}
        onKeyDown={(e) => onKeyDown(e, row)}
        onFocus={() => onFocus(block.id)}
        onBlur={onBlur}
      />
    </div>
  );
}
