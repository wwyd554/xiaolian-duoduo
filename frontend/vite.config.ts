import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 環境変数のプレフィックスを設定
  envPrefix: "VITE_",
  build: {
    // 本番ビルドの設定
    sourcemap: true,
    // チャンクサイズの最適化
    chunkSizeWarningLimit: 1600,
  },
  // 開発サーバー設定
  server: {
    port: 5173,
    host: true,
    // CORS設定
    cors: true,
    // APIプロキシ設定
    proxy: {
      "/api": {
        target: process.env.VITE_API_ENDPOINT || "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
