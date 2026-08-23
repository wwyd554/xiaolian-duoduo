/**
 * E2E 测试: 视频录制功能的开/关设置
 *
 * GitHub Issue #54「视频录制功能开/关设置的追加」的 E2E 测试
 * 涉及 dev 环境（CloudFront）连接的集成测试
 *
 * 验证要点:
 * 1. 设置弹窗中显示录制切换开关
 * 2. 录制关闭时摄像头预览（VideoManager 的 video 元素）隐藏
 * 3. 录制关闭时开始按钮无需等待摄像头初始化即可立即启用
 * 4. 录制设置持久化到 localStorage（刷新后仍保留）
 * 5. 会话开始后录制设置被锁定
 *
 * 注意: 选择器使用在已部署环境中稳定运行的 aria-label / role 方案
 * （data-testid 仅在构建、部署后生效，因此这里不依赖它）
 */
import { test, expect, Page, Locator } from "@playwright/test";
import { login, navigateToScenarioSelect } from "./helpers";

// 打开设置弹窗的按钮（i18n: ⚙️ 图标，兼容日英文 aria-label）
const SETTINGS_BUTTON_SELECTOR =
  'button[aria-label="打开设置"], button[aria-label="Open settings"]';

/**
 * 获取录制切换开关
 * MUI 的 Switch 以 role="switch" 的 input 元素渲染，
 * 从 FormControlLabel 的标签文本计算无障碍名称。
 * 标签随 i18n 的 ON/OFF 及日英文而变化，因此兼容所有模式。
 *
 * @param page Playwright 的页面对象
 */
function getRecordingToggle(page: Page): Locator {
  return page.getByRole("switch", {
    name: /视频录制 (ON|OFF)|Video Recording (ON|OFF)/,
  });
}

/**
 * 获取摄像头预览（VideoManager 渲染的 video 元素）
 * 仅录制开启时会话画面显示 video 元素。
 *
 * @param page Playwright 的页面对象
 */
function getCameraPreview(page: Page): Locator {
  return page.locator("main video");
}

// 测试执行前的通用设置
test.beforeEach(async ({ page }) => {
  await login(page);
});

/**
 * 从场景选择跳转到会话页面的辅助函数
 *
 * @param page Playwright 的页面对象
 */
