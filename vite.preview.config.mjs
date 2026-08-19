// إعداد مؤقت للمعاينة البصرية بدون Supabase — يُحذف بعد الانتهاء
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const MOCKS =
  '/private/tmp/claude-501/-Users-zxs-GitHub-ktabe/574117af-11d9-4bb6-826d-8a4b1aa71a14/scratchpad/mocks';

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
