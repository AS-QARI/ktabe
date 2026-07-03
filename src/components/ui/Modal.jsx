import { useEffect, useState } from 'react';
import { XIcon } from './Icons';
import './Modal.css';

/**
 * نافذة منزلقة (Sheet) بأسلوب iOS:
 * على الجوال تنزلق من الأسفل بزوايا علوية دائرية ومؤشر سحب،
 * وعلى الشاشات الكبيرة تظهر كحوار مركزي — نفس المكوّن، CSS يتكفل.
 *
 * props:
 *  open, onClose, title
 *  headerAction: عنصر اختياري في طرف الشريط (مثل زر "تم")
 *  tall: يجعلها بارتفاع شبه كامل (لمحرر اليوميات)
 */
export default function Modal({ open, onClose, title, headerAction, tall, children }) {
  // rendered: العنصر في الشجرة (يبقى أثناء حركة الخروج)
  // shown: الصنف المرئي — يُفعَّل بعد إطارين حتى تعمل حركة الدخول
  const [rendered, setRendered] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
  }, [open]);

  // قفل تمرير الصفحة الخلفية + إغلاق بزر Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className={`modal-backdrop${shown ? ' open' : ''}`}
      onClick={onClose}
      onTransitionEnd={(e) => {
        // بعد انتهاء حركة الخروج نزيل العنصر من الشجرة
        if (!open && e.target === e.currentTarget) setRendered(false);
      }}
    >
      <div
        className={`modal-sheet${shown ? ' open' : ''}${tall ? ' tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-grabber" aria-hidden="true" />
        <header className="modal-header">
          <button
            type="button"
            className="icon-btn"
            aria-label="إغلاق"
            onClick={onClose}
          >
            <XIcon size={20} />
          </button>
          <h2 className="modal-title">{title}</h2>
          <div className="modal-header-action">{headerAction}</div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
