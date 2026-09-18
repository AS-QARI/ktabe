import { useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../ui/Modal';
import TaskDescription from './TaskDescription';
import './TaskDetails.css';

const stamp = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });

export default function TaskDetails({ task, onClose, onSave }) {
  const [description, setDescription] = useState(task.description || '');
  const [pinned, setPinned] = useState(Boolean(task.is_pinned));
  const [progress, setProgress] = useState(task.is_completed ? 100 : (task.progress || 0));
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => {
    if (busy) return;
    const changed = description !== (task.description || '') || pinned !== Boolean(task.is_pinned) ||
      Number(progress) !== (task.is_completed ? 100 : (task.progress || 0)) || note.trim();
    if (changed && !window.confirm('إغلاق بدون حفظ التغييرات؟')) return;
    onClose();
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy || listening) return;
    setBusy(true);
    setError('');
    try {
      await onSave(task.id, { description, is_pinned: pinned, progress: Number(progress), note });
      onClose();
    } catch (err) { setError(err.message || 'تعذّر الحفظ. حاول مجددًا.'); }
    finally { setBusy(false); }
  };
  return createPortal(
    <Modal open onClose={close} title="تفاصيل المهمة">
      <form className="task-details" onSubmit={save}>
        <h3 className="task-details-title">{task.text}</h3>
        <label className="task-pin-option">
          <input type="checkbox" checked={pinned} disabled={busy} onChange={(event) => setPinned(event.target.checked)} />
          <span><strong>تثبيت كهدف طويل المدى</strong><small>يظهر فوق المهمات في كل الأيام، وله نسبة تقدم مستقلة.</small></span>
        </label>
        {pinned && task.repeat_rule && task.repeat_rule !== 'none' && <p className="task-help">عند تثبيت هذا الهدف سيتوقف تكراره التلقائي.</p>}
        {!pinned && task.is_pinned && <p className="task-help">سيعود إلى مهمات موعده الأصلي ({task.due_date}) مع الاحتفاظ بسجل التقدم.</p>}
        <TaskDescription value={description} onChange={setDescription} onListeningChange={setListening} disabled={busy} />
        {(pinned || task.is_pinned || task.progress_entries?.length > 0) && <>
          <div className="task-progress-heading"><label htmlFor="goal-progress">نسبة الإنجاز</label><output htmlFor="goal-progress">{progress}%</output></div>
          <input id="goal-progress" type="range" min="0" max="100" step="1" value={progress} disabled={busy} onChange={(event) => setProgress(Number(event.target.value))} />
          <label className="field-label" htmlFor="goal-note">ما الذي تقدّمت فيه؟</label>
          <textarea id="goal-note" className="form-input" rows={3} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="اكتب خطوة أنجزتها أو تحديثًا على هدفك…" />
          <p className="task-help">يُحفظ تحديثك مع التاريخ والنسبة. وصولك إلى 100% يعني اكتمال الهدف.</p>
        </>}
        {error && <p className="task-error" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy || listening}>{busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</button>
        {(task.is_pinned || task.progress_entries?.length > 0) && <section className="goal-history" aria-label="سجل التقدم">
          <h4>سجل التقدم</h4>
          {!task.progress_entries?.length && <p className="task-help">كل خطوة تسجّلها هنا تبقى في رحلة هدفك.</p>}
          {[...(task.progress_entries || [])].reverse().map((entry) => <article key={entry.id}>
            <header><strong>{entry.progress}%</strong><time dateTime={entry.created_at}>{stamp.format(new Date(entry.created_at))}</time></header>
            <p>{entry.note || 'تحديث نسبة الإنجاز'}</p>
          </article>)}
        </section>}
      </form>
    </Modal>, document.body
  );
}
