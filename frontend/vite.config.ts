import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 设置环境变量的前缀
  envPrefix: "VITE_",
  build: {
    // 生产构建的设置
    sourcemap: true,
    // 代码块大小优化
    chunkSizeWarningLimit: 1600,
  },
  // 开发服务器设置
  server: {
    port: 5173,
    host: true,
    // CORS 设置
    cors: true,
    // API 代理设置
    proxy: {
      "/api": {
        target: process.env.VITE_API_ENDPOINT || "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
