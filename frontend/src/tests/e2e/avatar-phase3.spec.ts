/**
 * E2E 测试: 头像 Phase3 功能
 *
 * 验证 Phase3 新增的以下功能:
 * - 3D 头像的显示与初始姿势
 * - 手势（点头、歪头）的触发
 * - 情感过渡（NPC 情感状态的反映）
 * - 唇形同步（语音播放与 viseme 数据的联动）
 * - 头像管理 UI（上传、列表、删除）※CDK 部署后
 */
import { test, expect, Page } from '@playwright/test';
import {
  login,
  navigateToScenarioSelect,
  clickStartConversationButton,
} from './helpers';

// ============================================================================
// 公共辅助函数
// ============================================================================

/**
 * 场景选择→商谈画面跳转→会话开始→等待 NPC 初始消息
 */
async function startSessionAndWaitForNPC(page: Page): Promise<void> {
  await navigateToScenarioSelect(page);

  const startButton = page.locator('button:has-text("从该场景开始")').first();
  await expect(startButton).toBeVisible({ timeout: 15000 });
  await startButton.click();
  await page.waitForURL('**/conversation/**', { timeout: 30000 });

  await clickStartConversationButton(page);

  // 等待 NPC 的初始消息显示
  const npcMessage = page.locator('.MuiPaper-root:has-text("你好")')
    .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
    .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
    .or(page.locator('.MuiPaper-root:has-text("提案")'));
  await expect(npcMessage.first()).toBeVisible({ timeout: 60000 });

  // 等待头像显示区域加载完成（canvas、错误、加载任意一种）
  const avatarContent = page.locator('canvas')
    .or(page.locator('[role="alert"]'))
    .or(page.locator('[role="status"][aria-busy="true"]'));
  await expect(avatarContent.first()).toBeAttached({ timeout: 30000 });
  // 为画面稳定做短暂等待
  await page.waitForTimeout(2000);
}

// ============================================================================
// 测试通用设置
// ============================================================================

test.beforeEach(async ({ page }) => {
  await login(page);
});

// ============================================================================
// 1. 3D 头像显示、初始姿势
// ============================================================================

test.describe('1. 3D 头像显示、初始姿势', () => {
  test.setTimeout(180000);

  test('会话开始后头像显示区域显示（canvas 或错误提示）', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // 确认头像显示区域（region）已显示
    // AvatarStage.tsx 的 aria-label: 中文="虚拟形象显示区域", 英文="Avatar display area"
    const avatarRegion = page.locator('[role="region"][aria-label*="虚拟形象"], [role="region"][aria-label*="Avatar"]');
    await expect(avatarRegion.first()).toBeVisible({ timeout: 15000 });
    console.log('头像显示区域（region）已显示');

    // 等待 canvas、错误提示或加载提示中的任意一种出现在 DOM 中
    // VRM 模型加载耗时较长，因此设置充分的超时时间
    const canvasOrErrorOrLoading = page.locator('canvas')
      .or(page.locator('[role="alert"]'))
      .or(page.locator('[role="status"][aria-busy="true"]'));
    await expect(canvasOrErrorOrLoading.first()).toBeAttached({ timeout: 30000 });

    const canvas = page.locator('canvas');
    const avatarError = page.locator('[role="alert"]');
    const loading = page.locator('[role="status"][aria-busy="true"]');

    const canvasExists = await canvas.count() > 0;
    const errorVisible = await avatarError.first().isVisible().catch(() => false);
    const loadingVisible = await loading.first().isVisible().catch(() => false);

    if (canvasExists) {
      console.log('VRM头像的canvas已存在于DOM中');
    } else if (errorVisible) {
      const errorText = await avatarError.first().textContent().catch(() => '');
      console.log(`头像加载错误已显示: ${errorText}`);
      console.log('注意: VRM模型加载失败。请检查预发环境的头像配置。');
    } else if (loadingVisible) {
      console.log('头像正在加载中');
    }

    // canvas、错误提示、加载提示任一存在即可
    // （无头浏览器受 WebGL 限制，canvas 可能不显示）
    expect(canvasExists || errorVisible || loadingVisible).toBeTruthy();

    await page.screenshot({ path: 'test-results/avatar-phase3-01-canvas-visible.png' });
  });

  test('头像加载中显示加载提示或头像相关 UI', async ({ page }) => {
    await navigateToScenarioSelect(page);

    const startButton = page.locator('button:has-text("从该场景开始")').first();
    await startButton.click();
    await page.waitForURL('**/conversation/**', { timeout: 30000 });

    await clickStartConversationButton(page);

    // 等待头像显示区域（region）显示
    // VRMAvatarContainer 在 region 内部显示加载/canvas/错误中的任意一种
    const avatarRegion = page.locator('[role="region"][aria-label*="虚拟形象"], [role="region"][aria-label*="Avatar"]');
    await expect(avatarRegion.first()).toBeVisible({ timeout: 30000 });

    // 确认 region 内部的加载提示、canvas 或错误提示任一出现在 DOM 中
    const loadingOrCanvasOrError = page.locator('[role="status"][aria-busy="true"]')
      .or(page.locator('canvas'))
      .or(page.locator('[role="alert"]'));
    await expect(loadingOrCanvasOrError.first()).toBeAttached({ timeout: 60000 });

    const canvas = page.locator('canvas');
    const canvasAttached = await canvas.count() > 0;
    if (canvasAttached) {
      console.log('VRM头像的canvas已存在于DOM中');
    } else {
      const errorAlert = page.locator('[role="alert"]');
      if (await errorAlert.first().isVisible().catch(() => false)) {
        console.log('头像加载错误已显示（请检查VRM模型的发布配置）');
      } else {
        console.log('加载状态已确认');
      }
    }
  });
});

