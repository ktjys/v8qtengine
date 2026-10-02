import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify('8.2.4'),
      __COMMIT_HASH__: JSON.stringify(
        process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ||
        process.env.GITHUB_SHA?.slice(0, 7) ||
        '14c4db1'
      ),
      __COMMIT_MESSAGE__: JSON.stringify('fix: subrequests limit, market scan isolation & UX audit'),
      __BUILD_TIME__: JSON.stringify(
        new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST'
      ),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
