import { useEffect, useMemo, useRef, useState } from 'react';
import TaskDetails from './TaskDetails';
import { CheckIcon, PlusIcon, PinIcon, ChevronLeftIcon, NoteIcon } from '../ui/Icons';
import './DayTasks.css';

const DAILY_PHRASES = [
  { title: 'يوم جديد', text: 'اكتب أول مهمة، ودع الوضوح يقود يومك.' },
  { title: 'اكتبها لتبدأ', text: 'المهمة المكتوبة أخف من الفكرة التي تدور في رأسك.' },
  { title: 'خطوة صغيرة تكفي', text: 'لا تنتظر الوقت المثالي؛ ابدأ بما تستطيع الآن.' },
  { title: 'رتّب يومك بهدوء', text: 'كل مهمة تكتبها تمنحك مساحة أكبر للتركيز.' },
  { title: 'أنجز واحدة الآن', text: 'الإنجاز الكبير يبدأ بمهمة واضحة وصغيرة.' },
  { title: 'أفكارك تستحق صفحة', text: 'اكتب ما يشغلك، ثم حوّله إلى خطوة قابلة للإنجاز.' },
  { title: 'أنت في المسار', text: 'التقدم لا يحتاج سرعة؛ يحتاج استمرارًا.' },
  { title: 'خفّفها بالكتابة', text: 'حين تكتب المهمة، يصبح الطريق إليها أوضح.' },
  { title: 'ركّز على التالي', text: 'لا تحمل اليوم كله؛ اختر الخطوة القادمة فقط.' },
  { title: 'إنجازك يتراكم', text: 'مهمة بعد مهمة، تبني يومًا تفتخر به.' },
  { title: 'ابدأ من هنا', text: 'اكتب الشيء الأهم، وامنحه انتباهك الكامل.' },
  { title: 'الوضوح قوة', text: 'قائمة بسيطة اليوم قد تغيّر أسبوعك كله.' },
  { title: 'اترك أثرًا اليوم', text: 'أنجز شيئًا واحدًا يجعل الغد أسهل.' },
  { title: 'لا تؤجل البداية', text: 'افتح مهمتك الأولى، وخذ منها دقيقة واحدة.' },
  { title: 'كل سطر تقدّم', text: 'اكتب، نفّذ، ثم احتفل بالخطوة التي قطعتها.' },
  { title: 'يومك بين يديك', text: 'رتّب أولوياتك واترك الباقي لوقته.' },
  { title: 'المهم أن تستمر', text: 'حتى الخطوة الهادئة تقرّبك من هدفك.' },
  { title: 'حوّل النية إلى فعل', text: 'اكتب المهمة بصيغة واضحة وابدأ بها.' },
  { title: 'مساحة جديدة', text: 'املأ يومك بما يهمك، مهمة واحدة في كل مرة.' },
  { title: 'أحسنت لأنك بدأت', text: 'استمرارك في الكتابة هو بداية إنجازك.' },
];

function dailyPhrase() {
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return DAILY_PHRASES[((dayNumber % DAILY_PHRASES.length) + DAILY_PHRASES.length) % DAILY_PHRASES.length];
}

function taskOrder(task) {
  return Number(task.task_order ?? task.position ?? 0);
}

