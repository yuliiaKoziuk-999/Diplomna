import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // verification-sdk is a local `file:` link, so Vite skips its usual
    // dep pre-bundling (which is what converts CommonJS to ESM) unless
    // told to include it explicitly.
    include: ['verification-sdk'],
  },
  build: {
    // Same reason for `vite build`: the symlinked SDK is outside
    // node_modules, so the CommonJS plugin must be pointed at it too.
    commonjsOptions: {
      include: [/verification-sdk/, /node_modules/],
    },
  },
})
