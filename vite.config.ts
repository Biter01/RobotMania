import { defineConfig } from 'vite'

export default defineConfig({
  base: '/RoboMania/',
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
