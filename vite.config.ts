import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/dice_and_card/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engine': resolve(__dirname, './src/engine'),
    }
  },
})
