import { useCallback, useEffect, useRef, useState } from 'react';
import { setupPin, verifyPin } from '../data/storage';
import { BookIcon, BackspaceIcon, CheckIcon } from '../components/ui/Icons';
import './PinScreen.css';

const MIN_LEN = 4;
const MAX_LEN = 6;

const PROMPTS = {
  create: 'اختر رمز دخول من 4 إلى 6 أرقام',
  confirm: 'أعد إدخال الرمز للتأكيد',
  enter: 'أدخل رمز الدخول',
};

/**
 * شاشة رمز الدخول — تعمل بوضعين:
 *  mode="setup": الإعداد الأول (إدخال الرمز مرتين ثم حفظه)
 *  mode="enter": فتح القفل (التحقق من الرمز المخزّن)
 */
export default function PinScreen({ mode, onSuccess }) {
  const [step, setStep] = useState(mode === 'setup' ? 'create' : 'enter');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const firstPin = useRef('');

  const failFeedback = useCallback((msg) => {
    setError(msg);
    setPin('');
    setShake(true);
    navigator.vibrate?.([40, 60, 40]); // اهتزاز مزدوج = خطأ (كقفل الآيفون)
    setTimeout(() => setShake(false), 500);
  }, []);

  const submit = useCallback(async () => {
    if (busy || pin.length < MIN_LEN) return;
    setError('');

    // الخطوة الأولى من الإعداد: نحفظ الرمز مؤقتاً وننتقل للتأكيد
    if (step === 'create') {
      firstPin.current = pin;
      setPin('');
      setStep('confirm');
      return;
    }

    setBusy(true);
    try {
      if (step === 'confirm') {
        if (pin !== firstPin.current) {
          setStep('create');
          failFeedback('الرمزان غير متطابقين — جرّب من جديد');
          return;
        }
        const ok = await setupPin(pin);
        if (!ok) {
          failFeedback('تعذّر حفظ الرمز — حدّث الصفحة وحاول مجدداً');
          return;
        }
        onSuccess();
      } else {
        const ok = await verifyPin(pin);
        if (!ok) {
          failFeedback('رمز غير صحيح');
          return;
        }
        onSuccess();
      }
    } catch {
      failFeedback('تعذّر الاتصال — تأكد من الإنترنت وحاول مجدداً');
    } finally {
      setBusy(false);
    }
  }, [busy, pin, step, onSuccess, failFeedback]);

  const pressDigit = useCallback(
    (d) => {
      if (busy) return;
      setError('');
      navigator.vibrate?.(10); // نبضة خفيفة لكل رقم
      setPin((p) => (p.length >= MAX_LEN ? p : p + d));
    },
    [busy]
  );

  const pressBackspace = useCallback(() => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
  }, [busy]);

  // دعم لوحة مفاتيح الكمبيوتر: أرقام + Backspace + Enter
  useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
      else if (e.key === 'Backspace') pressBackspace();
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pressDigit, pressBackspace, submit]);

  // عدد النقاط يبدأ بالحد الأدنى (4) ويتمدد مع الكتابة حتى 6
  const dotCount = Math.max(MIN_LEN, pin.length);

  return (
    <main className="pin-screen">
      <header className="pin-header">
        <div className="pin-logo">
          <BookIcon size={34} strokeWidth={2} />
        </div>
        <h1 className="pin-title">كتابي</h1>
        <p className="pin-prompt">{PROMPTS[step]}</p>
      </header>

      <div
        className={`pin-dots${shake ? ' shake' : ''}${busy ? ' busy' : ''}`}
        dir="ltr"
        role="status"
        aria-label={`أُدخل ${pin.length} من الرمز`}
      >
        {Array.from({ length: dotCount }, (_, i) => (
          <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>

      <p className="pin-error" role="alert">
        {error || ' '}
      </p>

      {/* dir="ltr": ترتيب لوحة الأرقام 1-2-3 عالمي وثابت حتى في واجهة عربية */}
      <div className="pin-keypad" dir="ltr">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            className="pin-key"
            disabled={busy}
            onClick={() => pressDigit(String(n))}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="pin-key pin-key-ghost"
          aria-label="مسح رقم"
          disabled={busy || pin.length === 0}
          onClick={pressBackspace}
        >
          <BackspaceIcon size={28} />
        </button>
        <button
          type="button"
          className="pin-key"
          disabled={busy}
          onClick={() => pressDigit('0')}
        >
          0
        </button>
        <button
          type="button"
          className="pin-key pin-key-ok"
          aria-label="تأكيد"
          disabled={busy || pin.length < MIN_LEN}
          onClick={submit}
        >
          <CheckIcon size={28} />
        </button>
      </div>
    </main>
  );
}
