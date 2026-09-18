import { useEffect, useId, useRef, useState } from 'react';
import './TaskDetails.css';

const speechErrors = {
  'not-allowed': 'لم يُسمح بالميكروفون. فعّله من إعدادات الموقع أو اكتب الوصف.',
  'service-not-allowed': 'خدمة الإملاء غير متاحة في هذا المتصفح. استخدم إملاء لوحة المفاتيح.',
  'audio-capture': 'تعذّر الوصول إلى الميكروفون. تأكد من توصيله وإذن استخدامه.',
  'no-speech': 'لم ألتقط كلامًا. اضغط الميكروفون وحاول مجددًا.',
  network: 'تعذّر الاتصال بخدمة الإملاء. تحقق من الإنترنت وحاول مجددًا.',
  'language-not-supported': 'الإملاء العربي غير متاح هنا. يمكنك استخدام إملاء لوحة المفاتيح.',
};

export default function TaskDescription({ value, onChange, onListeningChange, disabled = false }) {
  const id = useId();
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onListeningChange);
  callbackRef.current = onListeningChange;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition) && window.isSecureContext;

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.abort();
    }
    callbackRef.current?.(false);
  }, []);

  const toggle = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;
    const original = value.trimEnd();
    const finals = new Map();
    let received = false;
    let failed = false;
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const pending = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finals.set(i, result[0].transcript.trim());
        else pending.push(result[0].transcript);
      }
      const text = [...finals.values()].filter(Boolean).join(' ');
      if (text) { received = true; onChange([original, text].filter(Boolean).join('\n')); }
      setInterim(pending.join(' '));
    };
    recognition.onerror = (event) => {
      failed = true;
      if (event.error !== 'aborted') setError(speechErrors[event.error] || 'تعذّر الإملاء. حاول مجددًا أو اكتب الوصف.');
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      callbackRef.current?.(false);
      if (!received && !failed) setError('لم يصل نص من الإملاء. يمكنك المحاولة مجددًا.');
    };
    setError('');
    recognitionRef.current = recognition;
    setListening(true);
    callbackRef.current?.(true);
    try { recognition.start(); } catch {
      recognitionRef.current = null;
      setListening(false);
      callbackRef.current?.(false);
      setError('تعذّر بدء الإملاء. حاول مجددًا أو استخدم إملاء لوحة المفاتيح.');
    }
  };

  return (
    <div className="task-description field">
      <div className="task-description-head">
        <label className="field-label" htmlFor={id}>وصف المهمة</label>
        <button type="button" className={`task-voice${listening ? ' is-listening' : ''}`} onClick={toggle} disabled={disabled || !supported} aria-pressed={listening}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></svg>
          {listening ? 'إيقاف الإملاء' : 'إملاء صوتي'}
        </button>
      </div>
      <textarea id={id} className="form-input" rows={4} value={value} onChange={(event) => onChange(event.target.value)} readOnly={listening} disabled={disabled} placeholder="اكتب التفاصيل أو أمْلِها بصوتك…" />
      <p className="task-help">{supported ? 'إملاء عربي؛ قد يرسل المتصفح الصوت لخدمته ويحتاج الإنترنت. راجع النص قبل الحفظ.' : 'الإملاء غير متاح في هذا المتصفح. استخدم ميكروفون لوحة المفاتيح أو اكتب الوصف.'}</p>
      {listening && <p className="task-help" role="status">{interim || 'أسمعك… تكلّم ثم اضغط إيقاف الإملاء.'}</p>}
      {error && <p className="task-error" role="alert">{error}</p>}
    </div>
  );
}