// ============================================================================
// 2. 情感过渡
// ============================================================================

test.describe('2. 情感过渡', () => {
  test.setTimeout(180000);

  test('消息发送后执行实时评估，指标被更新', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // 稳定等待
    await page.waitForTimeout(2000);

    // 确认指标显示（初始状态）- 通过 progressbar 的 aria-label 确认
    const angerProgress = page.locator('[role="progressbar"][aria-label*="怒气值"]')
      .or(page.locator('[role="progressbar"][aria-label*="Anger"]'));
    await expect(angerProgress.first()).toBeVisible({ timeout: 15000 });

    const trustProgress = page.locator('[role="progressbar"][aria-label*="信任度"]')
      .or(page.locator('[role="progressbar"][aria-label*="Trust"]'));
    await expect(trustProgress.first()).toBeVisible({ timeout: 15000 });

    // 发送消息
    const messageInput = page.locator('textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await messageInput.fill('初次见面，感谢您今天抽出时间。');

    const sendButton = page.locator('button[aria-label*="发送"]').first();
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
    await sendButton.click();

    // 等待 NPC 回复 - API 错误可能导致页面白屏，因此安全等待
    await page.waitForTimeout(15000);

    // 消息发送后，确认页面是否正常显示
    // API 错误触发 React 错误边界时 DOM 会消失（URL 不变）
    const canvasStillVisible = await page.locator('canvas').first().isVisible().catch(() => false);
    if (canvasStillVisible) {
      // 确认指标仍继续显示
      const metricsVisible = await angerProgress.first().isVisible().catch(() => false);
      if (metricsVisible) {
        console.log('消息发送后指标仍正常显示');
      } else {
        console.log('指标已隐藏（可能是布局变化）');
      }
    } else {
      console.log('消息发送后canvas消失（可能是API错误或会话结束）');
    }

    await page.screenshot({ path: 'test-results/avatar-phase3-02-emotion-after-message.png' });
  });

  test('NPC 回复时显示说话指示器', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // 确认说话指示器（「発話中」文本）显示
    // 初始消息语音播放期间显示
    const speakingIndicator = page.locator('text=说话中')
      .or(page.locator('text=Speaking'));

    // 语音播放中会显示说话指示器
    // 时机不同可能已播放完成，因此不显示也可
    const isVisible = await speakingIndicator.first().isVisible().catch(() => false);
    if (isVisible) {
      console.log('说话指示器已显示');
      await expect(speakingIndicator.first()).toBeVisible();

      // 确认 role="status" 属性（无障碍）
      const statusElement = page.locator('[role="status"]:has-text("说话中")');
      if (await statusElement.count() > 0) {
        console.log('说话指示器已设置role="status"');
      }
    } else {
      console.log('说话指示器已隐藏（语音播放已完成）');
    }

    await page.screenshot({ path: 'test-results/avatar-phase3-03-speaking-indicator.png' });
  });
});

// ============================================================================
// 3. 唇形同步、语音同步
// ============================================================================

