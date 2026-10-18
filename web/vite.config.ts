import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the site reaches the model server (engine/server.py) through this proxy.
const proxy = { '/api': 'http://127.0.0.1:8000' };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
