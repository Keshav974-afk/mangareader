import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://atsu.moe',
        changeOrigin: true,
        headers: {
          Referer: 'https://atsu.moe',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        }
      },
      '/cdn': {
        target: 'https://cdn.atsu.moe',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cdn/, ''),
        headers: {
          Referer: 'https://atsu.moe',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        }
      }
    }
  }
});
