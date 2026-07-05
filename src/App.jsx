import { useEffect, useState } from 'react';
import { hasPin } from './data/storage';
import { supabaseConfigError } from './lib/supabaseClient';
import { isUnlocked, saveUnlock } from './lib/session';
import PinScreen from './screens/PinScreen';
import AppShell from './components/AppShell';
import DeviceFrame, { readPreviewFrame } from './components/preview/DeviceFrame';

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/**
 * بوابة التطبيق — تدير حالة القفل:
 *  checking: نستعلم من القاعدة هل هناك رمز مُعدّ أصلاً
 *  setup:    أول استخدام — لا يوجد رمز بعد
 *  locked:   يوجد رمز ويجب إدخاله
 *  unlocked: الجلسة مفتوحة (محفوظة محلياً من زيارة سابقة أو بعد إدخال صحيح)
 */
export default function App() {
  const [gate, setGate] = useState(() => (supabaseConfigError ? 'checking' : isUnlocked() ? 'unlocked' : 'checking'));
  const [loadError, setLoadError] = useState(null);
  const previewFrame = readPreviewFrame() === 'iphone';

  useEffect(() => {
    if (gate !== 'checking') return;
    if (supabaseConfigError) {
      setLoadError(supabaseConfigError);
      return;
    }
    let cancelled = false;
    withTimeout(
      hasPin(),
      10000,
      'انتهت مهلة الاتصال بـ Supabase. تأكد من رابط المشروع والمفتاح ومن أن GitHub Pages يستخدم النسخة الجديدة.'
    )
      .then((exists) => {
        if (!cancelled) setGate(exists ? 'locked' : 'setup');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [gate]);

  const unlock = () => {
    saveUnlock();
    setGate('unlocked');
  };

  let content;

  if (loadError) {
    content = (
      <div className="error-state">
        <h2>تعذّر الاتصال</h2>
        <p>{loadError}</p>
        <button
          type="button"
          className="btn-tint"
          onClick={() => {
            setLoadError(null);
            setGate('checking');
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
  else if (gate === 'checking') {
    content = (
      <div className="splash">
        <div className="spinner" />
      </div>
    );
  }
  else if (gate === 'setup' || gate === 'locked') {
    content = (
      <PinScreen
        key={gate}
        mode={gate === 'setup' ? 'setup' : 'enter'}
        onSuccess={unlock}
      />
    );
  }
  else {
    content = <AppShell />;
  }

  return <DeviceFrame enabled={previewFrame}>{content}</DeviceFrame>;
}




