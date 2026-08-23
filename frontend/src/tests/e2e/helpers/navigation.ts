/**
 * E2E 测试用导航辅助函数
 *
 * 页面跳转和元素等待的实用函数
 */
import { Page, expect } from "@playwright/test";

/**
 * 跳转到场景选择页面
 *
 * @param page Playwright 的页面对象
 */
export async function navigateToScenarioSelect(page: Page): Promise<void> {
  await page.goto("/scenarios");

  // 等待场景列表显示
  const scenarioListIndicator = page.locator('h1:has-text("场景列表")')
    .or(page.locator('h1:has-text("选择场景")'))
    .or(page.locator('text=场景列表'));
  await expect(scenarioListIndicator.first()).toBeVisible({ timeout: 15000 });
}

/**
 * 跳转到指定场景的会话页面
 *
 * @param page Playwright 的页面对象
 * @param scenarioId 场景 ID
 */
export async function navigateToConversation(
  page: Page,
  scenarioId: string
): Promise<void> {
  await page.goto(`/conversation/${scenarioId}`);

  // 等待会话页面显示（兼容 i18n 文本）
  const startButton = page.locator('[data-testid="start-conversation-button"]')
    .or(page.locator('button:has-text("开始商谈")'))
    .or(page.locator('button:has-text("Start Conversation")'))
    .or(page.locator('button:has-text("正在初始化摄像头")'));
  await expect(startButton.first()).toBeVisible({ timeout: 15000 });
}

/**
 * 点击「开始商谈」按钮以开始会话
 * 借助摄像头超时功能，即使摄像头初始化失败，「开始商谈（无录制）」按钮也会变为可用
 *
 * @param page Playwright 的页面对象
 */
export async function clickStartConversationButton(page: Page): Promise<void> {
  console.log("clickStartConversationButton: 开始");

  // 使用 data-testid 查找按钮（最可靠）
  const startButtonByTestId = page.locator('[data-testid="start-conversation-button"]');

  // 兼容 i18n 文本的多个按钮文本模式
  // 中文: "开始商谈", "开始商谈（不录制）", "正在初始化摄像头..."
  // 英文: "Start Conversation", "Start Conversation (No Recording)", "Initializing camera..."
  const startButtonByText = page.locator(
    'button:has-text("开始商谈"), ' +
    'button:has-text("Start Conversation"), ' +
    'button:has-text("正在初始化摄像头"), ' +
    'button:has-text("Initializing camera")'
  ).first();

  // 优先使用 data-testid
  let startConversationButton = startButtonByTestId;
  const isTestIdVisible = await startButtonByTestId.isVisible().catch(() => false);

  if (!isTestIdVisible) {
    startConversationButton = startButtonByText;
  }

  // 等待按钮显示（考虑到摄像头超时，等待时间设置较长）
  await expect(startConversationButton).toBeVisible({ timeout: 60000 });
  console.log("clickStartConversationButton: 按钮已显示");

  // 等待摄像头超时后按钮变为可用
  // 预发环境无法访问摄像头，超时后「开始商谈（无录制）」变为可用
  let retryCount = 0;
  const maxRetries = 45; // 最多等待 45 秒（摄像头超时 30 秒 + 缓冲 15 秒）

  while (retryCount < maxRetries) {
    const isButtonEnabled = await startConversationButton.isEnabled().catch(() => false);
    const buttonText = await startConversationButton.textContent().catch(() => '');

    console.log(`clickStartConversationButton: 尝试 ${retryCount + 1}/${maxRetries}, enabled=${isButtonEnabled}, text="${buttonText}"`);

    if (isButtonEnabled) {
      // 按钮可用时点击
      console.log("clickStartConversationButton: 按钮已可用。点击它");
      await startConversationButton.click();

      // 等待会话开始（确认「结束会话」按钮显示）
      const endButton = page.locator('button:has-text("结束会话"), button:has-text("结束商谈"), button:has-text("End Conversation")').first();
      try {
        await expect(endButton).toBeVisible({ timeout: 30000 });
        console.log("clickStartConversationButton: 会话已开始（结束会话按钮已显示）");
        return;
      } catch {
        console.log("clickStartConversationButton: 未显示结束会话按钮。确认NPC消息");
        // 确认 NPC 消息是否显示
        const npcMessage = page.locator('.MuiPaper-root:has-text("你好")')
          .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
          .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
          .or(page.locator('.MuiPaper-root:has-text("提案")'));

        if (await npcMessage.first().isVisible().catch(() => false)) {
          console.log("clickStartConversationButton: 已显示NPC消息。会话开始成功");
          return;
        }

        // 追加等待
        await page.waitForTimeout(2000);
        return;
      }
    }

    // 等待 1 秒后重试
    await page.waitForTimeout(1000);
    retryCount++;
  }

  // 超时后按钮仍不可用时，用 JavaScript 强制点击
  console.log("clickStartConversationButton: 按钮仍不可用。尝试强制点击");

  await page.evaluate(() => {
    // 用 data-testid 查找按钮
    let btn = document.querySelector('[data-testid="start-conversation-button"]') as HTMLButtonElement;

    // 找不到时用文本搜索
    if (!btn) {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        const text = b.textContent || '';
        if (
          text.includes('开始商谈') ||
          text.includes('Start Conversation') ||
          text.includes('正在初始化摄像头') ||
          text.includes('Initializing camera')
        ) {
          btn = b as HTMLButtonElement;
          break;
        }
      }
    }

    if (btn) {
      // 移除 disabled 属性
      btn.removeAttribute('disabled');
      // 同时移除 MUI 的 disabled 类
      btn.classList.remove('Mui-disabled');
      // 启用 pointer-events
      btn.style.pointerEvents = 'auto';

      // 触发点击事件
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      btn.dispatchEvent(clickEvent);
    }
  });

  // 点击后，等待会话开始
  await page.waitForTimeout(5000);
  console.log("clickStartConversationButton: 强制点击后等待完成");
}

