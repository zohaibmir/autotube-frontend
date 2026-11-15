import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { resolveSiteConfig } from './scripts/site-config.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const site = resolveSiteConfig({ ...loadEnv(mode, process.cwd(), ''), ...process.env })
  return {
    plugins: [react()],
    define: {
      __MARKETING_ORIGIN__: JSON.stringify(site.origin),
      __SITE_INDEXABLE__: JSON.stringify(site.indexable),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@types': path.resolve(__dirname, './src/types'),
        '@api': path.resolve(__dirname, './src/api'),
        '@store': path.resolve(__dirname, './src/store'),
        '@content': path.resolve(__dirname, './src/content'),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      terserOptions: { compress: { passes: 2 } },
    },
  }
})
