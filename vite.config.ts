import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/dice_and_card/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@types': resolve(__dirname, './src/types'),
      '@enums': resolve(__dirname, './src/enums'),
      '@shared': resolve(__dirname, './src/shared'),
      '@engine': resolve(__dirname, './src/engine'),
    }
  },
})
