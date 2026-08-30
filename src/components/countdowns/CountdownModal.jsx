import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';

/** نافذة إضافة عداد تنازلي: عنوان + تاريخ الهدف */
export default function CountdownModal({ open, onClose, onSave, onDelete, initialValue = null }) {
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialValue?.title ?? '');
      setTargetDate(initialValue?.target_date ?? '');
      setBusy(false);
    }
  }, [open, initialValue]);

  const canSave = title.trim().length > 0 && targetDate && !busy;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({ title: title.trim(), target_date: targetDate });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="عداد تنازلي جديد">
      <form onSubmit={save}>
        <div className="field">
          <label className="field-label" htmlFor="cd-title">المناسبة</label>
          <input
            id="cd-title"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: رمضان، الإجازة، موعد التسليم…"
            maxLength={255}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cd-date">تاريخ الهدف</label>
          <input
            id="cd-date"
            type="date"
            className="form-input"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={!canSave}>
          {initialValue ? 'حفظ التعديل' : 'إضافة العداد'}
        </button>
        {initialValue && onDelete && (
          <button type="button" className="countdown-delete-btn" onClick={onDelete} disabled={busy}>
            حذف العدّاد
          </button>
        )}
      </form>
    </Modal>
  );
}
