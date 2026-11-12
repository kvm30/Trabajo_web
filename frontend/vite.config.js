import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const host = env.VITE_HOST || '0.0.0.0';
  const port = Number(env.VITE_PORT || 5173);
  const backendUrl = env.VITE_API_URL || env.VITE_BACKEND_URL || 'http://localhost:3000';

  return {
    plugins: [vue()],
    server: {
      host,
      port,
      proxy: {
        '/api': backendUrl,
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
