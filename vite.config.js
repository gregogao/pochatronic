import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/pochatronic/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pochatronic',
        short_name: 'Pochatronic',
        description: 'Contador de Pocha con ranking',
        start_url: '/pochatronic/',
        scope: '/pochatronic/',
        display: 'standalone',
        theme_color: '#2c3e50',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