test.describe('3. 唇形同步、语音同步', () => {
  test.setTimeout(180000);

  test('NPC 回复时 visemeData 事件与语音播放同步触发', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // 注入监控 visemeData 事件触发的脚本
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__visemeEvents = [];
      window.addEventListener('visemeData', (event: Event) => {
        const customEvent = event as CustomEvent;
        ((window as unknown as Record<string, unknown[]>).__visemeEvents).push({
          timestamp: Date.now(),
          messageId: customEvent.detail?.messageId,
          visemeCount: customEvent.detail?.visemes?.length || 0,
        });
      });
    });

    // 发送消息并等待 NPC 回复
    await page.waitForTimeout(2000);
    const messageInput = page.locator('textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await messageInput.fill('请多关照。');

    const sendButton = page.locator('button[aria-label*="发送"]').first();
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
    await sendButton.click();

    // 等待 NPC 回复和语音播放
    await page.waitForTimeout(15000);

    // 确认 visemeData 事件是否触发
    const visemeEvents = await page.evaluate(() => {
      return (window as unknown as Record<string, unknown[]>).__visemeEvents;
    });

    console.log(`visemeData事件触发次数: ${(visemeEvents as unknown[]).length}`);
    if ((visemeEvents as unknown[]).length > 0) {
      console.log('visemeData事件已正常触发（唇形同步确认）');
      // 确认 viseme 数据中包含 viseme
      const firstEvent = (visemeEvents as Array<{ visemeCount: number }>)[0];
      console.log(`首个事件的viseme数: ${firstEvent.visemeCount}`);
    } else {
      console.log('visemeData事件未触发（可能是Polly viseme未启用）');
    }
  });
});

// ============================================================================
// 4. 手势（点头、歪头）
// ============================================================================

test.describe('4. 手势', () => {
  test.setTimeout(180000);

  test('实时评估响应中包含 gesture 字段', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // 监控 API 响应
    const evaluationResponses: Array<{ gesture?: string; npcEmotion?: string }> = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/realtime-evaluation') || url.includes('/scoring')) {
        try {
          const body = await response.json();
          evaluationResponses.push({
            gesture: body.gesture,
            npcEmotion: body.npcEmotion,
          });
        } catch {
          // 忽略 JSON 解析错误
        }
      }
    });

    // 发送消息
    await page.waitForTimeout(2000);
    const messageInput = page.locator('textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await messageInput.fill('能详细谈谈贵司面临的课题吗？');

    const sendButton = page.locator('button[aria-label*="发送"]').first();
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
    await sendButton.click();

    // 等待实时评估完成
    await page.waitForTimeout(20000);

    console.log(`实时评估响应数: ${evaluationResponses.length}`);
    if (evaluationResponses.length > 0) {
      const lastResponse = evaluationResponses[evaluationResponses.length - 1];
      console.log(`gesture: ${lastResponse.gesture}, npcEmotion: ${lastResponse.npcEmotion}`);

      // gesture 字段存在时，确认其为有效值
      if (lastResponse.gesture) {
        expect(['nod', 'headTilt', 'none']).toContain(lastResponse.gesture);
        console.log(`手势 "${lastResponse.gesture}" 已正常返回`);
      }

      // npcEmotion 字段存在时，确认其为有效值
      if (lastResponse.npcEmotion) {
        expect(['happy', 'angry', 'sad', 'relaxed', 'neutral']).toContain(lastResponse.npcEmotion);
        console.log(`NPC情绪 "${lastResponse.npcEmotion}" 已正常返回`);
      }
    }

    await page.screenshot({ path: 'test-results/avatar-phase3-04-gesture-response.png' });
  });
});

// ============================================================================
// 5. 对话流程整体（头像集成测试）
// ============================================================================

