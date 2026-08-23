import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// 读取 .env.test 文件
dotenv.config({ path: ".env.test" });

// 从环境变量获取 staging 环境 URL（默认是本地开发环境）
const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173";
const isStaging = baseURL !== "http://localhost:5173";

export default defineConfig({
  testDir: "./src/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : isStaging ? 3 : undefined,
  reporter: "html",
  // 测试超时设置（staging 环境下设置更长）
  timeout: isStaging ? 120000 : 30000,
  expect: {
    timeout: isStaging ? 15000 : 5000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    // 截图设置
    screenshot: "only-on-failure",
    // 视频录制设置（仅失败时）
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  // 仅在本地开发环境下启动 webServer
  ...(isStaging
    ? {}
    : {
      webServer: {
        command: "npm run dev",
        port: 5173,
        reuseExistingServer: !process.env.CI,
      },
    }),
});
