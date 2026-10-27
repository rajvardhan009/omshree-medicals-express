import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nitro } from 'nitro/vite';
export default defineConfig({
  plugins: [tanstackStart(), react(), tailwindcss(), tsconfigPaths(), nitro({ preset: 'node-server' })],
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
});
