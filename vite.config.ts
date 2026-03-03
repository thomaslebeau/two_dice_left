import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/two_dice_left/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engine': resolve(__dirname, './src/engine'),
    }
  },
})
