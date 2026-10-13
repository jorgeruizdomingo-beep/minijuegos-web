import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// BASE_PATH lo fija el workflow de despliegue (p. ej. "/videojuegos-web/" en GitHub Pages).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      input: {
        portada: resolve(import.meta.dirname, 'index.html'),
        hormiguero: resolve(import.meta.dirname, 'games/hormiguero/index.html'),
        orbita: resolve(import.meta.dirname, 'games/orbita/index.html'),
      },
    },
  },
})
