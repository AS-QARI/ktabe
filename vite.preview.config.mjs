// إعداد مؤقت للمعاينة البصرية بدون Supabase — يُحذف بعد الانتهاء
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const MOCKS =
  '/private/tmp/claude-501/-Users-zxs-GitHub-ktabe/b16767a7-bd21-4ab8-80c3-ccbc3ac9e7af/scratchpad/mocks';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^(?:\.\.?\/)+data\/storage$/, replacement: `${MOCKS}/storage.js` },
      { find: /^(?:\.\.?\/)+lib\/supabaseClient$/, replacement: `${MOCKS}/supabaseClient.js` },
    ],
  },
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5173 },
});
