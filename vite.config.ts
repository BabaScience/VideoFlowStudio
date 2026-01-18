import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@components': path.resolve(__dirname, './src/renderer/components'),
      '@stores': path.resolve(__dirname, './src/renderer/stores'),
      '@services': path.resolve(__dirname, './src/renderer/services'),
      '@hooks': path.resolve(__dirname, './src/renderer/hooks'),
      '@utils': path.resolve(__dirname, './src/renderer/utils'),
    },
  },
});
