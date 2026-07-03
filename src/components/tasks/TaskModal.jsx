import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import SegmentedControl from '../ui/SegmentedControl';
import { PRIORITY_LABELS } from '../../utils/format';

const PRIORITY_OPTIONS = PRIORITY_LABELS.map((label, value) => ({ value, label }));

/**
 * نافذة إضافة/تعديل مهمة: عنوان، وصف، أولوية، تاريخ استحقاق.
 * task = null → وضع الإضافة. onSave تستلم الحقول، والأب يقرر إنشاء أم تعديل.
 */
export default function TaskModal({ open, task, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  // تعبئة الحقول عند كل فتح (إضافة فارغة أو تعديل بقيم المهمة)
  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setPriority(task?.priority ?? 0);
      setDueDate(task?.due_date ?? '');
      setBusy(false);
    }
  }, [open, task]);

  const canSave = title.trim().length > 0 && !busy;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('حذف هذه المهمة نهائياً؟')) return;
    setBusy(true);
    try {
      await onDelete(task);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'تعديل المهمة' : 'مهمة جديدة'}
    >
      <form onSubmit={save}>
        <div className="field">
          <label className="field-label" htmlFor="task-title">العنوان</label>
          <input
            id="task-title"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ماذا تريد أن تنجز؟"
            maxLength={500}
            autoFocus={!task}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="task-desc">الوصف (اختياري)</label>
          <textarea
            id="task-desc"
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="تفاصيل إضافية…"
            rows={3}
          />
        </div>

        <div className="field">
          <span className="field-label">الأولوية</span>
          <SegmentedControl
            label="الأولوية"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="task-due">تاريخ الاستحقاق (اختياري)</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              id="task-due"
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {dueDate && (
              <button
                type="button"
                className="btn-text"
                onClick={() => setDueDate('')}
              >
                مسح
              </button>
            )}
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={!canSave}>
          {task ? 'حفظ التعديلات' : 'إضافة المهمة'}
        </button>

        {task && (
          <button
            type="button"
            className="btn-destructive"
            disabled={busy}
            onClick={remove}
          >
            حذف المهمة
          </button>
        )}
      </form>
    </Modal>
  );
}
