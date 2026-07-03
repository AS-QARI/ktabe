import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // مسارات نسبية في البناء: يعمل الموقع من أي مسار
  // (مثل https://user.github.io/ktabe/) بدون تعديل
  base: command === 'build' ? './' : '/',
  server: {
    // host: true يسمح بفتح التطبيق من الجوال على نفس شبكة الواي فاي أثناء التطوير
    host: true,
  },
}));