function TaskRow({ task, overdue = false, dragging, onToggle, onRename, onDetails, onDragStart, onDragMove, onDragEnd, onKeyboardMove }) {
  const [draft, setDraft] = useState(task.text);
  const status = task.status === 'postponed' ? 'pending' : (task.status || 'pending');
  const done = status === 'done' || task.is_completed;
  const hasDescription = Boolean(task.description?.trim());

  useEffect(() => setDraft(task.text), [task.text]);

  const commit = () => {
    const next = draft.trim();
    if (!next) {
      setDraft(task.text);
      return;
    }
    if (next !== task.text) onRename(task, next);
  };

  const nextLabel = status === 'pending'
    ? 'بدء العمل على'
    : status === 'in_progress'
      ? 'إكمال'
      : 'إعادة فتح';

  return (
    <div
      data-task-id={task.id}
      className={[
        'day-task-row',
        `is-${status}`,
        overdue ? 'is-overdue' : '',
        dragging ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="day-task-check"
        aria-label={task.is_pinned ? `تحديث تقدم ${task.text}` : `${nextLabel} ${task.text}`}
        aria-pressed={done}
        onClick={() => task.is_pinned ? onDetails(task) : onToggle(task)}
      >
        {status === 'in_progress' && <span className="day-task-working-dot" />}
        {done && <CheckIcon size={14} />}
      </button>

      <div className="day-task-copy">
        <input
          value={draft}
          aria-label="اسم المهمة"
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => {
            const input = event.currentTarget;
            requestAnimationFrame(() => input.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(task.text);
              event.currentTarget.blur();
            }
          }}
        />
        {status === 'in_progress' && <span className="day-task-status">شغال عليها</span>}
        {done && <span className="day-task-status done-label">مكتملة</span>}
        {task.is_pinned && <div className="goal-progress"><progress max="100" value={task.is_completed ? 100 : (task.progress || 0)} aria-label={`تقدم ${task.text}`} /><span>{task.is_completed ? 100 : (task.progress || 0)}%</span></div>}
      </div>

      <button
        type="button"
        className={`day-task-details-btn${hasDescription ? ' has-description' : ''}`}
        aria-label={hasDescription ? `عرض وصف ${task.text}` : `تفاصيل ${task.text}`}
        title={hasDescription ? 'هذه المهمة لها وصف — اضغط لعرضه' : 'تفاصيل المهمة'}
        onClick={() => onDetails(task)}
      >
        {hasDescription ? <NoteIcon size={18} aria-hidden="true" /> : 'تفاصيل'}
      </button>
      <button
        type="button"
        className="day-task-drag-handle"
        aria-label={`اسحب لترتيب ${task.text}`}
        onPointerDown={(event) => onDragStart(event, task.id)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            onKeyboardMove(task.id, event.key === 'ArrowUp' ? -1 : 1);
          }
        }}
      >
        <i /><i /><i />
      </button>
    </div>
  );
}

