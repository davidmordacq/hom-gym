import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Las reglas de progresión son lógica pura: no necesitan navegador.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
