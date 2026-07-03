import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import PrintView from './PrintView';
import { changePin, exportAll, importAll } from '../../data/storage';
import { clearUnlock } from '../../lib/session';
import { downloadJson } from '../../utils/download';
import { todayKey } from '../../utils/dates';
import {
  DownloadIcon,
  UploadIcon,
  PrinterIcon,
  LockIcon,
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
  const fileInput = useRef(null);

  useEffect(() => {
    if (open) {
      setPinFormOpen(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setPinMsg(null);
      setBusy(false);
    }
  }, [open]);

  // بعد تجهيز بيانات الطباعة نمهل إطاراً حتى تُرسم ثم نفتح حوار الطباعة
  useEffect(() => {
    if (!printData) return;
    const t = setTimeout(() => {
      window.print();
      setPrintData(null);
    }, 200);
    return () => clearTimeout(t);
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

  const exportPdf = async () => {
    setBusy(true);
    try {
      setPrintData(await exportAll());
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

          <p className="settings-group-title">النسخ الاحتياطي</p>
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
              onClick={exportPdf}
            >
              <span className="settings-row-icon"><PrinterIcon size={20} /></span>
              <span className="settings-row-label">تصدير PDF (للقراءة والطباعة)</span>
            </button>
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

          <p className="settings-footer">
            كتابي — تطبيقك الشخصي. البيانات محفوظة في قاعدة بياناتك الخاصة
            على Supabase وتتزامن بين أجهزتك تلقائياً.
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

      {printData && <PrintView data={printData} />}
    </>
  );
}