function ReorderableTaskList({ tasks, overdue = false, onToggle, onRename, onReorder, onDelete, onMoveToToday, onDetails }) {
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => taskOrder(a) - taskOrder(b) || new Date(a.created_at || 0) - new Date(b.created_at || 0)),
    [tasks]
  );
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const [order, setOrder] = useState(() => sortedTasks.map((task) => task.id));
  const [draggingId, setDraggingId] = useState(null);
  const [trashActive, setTrashActive] = useState(false);
  const draggingIdRef = useRef(null);
  const orderRef = useRef(order);
  const dragHandleRef = useRef(null);
  const dragMovedRef = useRef(false);
  const moveToTodayRef = useRef(false);
  const persistTimerRef = useRef(null);

  useEffect(() => {
    const ids = sortedTasks.map((task) => task.id);
    orderRef.current = ids;
    setOrder(ids);
  }, [sortedTasks]);

  useEffect(() => () => clearTimeout(persistTimerRef.current), []);

  const applyOrder = (ids, persist = false) => {
    orderRef.current = ids;
    setOrder(ids);
    if (persist) onReorder(ids);
  };

  const moveTask = (sourceId, targetId, afterTarget = false) => {
    const current = orderRef.current;
    const from = current.indexOf(sourceId);
    const target = current.indexOf(targetId);
    if (from < 0 || target < 0 || sourceId === targetId) return;
    const next = current.filter((id) => id !== sourceId);
    let insertAt = next.indexOf(targetId) + (afterTarget ? 1 : 0);
    insertAt = Math.max(0, Math.min(insertAt, next.length));
    next.splice(insertAt, 0, sourceId);
    dragMovedRef.current = true;
    applyOrder(next);
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => onReorder(orderRef.current), 140);
  };

  const startDrag = (event, taskId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    dragHandleRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingIdRef.current = taskId;
    dragMovedRef.current = false;
    setDraggingId(taskId);
    navigator.vibrate?.(10);
  };

  const dragMove = (event) => {
    const activeId = draggingIdRef.current;
    if (!activeId) return;
    event.preventDefault();
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const overTrash = Boolean(hit?.closest?.('.day-task-trash'));
    const overToday = Boolean(overdue && hit?.closest?.('.today-group'));
    setTrashActive(overTrash);
    moveToTodayRef.current = overToday;
    if (overTrash || overToday) return;
    const targetRow = hit?.closest?.('.day-task-row');
    const targetId = targetRow?.dataset.taskId;
    if (!targetId || !orderRef.current.includes(targetId) || targetId === activeId) return;
    const rect = targetRow.getBoundingClientRect();
    moveTask(activeId, targetId, event.clientY > rect.top + rect.height / 2);
  };

  const endDrag = (event) => {
    if (!draggingIdRef.current) return;
    const releasedId = draggingIdRef.current;
    try { dragHandleRef.current?.releasePointerCapture?.(event.pointerId); } catch { /* انتهى المؤشر */ }
    setDraggingId(null);
    const shouldDelete = trashActive;
    const shouldMoveToday = moveToTodayRef.current;
    setTrashActive(false);
    moveToTodayRef.current = false;
    draggingIdRef.current = null;
    dragHandleRef.current = null;
    clearTimeout(persistTimerRef.current);
    if (dragMovedRef.current) onReorder(orderRef.current);
    dragMovedRef.current = false;
    if (shouldDelete && onDelete) onDelete(releasedId);
    else if (shouldMoveToday && onMoveToToday) onMoveToToday(releasedId);
    navigator.vibrate?.(8);
  };

  const keyboardMove = (taskId, direction) => {
    const current = orderRef.current;
    const from = current.indexOf(taskId);
    const to = Math.max(0, Math.min(from + direction, current.length - 1));
    if (from === to) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, taskId);
    applyOrder(next, true);
    navigator.vibrate?.(5);
  };

  return order.map((id) => {
    const task = taskMap.get(id);
    if (!task) return null;
    return (
      <div key={task.id} className="day-task-drag-wrap">
      <TaskRow
        task={task}
        overdue={overdue}
        dragging={draggingId === task.id}
        onToggle={onToggle}
        onRename={onRename}
        onDetails={onDetails}
        onDragStart={startDrag}
        onDragMove={dragMove}
        onDragEnd={endDrag}
        onKeyboardMove={keyboardMove}
      />
      {draggingId === task.id && <div className={`day-task-trash${trashActive ? ' active' : ''}`}><span>🗑</span><small>اسحب هنا للحذف</small></div>}
      </div>
    );
  });
}

