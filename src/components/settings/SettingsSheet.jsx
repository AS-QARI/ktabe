import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import PrintView from './PrintView';
import PdfExportOptions from './PdfExportOptions';
import TrashSheet from './TrashSheet';
import { changePin, exportAll, importAll } from '../../data/storage';
import { clearUnlock } from '../../lib/session';
import { downloadJson } from '../../utils/download';
import { todayKey } from '../../utils/dates';
import {
  DownloadIcon,
  UploadIcon,
  PrinterIcon,
  LockIcon,
  TrashIcon,
  ChevronLeftIcon,
} from '../ui/Icons';
import './SettingsSheet.css';

/**
 * ورقة الإعدادات: تغيير الرمز، النسخ الاحتياطي (JSON/PDF/استيراد)،
 * وقفل التطبيق — قوائم مجمّعة بأسلوب تطبيق الإعدادات في iOS.
 */
export default function SettingsSheet({ open, onClose }) {
  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (open) {
      setPinFormOpen(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setPinMsg(null);
      setBusy(false);
      setPdfOptionsOpen(false);
    }
  }, [open]);

  // لا نحذف التقرير مباشرة بعد window.print(): في WebView الجوال قد يبدأ
  // الالتقاط بعد رجوع الدالة، فينتج PDF بخلفية فقط. يبقى الـ Portal مرسوماً
  // حتى يؤكد المتصفح نهاية الطباعة.
  useEffect(() => {
    if (!printData) return undefined;

    let cancelled = false;
    let printStarted = false;
    let printFinished = false;
    let pageWasHidden = false;
    const printMedia = window.matchMedia?.('print');

    const finishPrint = () => {
      if (!printStarted || printFinished || cancelled) return;
      printFinished = true;
      setPrintData((current) => (current === printData ? null : current));
    };
    const onMediaChange = (event) => {
      if (!event.matches) finishPrint();
    };
    const onVisibilityChange = () => {
      if (!printStarted) return;
      if (document.visibilityState === 'hidden') pageWasHidden = true;
      if (pageWasHidden && document.visibilityState === 'visible') finishPrint();
    };

    window.addEventListener('afterprint', finishPrint);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (printMedia?.addEventListener) printMedia.addEventListener('change', onMediaChange);
    else printMedia?.addListener?.(onMediaChange);

    const timer = window.setTimeout(() => {
      // إطاران يضمنان أن React رسم التقرير وأن تخطيط A4 حُسب قبل الطباعة.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (cancelled) return;
        printStarted = true;
        window.print();
      }));
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finishPrint);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (printMedia?.removeEventListener) printMedia.removeEventListener('change', onMediaChange);
      else printMedia?.removeListener?.(onMediaChange);
    };
  }, [printData]);

  /* ---------- تغيير الرمز ---------- */

  const submitPinChange = async (e) => {
    e.preventDefault();
    setPinMsg(null);
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinMsg({ ok: false, text: 'الرمز الجديد يجب أن يكون 4-6 أرقام' });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ ok: false, text: 'تأكيد الرمز الجديد غير متطابق' });
      return;
    }
    setBusy(true);
    try {
      const ok = await changePin(oldPin, newPin);
      if (ok) {
        setPinMsg({ ok: true, text: 'تم تغيير الرمز بنجاح' });
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setPinMsg({ ok: false, text: 'الرمز الحالي غير صحيح' });
      }
    } catch {
      setPinMsg({ ok: false, text: 'تعذّر الاتصال — حاول مجدداً' });
    } finally {
      setBusy(false);
    }
  };

  /* ---------- النسخ الاحتياطي ---------- */

  const exportJson = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      downloadJson(data, `kitabi-backup-${todayKey()}.json`);
    } catch {
      window.alert('تعذّر التصدير — تأكد من الاتصال');
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async (selection) => {
    setBusy(true);
    try {
      setPrintData({ data: await exportAll(), selection });
      setPdfOptionsOpen(false);
    } catch {
      window.alert('تعذّر التصدير — تأكد من الاتصال');
    } finally {
      setBusy(false);
    }
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // يسمح باختيار نفس الملف مرة أخرى لاحقاً
    if (!file) return;
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      window.alert('الملف ليس JSON صالحاً');
      return;
    }
    const summary = `${backup.pages?.length ?? '؟'} صفحة، ${backup.blocks?.length ?? '؟'} سطر، ${backup.countdowns?.length ?? '؟'} عداد`;
    if (
      !window.confirm(
        `سيتم استبدال كل بياناتك الحالية بمحتوى النسخة (${summary}).\nهذه العملية لا يمكن التراجع عنها. متابعة؟`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await importAll(backup);
      window.alert('تمت الاستعادة بنجاح ✓');
      onClose();
    } catch (err) {
      window.alert(`فشلت الاستعادة: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- قفل التطبيق ---------- */

  const lockNow = () => {
    clearUnlock();
    window.location.reload();
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="الإعدادات">
        <div className="settings">
          <p className="settings-group-title">الأمان</p>
          <div className="card-list">
            <button
              type="button"
              className="settings-row"
              onClick={() => setPinFormOpen((s) => !s)}
            >
              <span className="settings-row-icon"><LockIcon size={20} /></span>
              <span className="settings-row-label">تغيير رمز الدخول</span>
              <span className={`settings-chevron${pinFormOpen ? ' open' : ''}`}>
                <ChevronLeftIcon size={16} />
              </span>
            </button>

            {pinFormOpen && (
              <form className="pin-change-form" onSubmit={submitPinChange}>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="الرمز الحالي"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                />
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="الرمز الجديد (4-6 أرقام)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                />
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="تأكيد الرمز الجديد"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                />
                {pinMsg && (
                  <p className={`pin-change-msg${pinMsg.ok ? ' ok' : ''}`}>
                    {pinMsg.text}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !oldPin || !newPin || !confirmPin}
                >
                  حفظ الرمز الجديد
                </button>
              </form>
            )}

            <button type="button" className="settings-row" onClick={lockNow}>
              <span className="settings-row-icon danger"><LockIcon size={20} /></span>
              <span className="settings-row-label danger">قفل التطبيق الآن</span>
            </button>
          </div>

          <p className="settings-group-title">النسخ والتصدير</p>
          <div className="card-list">
            <button
              type="button"
              className="settings-row"
              disabled={busy}
              onClick={exportJson}
            >
              <span className="settings-row-icon"><DownloadIcon size={20} /></span>
              <span className="settings-row-label">تصدير JSON (نسخة كاملة)</span>
            </button>
            <button
              type="button"
              className="settings-row"
              disabled={busy}
              onClick={() => setPdfOptionsOpen((open) => !open)}
            >
              <span className="settings-row-icon"><PrinterIcon size={20} /></span>
              <span className="settings-row-label">تصدير ملخص PDF</span>
              <span className={`settings-chevron${pdfOptionsOpen ? ' open' : ''}`}><ChevronLeftIcon size={16} /></span>
            </button>
            {pdfOptionsOpen && <PdfExportOptions busy={busy} onExport={exportPdf} />}
            <button
              type="button"
              className="settings-row"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <span className="settings-row-icon"><UploadIcon size={20} /></span>
              <span className="settings-row-label">استيراد من نسخة JSON</span>
            </button>
          </div>

          <p className="settings-group-title">البيانات</p>
          <div className="card-list">
            <button type="button" className="settings-row" onClick={() => setTrashOpen(true)}>
              <span className="settings-row-icon danger"><TrashIcon size={20} /></span>
              <span className="settings-row-label">سلة المحذوفات</span>
              <span className="settings-row-value">استرجاع العناصر</span>
            </button>
          </div>

          <p className="settings-footer">
            كتابي — تطبيقك الشخصي. بياناتك محفوظة محليًا داخل هذا المتصفح فقط
            استخدم النسخة الاحتياطية لنقلها إلى جهاز آخر. عند استخدام الإملاء الصوتي، قد يرسل المتصفح الصوت إلى خدمة التعرف على الكلام.
          </p>
        </div>
      </Modal>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={importJson}
      />

      {printData && <PrintView data={printData.data} selection={printData.selection} />}
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
    </>
  );
}
