import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({

  base: '/f1-career-bumps/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist', // default
    emptyOutDir: true,
  },

  // GitHub Pages routing
  server: {
    historyApiFallback: true,
    port: 5173,
    open: true,
  }
});