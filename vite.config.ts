import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import packageJson from './package.json';
import {defineConfig} from 'vite';
import {execSync} from 'child_process';

const getGitCommitHash = () => {
  try {
    if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0,7);
    if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0,7);
    if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA.slice(0,7);
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'c6e04de';
  }
};

const getGitCommitMessage = () => {
  try {
    return execSync('git log -1 --pretty=%s').toString().trim().slice(0, 80);
  } catch (e) {
    return 'fix(ui): responsive two-tier navbar and mobile layout';
  }
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version || '8.2.5'),
      __COMMIT_HASH__: JSON.stringify(getGitCommitHash()),
      __COMMIT_MESSAGE__: JSON.stringify(getGitCommitMessage()),
      __BUILD_TIME__: JSON.stringify(
        new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST'
      ),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});