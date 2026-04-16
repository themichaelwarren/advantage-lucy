import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import sheetsPlugin from './server/vite-plugin-sheets';

export default defineConfig(({ mode }) => {
  // Load .env files so process.env is available in the sheets plugin
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), sheetsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/images': {
          target: 'https://advantagelucy.com',
          changeOrigin: true,
        },
      },
    },
  };
});
