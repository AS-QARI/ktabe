import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { formatDateWithYear } from '../../utils/dates';
import './EntryModal.css';

/**
 * محرر النص الحر — بأسلوب Apple Notes: ورقة شبه كاملة، عنوان اختياري
 * كبير، ومساحة كتابة حرة بلا حدود. "تم" تحفظ وتغلق.
 */
export default function EntryModal({ open, entry, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(entry?.title ?? '');
      setContent(entry?.content ?? '');
      setBusy(false);
    }
  }, [open, entry]);

  const isEmpty = !title.trim() && !content.trim();

  const save = async () => {
    // ملاحظة جديدة فارغة = مجرد تراجع، نغلق بلا حفظ
    if (!entry && isEmpty) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onSave({
        title: title.trim() || null,
        content,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('حذف هذه الملاحظة نهائياً؟')) return;
    setBusy(true);
    try {
      await onDelete(entry);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? 'تعديل' : 'ملاحظة جديدة'}
      tall
      headerAction={
        <button type="button" className="btn-text" disabled={busy} onClick={save}>
          تم
        </button>
      }
    >
      <div className="entry-editor">
        <input
          className="entry-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="العنوان (اختياري)"
          maxLength={500}
        />
        {entry && (
          <p className="entry-edit-meta">
            آخر تعديل: {formatDateWithYear(new Date(entry.updated_at))}
          </p>
        )}
        <textarea
          className="entry-content-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="اكتب بحرية…"
          autoFocus={!entry}
        />
        {entry && (
          <button
            type="button"
            className="btn-destructive"
            disabled={busy}
            onClick={remove}
          >
            حذف الملاحظة
          </button>
        )}
      </div>
    </Modal>
  );
}