async function navigateToConversationPage(page: Page): Promise<void> {
  await navigateToScenarioSelect(page);
  const startButton = page
    .locator('button:has-text("从该场景开始")')
    .first();
  await expect(startButton).toBeVisible();
  await startButton.click();
  await page.waitForURL(/\/conversation\//);
}

/**
 * 打开设置弹窗的辅助函数
 *
 * @param page Playwright 的页面对象
 */
async function openSettingsModal(page: Page): Promise<void> {
  const settingsButton = page.locator(SETTINGS_BUTTON_SELECTOR).first();
  await expect(settingsButton).toBeVisible({ timeout: 15000 });
  await settingsButton.click();

  // 等待设置对话框显示
  const settingsDialog = page.locator('[role="dialog"]');
  await expect(settingsDialog.first()).toBeVisible({ timeout: 10000 });

  // 等待录制切换开关显示
  await expect(getRecordingToggle(page)).toBeVisible({ timeout: 10000 });
}

test.describe("视频录制开/关设置", () => {
  test.describe("设置面板的显示", () => {
    test("设置弹窗中显示录制切换开关", async ({ page }) => {
      // 为从默认状态（录制开启）开始，清除设置
      await navigateToScenarioSelect(page);
      await page.evaluate(() =>
        window.localStorage.removeItem("videoRecordingEnabled"),
      );

      await navigateToConversationPage(page);
      await openSettingsModal(page);

      // 确认录制切换开关显示
      const recordingToggle = getRecordingToggle(page);
      await expect(recordingToggle).toBeVisible();

      // 确认默认已开启录制（已勾选）
      await expect(recordingToggle).toBeChecked();
    });
  });

  test.describe("录制关闭时的行为", () => {
    test("关闭录制后摄像头预览隐藏", async ({
      page,
    }) => {
      // 为从默认状态（录制开启）开始，清除设置
      await navigateToScenarioSelect(page);
      await page.evaluate(() =>
        window.localStorage.removeItem("videoRecordingEnabled"),
      );

      await navigateToConversationPage(page);

      // 默认（录制开启）时存在摄像头预览（video 元素）
      const cameraPreview = getCameraPreview(page);
      await expect(cameraPreview).toHaveCount(1, { timeout: 10000 });

      // 打开设置弹窗并关闭录制
      await openSettingsModal(page);
      const recordingToggle = getRecordingToggle(page);
      await recordingToggle.uncheck();
      await expect(recordingToggle).not.toBeChecked();

      // 关闭弹窗（Escape 键）
      await page.keyboard.press("Escape");

      // 确认摄像头预览（video 元素）从 DOM 中消失
      await expect(cameraPreview).toHaveCount(0, { timeout: 10000 });
    });

    test("录制关闭时开始按钮无需等待摄像头初始化即立即启用", async ({
      page,
    }) => {
      // 事先在 localStorage 中设置录制关闭（制造完全不等待摄像头初始化的状态）
      await page.addInitScript(() => {
        window.localStorage.setItem("videoRecordingEnabled", "false");
      });

      await navigateToConversationPage(page);

      // 确认开始按钮立即启用（不会等待摄像头初始化）
      const startButton = page.locator(
        '[data-testid="start-conversation-button"]',
      );
      await expect(startButton).toBeVisible({ timeout: 15000 });
      await expect(startButton).toBeEnabled({ timeout: 5000 });

      // 确认按钮标签为「无录制」标识（兼容日英文）
      const buttonText = (await startButton.textContent()) || "";
      expect(
        buttonText.includes("不录制") ||
        buttonText.includes("No Recording"),
      ).toBeTruthy();

      // 确认摄像头预览（video 元素）未显示
      await expect(getCameraPreview(page)).toHaveCount(0);
    });
  });

  test.describe("设置的持久化", () => {
    test("录制关闭设置刷新后仍保留", async ({ page }) => {
      // 为从默认状态（录制开启）开始，清除设置
      await navigateToScenarioSelect(page);
      await page.evaluate(() =>
        window.localStorage.removeItem("videoRecordingEnabled"),
      );

      await navigateToConversationPage(page);

      // 切换为关闭录制
      await openSettingsModal(page);
      const recordingToggle = getRecordingToggle(page);
      await recordingToggle.uncheck();
      await expect(recordingToggle).not.toBeChecked();

      // 确认已持久化到 localStorage
      const storedValue = await page.evaluate(() =>
        window.localStorage.getItem("videoRecordingEnabled"),
      );
      expect(storedValue).toBe("false");

      // 刷新页面（不使用 addInitScript，因此设置会被保留）
      await page.reload();
      await page.waitForURL(/\/conversation\//);

      // 刷新后，确认摄像头预览（video 元素）仍然隐藏
      await expect(getCameraPreview(page)).toHaveCount(0, { timeout: 10000 });

      // 再次打开设置弹窗，确认切换仍处于关闭状态
      await openSettingsModal(page);
      await expect(getRecordingToggle(page)).not.toBeChecked();
    });
  });

  test.describe("会话开始后的设置锁定", () => {
    test("会话开始后录制切换被禁用", async ({ page }) => {
      // 关闭录制，制造无需等待摄像头初始化即可立即开始会话的状态
      await page.addInitScript(() => {
        window.localStorage.setItem("videoRecordingEnabled", "false");
      });

      await navigateToConversationPage(page);

      // 开始会话
      const startButton = page.locator(
        '[data-testid="start-conversation-button"]',
      );
      await expect(startButton).toBeEnabled({ timeout: 15000 });
      await startButton.click();

      // 确认会话已开始（结束会话按钮显示）
      const endButton = page
        .locator(
          'button:has-text("结束会话"), button:has-text("结束商谈"), button:has-text("End Conversation")',
        )
        .first();
      await expect(endButton).toBeVisible({ timeout: 30000 });

      // 打开设置弹窗
      await openSettingsModal(page);

      // 确认会话开始后录制切换已被禁用（disabled）
      await expect(getRecordingToggle(page)).toBeDisabled();
    });
  });
});
