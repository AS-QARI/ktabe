import { useEffect, useState } from 'react';
import { hasPin } from './data/storage';
import { isUnlocked, saveUnlock } from './lib/session';
import PinScreen from './screens/PinScreen';
import AppShell from './components/AppShell';

/**
 * بوابة التطبيق — تدير حالة القفل:
 *  checking: نستعلم من القاعدة هل هناك رمز مُعدّ أصلاً
 *  setup:    أول استخدام — لا يوجد رمز بعد
 *  locked:   يوجد رمز ويجب إدخاله
 *  unlocked: الجلسة مفتوحة (محفوظة محلياً من زيارة سابقة أو بعد إدخال صحيح)
 */
export default function App() {
  const [gate, setGate] = useState(() => (isUnlocked() ? 'unlocked' : 'checking'));
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (gate !== 'checking') return;
    let cancelled = false;
    hasPin()
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

  if (loadError) {
    return (
      <div className="error-state">
        <h2>تعذّر الاتصال</h2>
        <p>تأكد من اتصالك بالإنترنت ثم أعد المحاولة.</p>
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

  if (gate === 'checking') {
    return (
      <div className="splash">
        <div className="spinner" />
      </div>
    );
  }

  if (gate === 'setup' || gate === 'locked') {
    return (
      <PinScreen
        key={gate}
        mode={gate === 'setup' ? 'setup' : 'enter'}
        onSuccess={unlock}
      />
    );
  }

  return <AppShell />;
}
