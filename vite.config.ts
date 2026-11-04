import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { env } from 'node:process';

export default defineConfig({
  base: env.BASE_PATH ?? '/',
  plugins: [svelte(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['apple-touch-icon.png'],
    manifest: {
      name: 'Portion',
      short_name: 'Portion',
      lang: 'tr',
      description: 'Kişisel tarifler ve porsiyon hesabı.',
      display: 'standalone',
      theme_color: '#F5F2EC',
      background_color: '#F5F2EC',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg,webmanifest}'],
      cleanupOutdatedCaches: true,
    },
  })],
});