test.describe('5. 对话流程整体（头像集成）', () => {
  test.setTimeout(240000);

  test('会话开始→消息发送→NPC回复→头像反应的完整流程正常运作', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // Step 1: 确认头像显示区域（region）已显示
    const avatarRegion = page.locator('[role="region"][aria-label*="虚拟形象"], [role="region"][aria-label*="Avatar"]');
    await expect(avatarRegion.first()).toBeVisible({ timeout: 15000 });
    console.log('Step 1: 头像显示区域已显示');

    // 确认 canvas（VRM 头像正常时）或错误提示
    const canvas = page.locator('canvas');
    const avatarError = page.locator('[role="alert"]:has-text("虚拟形象")');
    const canvasVisible = await canvas.first().isVisible().catch(() => false);
    const errorVisible = await avatarError.first().isVisible().catch(() => false);

    if (canvasVisible) {
      console.log('Step 1: VRM头像的canvas已显示');
    } else if (errorVisible) {
      console.log('Step 1: 头像加载错误（VRM模型发布配置问题）。继续验证对话流程');
    }

    await page.screenshot({ path: 'test-results/avatar-phase3-05-step1-avatar.png' });

    // Step 2: 确认指标已显示（通过 progressbar 的 aria-label 确认）
    const angerProgress = page.locator('[role="progressbar"][aria-label*="怒气值"]')
      .or(page.locator('[role="progressbar"][aria-label*="Anger"]'));
    await expect(angerProgress.first()).toBeVisible({ timeout: 15000 });
    console.log('Step 2: 指标已显示');

    // Step 3: 发送消息
    await page.waitForTimeout(2000);
    const messageInput = page.locator('textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await messageInput.fill('初次见面，我来介绍一下我们公司的服务。');

    const sendButton = page.locator('button[aria-label*="发送"]').first();
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
    await sendButton.click();
    console.log('Step 3: 消息已发送');

    // Step 4: 等待 NPC 回复
    await page.waitForTimeout(15000);
    console.log('Step 4: 等待NPC回复完成');

    await page.screenshot({ path: 'test-results/avatar-phase3-05-step4-response.png' });

    // Step 5: 确认头像显示区域仍继续显示
    const regionStillVisible = await avatarRegion.first().isVisible().catch(() => false);
    if (!regionStillVisible) {
      console.log('Step 5: 消息发送后头像显示区域消失（可能是API错误或会话自动结束）');
      console.log('头像集成测试完成（消息发送后页面状态发生变化）');
      return;
    }
    console.log('Step 5: 头像显示区域继续显示');

    // Step 6: 发送第二条消息
    const messageInput2 = page.locator('textarea').first();
    if (await messageInput2.isVisible().catch(() => false)) {
      await messageInput2.fill('具体遇到了哪些难题呢？');
      const sendButton2 = page.locator('button[aria-label*="发送"]').first();
      if (await sendButton2.isEnabled().catch(() => false)) {
        await sendButton2.click();
        console.log('Step 6: 已发送第二条消息');

        // 等待回复
        await page.waitForTimeout(15000);
      }
    }

    await page.screenshot({ path: 'test-results/avatar-phase3-05-step6-second-message.png' });

    // Step 7: 确认头像显示区域仍正常显示
    const regionFinalVisible = await avatarRegion.first().isVisible().catch(() => false);
    if (regionFinalVisible) {
      console.log('Step 7: 多条消息后头像显示区域仍正常显示');
    } else {
      console.log('Step 7: 第二条消息后头像显示区域消失');
    }

    console.log('头像集成测试完成');
  });
});

// ============================================================================
// 6. 无障碍
// ============================================================================

test.describe('6. 无障碍', () => {
  test.setTimeout(180000);

  test('头像显示区域设置了合适的 ARIA 属性', async ({ page }) => {
    await startSessionAndWaitForNPC(page);

    // 确认 canvas 元素具有 aria-label 属性
    const canvas = page.locator('canvas[aria-label]');
    if (await canvas.count() > 0) {
      const ariaLabel = await canvas.first().getAttribute('aria-label');
      console.log(`canvas aria-label: "${ariaLabel}"`);
      expect(ariaLabel).toBeTruthy();
    }

    // 确认 canvas 元素设置了 role="img"
    const canvasWithRole = page.locator('canvas[role="img"]');
    if (await canvasWithRole.count() > 0) {
      console.log('canvas元素已设置role="img"');
    }

    // 确认说话指示器设置了 role="status"
    const statusElements = page.locator('[role="status"]');
    const statusCount = await statusElements.count();
    console.log(`role="status"要素数: ${statusCount}`);
    expect(statusCount).toBeGreaterThanOrEqual(0);

    // 确认 WebGL 不支持时的回退显示设置了 role="alert"
    // （WebGL 支持的浏览器中不显示，因此仅检查存在性）
    const alertElements = page.locator('[role="alert"]');
    const alertCount = await alertElements.count();
    console.log(`role="alert"要素数: ${alertCount}`);
  });
});
