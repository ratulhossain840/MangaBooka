// FILE: vite.config.js
// PATH: client/vite.config.js (রিপোর client ফোল্ডারে)
// কাজ: ক্রেতার অ্যাপ (index.html) ও অ্যাডমিন অ্যাপ (admin/index.html) একসাথে বিল্ড করে client/dist-এ রাখে।
// admin/index.html না থাকলে (ব্যাচ ১৫-এর আগে) শুধু ক্রেতার অ্যাপ বিল্ড হয়, তাই ডিপ্লয় ভাঙে না।
// .env ফাইল রিপোর মূল ফোল্ডারে (envDir); Render-এ VITE_ দিয়ে শুরু Environment ভ্যারিয়েবল সরাসরি পায়।

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

const input = { main: path.resolve(root, 'index.html') };
const adminHtml = path.resolve(root, 'admin/index.html');
if (fs.existsSync(adminHtml)) input.admin = adminHtml;

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(root, '..'),
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2019',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input,
      output: {
        // বড় লাইব্রেরি আলাদা ফাইলে, যাতে অ্যাপ বদলালে ব্রাউজার ক্যাশ নষ্ট না হয়
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase';
          if (/[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
});