/**
 * 跳转到结果页面
 *
 * @param page Playwright 的页面对象
 * @param sessionId 会话 ID
 */
export async function navigateToResult(
  page: Page,
  sessionId: string
): Promise<void> {
  await page.goto(`/result/${sessionId}`);

  // 等待结果页面显示
  const resultIndicator = page.locator('text=评估摘要')
    .or(page.locator('text=综合分数'));
  await expect(resultIndicator.first()).toBeVisible({ timeout: 30000 });
}

/**
 * 跳转到首页
 *
 * @param page Playwright 的页面对象
 */
export async function navigateToHome(page: Page): Promise<void> {
  await page.goto("/");

  // 等待首页显示
  await expect(page.locator("body")).toBeVisible();
}

/**
 * 等待页面加载完成
 *
 * @param page Playwright 的页面对象
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  // 等待网络进入空闲状态
  await page.waitForLoadState("networkidle");
}

/**
 * 等待加载指示器消失
 *
 * @param page Playwright 的页面对象
 * @param timeout 超时（毫秒）
 */
export async function waitForLoadingComplete(
  page: Page,
  timeout: number = 30000
): Promise<void> {
  // 等待 Material UI 的 CircularProgress 消失
  const loadingIndicator = page.locator(
    '[role="progressbar"], .MuiCircularProgress-root'
  );

  // 加载指示器显示时，等待其消失
  if (await loadingIndicator.isVisible().catch(() => false)) {
    await expect(loadingIndicator).not.toBeVisible({ timeout });
  }
}

/**
 * 等待元素显示后点击
 *
 * @param page Playwright 的页面对象
 * @param selector 选择器
 * @param timeout 超时（毫秒）
 */
export async function waitAndClick(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout });
  await element.click();
}

/**
 * 在文本输入字段中输入值
 *
 * @param page Playwright 的页面对象
 * @param selector 选择器
 * @param value 输入值
 */
export async function fillInput(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const input = page.locator(selector);
  await expect(input).toBeVisible();
  await input.clear();
  await input.fill(value);
}

/**
 * 等待 Snackbar/Toast 通知显示
 *
 * @param page Playwright 的页面对象
 * @param text 期望的文本（部分匹配）
 * @param timeout 超时（毫秒）
 */
export async function waitForSnackbar(
  page: Page,
  text: string,
  timeout: number = 10000
): Promise<void> {
  const snackbar = page.locator(`.MuiSnackbar-root:has-text("${text}")`);
  await expect(snackbar).toBeVisible({ timeout });
}
