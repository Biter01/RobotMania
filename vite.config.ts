import { defineConfig } from 'vite'

export default defineConfig({
  base: '/RobotMania/',
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
