import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { saveUnlock } from './lib/session';
import App from './App';

function showFatalError(error) {
  const message = error?.message || String(error || 'حدث خطأ غير معروف');
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#050506;color:#fff;font-family:Tahoma,sans-serif;direction:rtl;text-align:center">
      <section style="max-width:520px">
        <h1 style="font-size:24px;margin:0 0 12px">تعذر تشغيل التطبيق</h1>
        <p style="margin:0 0 16px;color:rgba(255,255,255,.72)">غالبا المشكلة من إعدادات Supabase أو من نسخة النشر.</p>
        <pre style="white-space:pre-wrap;text-align:left;direction:ltr;background:rgba(255,255,255,.08);padding:12px;border-radius:10px;color:#fff">${message}</pre>
      </section>
    </main>
  `;
}

window.addEventListener('error', (event) => showFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  if (import.meta.env.DEV && window.location.hash.includes('dev-unlock')) {
    saveUnlock();
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  showFatalError(error);
}
