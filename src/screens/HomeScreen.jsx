import { useMemo, useState } from 'react';
import {
  listTasks,
  createTask,
  updateTask,
  setTaskCompleted,
  deleteTask,
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
} from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import { formatFullDate, todayKey, relativeDayLabel, toDateKey } from '../utils/dates';
import TaskItem from '../components/tasks/TaskItem';
import TaskModal from '../components/tasks/TaskModal';
import EntryModal from '../components/entries/EntryModal';
import {
  PlusIcon,
  GearIcon,
  ChecklistIcon,
  NoteIcon,
  ChevronLeftIcon,
} from '../components/ui/Icons';
import './screens.css';
import './HomeScreen.css';

const TASK_TABLES = ['tasks'];
const ENTRY_TABLES = ['entries'];

/** ترتيب المهام المفتوحة: المستحق أولاً، ثم الأولوية الأعلى، ثم الأحدث */
function scheduleOrder(a, b) {
  const ad = a.due_date ?? '9999-99-99';
  const bd = b.due_date ?? '9999-99-99';
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.created_at < b.created_at ? 1 : -1;
}

export default function HomeScreen({ onOpenSettings }) {
  const tasksLive = useLiveData(listTasks, TASK_TABLES);
  const entriesLive = useLiveData(listEntries, ENTRY_TABLES);

  const [quickTitle, setQuickTitle] = useState('');
  const [taskModal, setTaskModal] = useState({ open: false, task: null });
  const [entryModal, setEntryModal] = useState({ open: false, entry: null });
  const [showDone, setShowDone] = useState(false);

  const tasks = tasksLive.data;
  const entries = entriesLive.data;

  const { openTasks, doneTasks } = useMemo(() => {
    if (!tasks) return { openTasks: [], doneTasks: [] };
    return {
      openTasks: tasks.filter((t) => !t.is_completed).sort(scheduleOrder),
      doneTasks: tasks
        .filter((t) => t.is_completed)
        .sort((a, b) => ((a.completed_at ?? '') < (b.completed_at ?? '') ? 1 : -1)),
    };
  }, [tasks]);

  /* ---------- عمليات المهام ---------- */

  const quickAdd = async (e) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle(''); // نفرغ الحقل فوراً — استجابة لحظية
    try {
      await createTask({ title });
      await tasksLive.reload();
    } catch {
      setQuickTitle(title); // فشل؟ نعيد النص كي لا يضيع
    }
  };

  const toggleTask = async (task) => {
    const done = !task.is_completed;
    // تحديث متفائل: الواجهة تتغير فوراً والقاعدة تلحق
    tasksLive.setData((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, is_completed: done, completed_at: done ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      await setTaskCompleted(task.id, done);
    } catch {
      tasksLive.reload(); // فشل؟ نعيد الحقيقة من القاعدة
    }
  };

  const saveTask = async (fields) => {
    if (taskModal.task) {
      await updateTask(taskModal.task.id, fields);
    } else {
      await createTask(fields);
    }
    setTaskModal({ open: false, task: taskModal.task });
    await tasksLive.reload();
  };

  const removeTask = async (task) => {
    await deleteTask(task.id);
    setTaskModal({ open: false, task: null });
    await tasksLive.reload();
  };

  /* ---------- عمليات اليوميات ---------- */

  const saveEntry = async (fields) => {
    if (entryModal.entry) {
      await updateEntry(entryModal.entry.id, fields);
    } else {
      await createEntry(fields);
    }
    setEntryModal({ open: false, entry: entryModal.entry });
    await entriesLive.reload();
  };

  const removeEntry = async (entry) => {
    await deleteEntry(entry.id);
    setEntryModal({ open: false, entry: null });
    await entriesLive.reload();
  };

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <h1>المهام</h1>
          <p className="screen-subtitle">{formatFullDate(new Date())}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="الإعدادات"
          onClick={onOpenSettings}
        >
          <GearIcon size={24} />
        </button>
      </header>

      {/* إضافة سريعة: اكتب واضغط إدخال — أسرع طريق لالتقاط مهمة */}
      <form className="quick-add" onSubmit={quickAdd}>
        <button
          type="button"
          className="icon-btn"
          aria-label="مهمة جديدة بالتفاصيل"
          onClick={() => setTaskModal({ open: true, task: null })}
        >
          <PlusIcon size={22} />
        </button>
        <input
          className="quick-add-input"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="مهمة جديدة…"
          maxLength={500}
          enterKeyHint="done"
        />
      </form>

      {tasksLive.error && (
        <div className="error-banner">
          <span>تعذّر تحميل المهام</span>
          <button type="button" onClick={tasksLive.reload}>أعد المحاولة</button>
        </div>
      )}

      {tasks === null && !tasksLive.error ? (
        <div className="inline-loading"><div className="spinner" /></div>
      ) : openTasks.length === 0 && doneTasks.length === 0 ? (
        <div className="empty-state">
          <ChecklistIcon size={40} />
          <p>لا مهام بعد — أضف أول مهمة من الحقل أعلاه</p>
        </div>
      ) : (
        <>
          {openTasks.length > 0 && (
            <div className="card-list">
              {openTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onToggle={toggleTask}
                  onOpen={(task) => setTaskModal({ open: true, task })}
                />
              ))}
            </div>
          )}

          {doneTasks.length > 0 && (
            <>
              <button
                type="button"
                className={`done-toggle${showDone ? ' expanded' : ''}`}
                onClick={() => setShowDone((s) => !s)}
              >
                <span>المكتملة ({doneTasks.length})</span>
                <ChevronLeftIcon size={16} />
              </button>
              {showDone && (
                <div className="card-list">
                  {doneTasks.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      onToggle={toggleTask}
                      onOpen={(task) => setTaskModal({ open: true, task })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---------- اليوميات ---------- */}

      <div className="section-header">
        <h2>اليوميات</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="ملاحظة جديدة"
          onClick={() => setEntryModal({ open: true, entry: null })}
        >
          <PlusIcon size={22} />
        </button>
      </div>

      {entriesLive.error && (
        <div className="error-banner">
          <span>تعذّر تحميل اليوميات</span>
          <button type="button" onClick={entriesLive.reload}>أعد المحاولة</button>
        </div>
      )}

      {entries === null && !entriesLive.error ? (
        <div className="inline-loading"><div className="spinner" /></div>
      ) : entries?.length === 0 ? (
        <div className="empty-state">
          <NoteIcon size={40} />
          <p>مساحتك الحرة — اكتب يومياتك وأفكارك هنا</p>
        </div>
      ) : (
        <div className="card-list">
          {entries?.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="entry-card"
              onClick={() => setEntryModal({ open: true, entry })}
            >
              <span className="entry-card-top">
                <span className="entry-card-title">
                  {entry.title || firstLine(entry.content) || 'بدون عنوان'}
                </span>
                <span className="entry-card-date">
                  {relativeDayLabel(toDateKey(new Date(entry.updated_at)))}
                </span>
              </span>
              {entry.content && (
                <span className="entry-card-preview">{entry.content}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <TaskModal
        open={taskModal.open}
        task={taskModal.task}
        onClose={() => setTaskModal((m) => ({ ...m, open: false }))}
        onSave={saveTask}
        onDelete={removeTask}
      />

      <EntryModal
        open={entryModal.open}
        entry={entryModal.entry}
        onClose={() => setEntryModal((m) => ({ ...m, open: false }))}
        onSave={saveEntry}
        onDelete={removeEntry}
      />
    </main>
  );
}

/** أول سطر غير فارغ من نص — عنوان بديل للملاحظات بلا عنوان */
function firstLine(text) {
  return (text ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}
