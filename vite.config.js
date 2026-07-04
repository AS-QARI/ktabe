import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    host: true,
  },
}));
