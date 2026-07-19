import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['couple-mark.svg', 'couple-mark-512.png'],
      manifest: {
        name: '我们的私房菜单',
        short_name: '私房菜单',
        lang: 'zh-CN',
        description: '只属于两个人的点菜与甜蜜互动空间',
        theme_color: '#8e3b52',
        background_color: '#fff9f5',
        display: 'standalone',
        id: './',
        start_url: '.',
        scope: '.',
        orientation: 'portrait',
        icons: [
          {
            src: 'couple-mark-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'couple-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg}']
      },
      devOptions: { enabled: false }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('gsap')) return 'motion'
          if (id.includes('react')) return 'react-vendor'
          return undefined
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true
  }
})
