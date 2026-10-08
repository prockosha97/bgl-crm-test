import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: 'web', plugins: [react()], build: { outDir: '../dist/web', emptyOutDir: false }, server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:80', '/health': 'http://127.0.0.1:80', '/ready': 'http://127.0.0.1:80' } } });
