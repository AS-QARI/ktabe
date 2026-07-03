import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { saveUnlock } from './lib/session';
import App from './App';

// في وضع التطوير فقط: #dev-unlock يتجاوز شاشة القفل — للاختبار الآلي
// (يُحذف تلقائياً من نسخة الإنتاج لأن import.meta.env.DEV تصبح false)
if (import.meta.env.DEV && window.location.hash.includes('dev-unlock')) {
  saveUnlock();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
