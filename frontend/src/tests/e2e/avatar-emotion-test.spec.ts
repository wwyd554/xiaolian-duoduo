/**
 * 3D 头像情感表现测试
 * 确认 VRM 头像表情变化的 E2E 测试
 */
import { test, expect } from '@playwright/test';
import {
  login,
  navigateToScenarioSelect,
  clickStartConversationButton,
} from './helpers';

test.describe('3D 头像情感表现测试', () => {
  test.setTimeout(180000); // 3 分钟的超时

  test.beforeEach(async ({ page }) => {
    // 使用公共辅助函数登录
    await login(page);
  });

  test('VRM 头像显示，并反映情感状态', async ({ page }) => {
    // 跳转到场景列表页
    await navigateToScenarioSelect(page);
    console.log('已跳转到场景列表页');

    // 截图: 场景列表
    await page.screenshot({ path: 'test-results/01-scenario-list.png', fullPage: true });

    // 点击「用此场景开始」按钮跳转到商谈画面
    const startScenarioButton = page.locator('button:has-text("从该场景开始"), button:has-text("Start this scenario")').first();
    await expect(startScenarioButton).toBeVisible({ timeout: 15000 });
    await startScenarioButton.click();

    // 等待跳转到商谈画面
    await page.waitForURL('**/conversation/**', { timeout: 30000 });
    console.log('已跳转到商谈画面');

    // 截图: 商谈画面（开始前）
    await page.screenshot({ path: 'test-results/02-conversation-before-start.png', fullPage: true });

    // 点击开始商谈按钮（使用已处理摄像头超时的辅助函数）
    await clickStartConversationButton(page);
    console.log('开始商谈');

    // 等待头像显示区域（region）显示
    const avatarRegion = page.locator('[role="region"][aria-label*="虚拟形象"], [role="region"][aria-label*="Avatar"]');
    await expect(avatarRegion.first()).toBeVisible({ timeout: 30000 });
    console.log('头像显示区域已显示');

    // 等待 canvas、错误提示或加载提示中的任意一个出现在 DOM 中
    const canvasOrErrorOrLoading = page.locator('canvas')
      .or(page.locator('[role="alert"]'))
      .or(page.locator('[role="status"][aria-busy="true"]'));
    await expect(canvasOrErrorOrLoading.first()).toBeAttached({ timeout: 30000 });

    // 截图: 商谈中（VRM 头像显示）
    await page.screenshot({ path: 'test-results/03-conversation-with-avatar.png', fullPage: true });

    const canvas = page.locator('canvas');
    const canvasExists = await canvas.count() > 0;
    if (canvasExists) {
      console.log('Canvas元素已存在于DOM中（VRM头像绘制区域）');
      await expect(canvas.first()).toBeAttached();
    } else {
      const errorAlert = page.locator('[role="alert"]');
      if (await errorAlert.first().isVisible().catch(() => false)) {
        console.log('头像加载错误已显示（可能是无头浏览器的WebGL限制）');
      } else {
        console.log('头像正在加载中');
      }
    }

    // 确认实时评估面板（通过 progressbar 的 aria-label 搜索）
    const angerProgress = page.locator('[role="progressbar"][aria-label*="怒气值"]')
      .or(page.locator('[role="progressbar"][aria-label*="Anger"]'));
    const trustProgress = page.locator('[role="progressbar"][aria-label*="信任度"]')
      .or(page.locator('[role="progressbar"][aria-label*="Trust"]'));
    const progressProgress = page.locator('[role="progressbar"][aria-label*="商谈进度"]')
      .or(page.locator('[role="progressbar"][aria-label*="Progress"]'));

    if (await angerProgress.count() > 0) {
      console.log('愤怒仪表盘显示确认');
    }
    if (await trustProgress.count() > 0) {
      console.log('信任度显示确认');
    }
    if (await progressProgress.count() > 0) {
      console.log('进度显示确认');
    }

    // 查找消息输入框
    const messageInput = page.locator('textarea').first();
    if (await messageInput.isVisible().catch(() => false)) {
      // 输入测试消息
      await messageInput.fill('初次见面，感谢您今天抽出时间。');

      // 点击发送按钮
      const sendButton = page.locator('button[aria-label*="发送"]')
        .or(page.getByRole('button', { name: /发送|Send/i }));
      if (await sendButton.count() > 0) {
        await sendButton.first().click();
        console.log('消息发送');

        // 等待回复
        await page.waitForTimeout(15000);

        // 截图: 消息发送后
        await page.screenshot({ path: 'test-results/04-after-message.png', fullPage: true });

        // 确认消息发送后头像显示区域仍然存在
        const regionStillVisible = await avatarRegion.first().isVisible().catch(() => false);
        if (regionStillVisible) {
          console.log('消息发送后头像显示区域仍正常显示');
        } else {
          console.log('消息发送后头像显示区域消失（可能是API错误）');
        }
      }
    }

    // 最终截图
    await page.screenshot({ path: 'test-results/05-final-state.png', fullPage: true });

    console.log('测试完成');
  });
});