export default function DayTasks({ tasks, overdueTasks, pinnedTasks, onAdd, onToggle, onRename, onReorder, onDelete, onMoveToToday, onSaveDetails }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);
  const visibleGoals = pinnedTasks.filter((task) => showCompletedGoals || !task.is_completed);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [showOverdue, setShowOverdue] = useState(true);
  const [remainingOnly, setRemainingOnly] = useState(false);
  const visibleTasks = remainingOnly ? tasks.filter((task) => !(task.status === 'done' || task.is_completed)) : tasks;
  const encouragement = dailyPhrase();

  const submit = async (event) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || adding) return;
    setAdding(true);
    const created = await onAdd(value);
    if (created) setDraft('');
    setAdding(false);
  };

  return (
    <section className="day-tasks" aria-label="مهمات اليوم">
      <div className="day-task-list">
        <p className="day-task-encouragement" role="status" aria-atomic="true">
          <strong>{encouragement.title}</strong>
          <span>{encouragement.text}</span>
        </p>
        <section className="day-task-group goal-group" aria-label="أهدافي المثبتة">
          <button type="button" className="goal-toggle" aria-expanded={goalsOpen} aria-controls="pinned-goals-content" onClick={() => setGoalsOpen((open) => !open)}>
            <PinIcon size={15} /><strong>أهدافي المثبّتة</strong>
            <span className="goal-count">{pinnedTasks.filter((task) => !task.is_completed).length}</span>
            <ChevronLeftIcon size={16} className={goalsOpen ? 'goal-chevron is-open' : 'goal-chevron'} />
          </button>
          <div id="pinned-goals-content" hidden={!goalsOpen}>
            {pinnedTasks.some((task) => task.is_completed) && <button type="button" className="day-task-filter-btn goal-completed-filter" onClick={() => setShowCompletedGoals((value) => !value)}>{showCompletedGoals ? 'إخفاء المكتملة' : 'عرض المكتملة'}</button>}
            {!visibleGoals.length && <p className="goal-empty">{pinnedTasks.length ? 'أنجزت أهدافك المثبّتة. بداية جديدة تنتظرك.' : 'عندك هدف كبير؟ افتح «تفاصيل» أي مهمة وثبّتها هنا.'}</p>}
            {goalsOpen && <ReorderableTaskList tasks={visibleGoals} onToggle={onToggle} onRename={onRename} onReorder={onReorder} onDelete={onDelete} onDetails={setSelectedTask} />}
          </div>
        </section>
        {overdueTasks.length > 0 && (
          <section className="day-task-group overdue-group" aria-label="المهمات المتأخرة">
            <header className="day-task-group-head">
              <strong>متأخرة</strong>
              <span>{overdueTasks.length}</span>
              <button type="button" className="day-task-filter-btn" onClick={() => setShowOverdue((open) => !open)}>{showOverdue ? 'إخفاء' : 'إظهار'}</button>
            </header>
            {showOverdue && <ReorderableTaskList
              tasks={overdueTasks}
              overdue
              onToggle={onToggle}
              onRename={onRename}
              onDetails={setSelectedTask}
              onReorder={onReorder}
              onDelete={onDelete}
              onMoveToToday={onMoveToToday}
            />}
          </section>
        )}

        <section className="day-task-group today-group" aria-label="مهمات هذا اليوم">
          {tasks.length === 0 ? (
            <div className={`day-tasks-empty${overdueTasks.length ? ' compact' : ''}`}>
              <span className="day-tasks-empty-check"><CheckIcon size={22} /></span>
              <strong>لا توجد مهمات اليوم</strong>
              <p>اكتب المهمة واضغط إضافة؛ بدون نوافذ أو خطوات إضافية.</p>
            </div>
          ) : (
            <>
            <button type="button" className="day-task-filter-btn remaining-filter" onClick={() => setRemainingOnly((only) => !only)}>{remainingOnly ? 'عرض الكل' : 'المتبقية فقط'}</button>
            <ReorderableTaskList
              tasks={visibleTasks}
              onToggle={onToggle}
              onRename={onRename}
              onDetails={setSelectedTask}
              onReorder={onReorder}
              onDelete={onDelete}
            />
            </>
          )}
        </section>
      </div>

      <form className="day-task-quick-add" onSubmit={submit}>
        <span className="day-task-add-icon"><PlusIcon size={19} /></span>
        <input
          id="day-task-add"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="أضف مهمة بسرعة…"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="مهمة جديدة"
          onFocus={(event) => {
            const input = event.currentTarget;
            requestAnimationFrame(() => input.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
          }}
        />
        <button type="submit" disabled={!draft.trim() || adding}>{adding ? '…' : 'إضافة'}</button>
      </form>
      {selectedTask && <TaskDetails key={selectedTask.id} task={selectedTask} onClose={() => setSelectedTask(null)} onSave={onSaveDetails} />}
    </section>
  );
}
