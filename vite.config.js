import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // أضف هذا السطر لجعل جميع مسارات الملفات نسبية
})