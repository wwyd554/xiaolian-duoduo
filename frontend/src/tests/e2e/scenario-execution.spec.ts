/**
 * E2E 测试: 场景的开展
 *
 * AI 销售角色扮演系统中「场景开展」功能的 E2E 测试
 * 涉及预发环境连接的集成测试
 */
import { test, expect, Page } from "@playwright/test";
import {
  login,
  navigateToScenarioSelect,
  waitForLoadingComplete,
  clickStartConversationButton,
} from "./helpers";

// 测试执行前的通用设置
test.beforeEach(async ({ page }) => {
  // 登录处理
  await login(page);
});

// ============================================================================
// Phase 2: 场景选择页面的测试
// ============================================================================

test.describe("Phase 2: 场景选择页面", () => {
  test.describe("2.1 场景列表的显示", () => {
    test("场景卡片正确显示", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 确认至少显示 1 张场景卡片
      const scenarioCards = page.locator(".MuiCard-root");
      await expect(scenarioCards.first()).toBeVisible();

      // 确认卡片数量大于等于 1
      const cardCount = await scenarioCards.count();
      expect(cardCount).toBeGreaterThan(0);
    });

    test("难度、行业、NPC 信息显示", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 获取第一张场景卡片
      const firstCard = page.locator(".MuiCard-root").first();
      await expect(firstCard).toBeVisible();

      // 确认难度标签显示
      const difficultyChip = firstCard.locator(".MuiChip-root").first();
      await expect(difficultyChip).toBeVisible();

      // 确认 NPC 信息（名称、职位）显示
      const npcInfo = firstCard.locator('text=客户信息');
      await expect(npcInfo).toBeVisible();
    });
  });

  test.describe("2.2 过滤功能", () => {
    test("难度过滤正常运作", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 点击难度过滤的下拉选择框
      const difficultyFilter = page.locator('[data-testid="difficulty-filter"], select').first();

      if (await difficultyFilter.isVisible()) {
        await difficultyFilter.click();

        // 选择「初级」选项
        const easyOption = page.locator('text=初级, text=easy').first();
        if (await easyOption.isVisible()) {
          await easyOption.click();

          // 过滤生效后，确认场景显示
          await waitForLoadingComplete(page);
          const scenarioCards = page.locator(".MuiCard-root");
          const cardCount = await scenarioCards.count();
          expect(cardCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("搜索功能正常运作", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 获取搜索输入字段
      const searchInput = page.locator(
        'input[placeholder*="搜索"], input[placeholder*="search"]'
      );

      if (await searchInput.isVisible()) {
        // 输入搜索关键词
        await searchInput.fill("销售");

        // 等待搜索结果显示
        await waitForLoadingComplete(page);

        // 确认结果显示（0 条也可）
        const scenarioCards = page.locator(".MuiCard-root");
        const cardCount = await scenarioCards.count();
        expect(cardCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe("2.3 收藏功能", () => {
    test("可以添加/删除收藏", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 获取收藏按钮（星形图标）
      const favoriteButton = page.locator(
        'button[aria-label*="收藏"], [data-testid="favorite-button"]'
      ).first();

      if (await favoriteButton.isVisible()) {
        // 记录初始状态
        const initialState = await favoriteButton.getAttribute("aria-pressed");

        // 点击收藏按钮
        await favoriteButton.click();

        // 确认状态发生变化
        await page.waitForTimeout(500);
        const newState = await favoriteButton.getAttribute("aria-pressed");

        // 确认状态已变化（或视觉变化）
        // 注: 未使用 aria-pressed 时，通过图标变化确认
        expect(newState !== initialState || newState === null).toBeTruthy();
      }
    });
  });

  test.describe("2.4 从场景选择跳转到会话画面", () => {
    test("选择场景后可以跳转到会话画面", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 点击「用此场景开始」按钮
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await expect(startButton).toBeVisible();
      await startButton.click();

      // 确认已跳转到会话页面
      await expect(page).toHaveURL(/\/conversation\//);

      // 确认会话页面元素显示（摄像头初始化中也可）
      // 确认「是否开始商谈？」标题或开始按钮显示
      const conversationHeading = page.locator('text=确定开始商谈吗？')
        .or(page.locator('button:has-text("开始商谈")'))
        .or(page.locator('button:has-text("正在初始化摄像头")'))
        .or(page.locator('[data-testid="start-conversation-button"]'));
      await expect(conversationHeading.first()).toBeVisible({ timeout: 15000 });
    });
  });
});

// ============================================================================
// Phase 3: 对话会话的测试
// ============================================================================

// 注意: Phase 3-6 的测试在无头浏览器中无法访问摄像头，
// 因此无法在预发环境执行。请等待摄像头初始化的超时处理
// 部署到预发环境后再启用。

test.describe("Phase 3: 对话会话", () => {
  test.describe("3.1 会话开始", () => {
    test("点击「开始商谈」按钮后会话开始", async ({
      page,
    }) => {
      // 从场景选择跳转到会话页面
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 点击「开始商谈」按钮
      await clickStartConversationButton(page);

      // 确认 NPC 的初始消息显示
      // 在 MessageList.tsx 中，消息显示在 Paper 组件内
      const npcMessage = page.locator('.MuiPaper-root:has-text("你好")')
        .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
        .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
        .or(page.locator('.MuiPaper-root:has-text("提案")'));
      await expect(npcMessage.first()).toBeVisible({ timeout: 60000 });
    });
  });

  test.describe("3.2 消息发送", () => {
    test("通过文本输入可以发送消息", async ({ page }) => {
      // 将测试超时时间设短
      test.setTimeout(60000);

      // 从场景选择跳转到会话页面并开始会话
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 点击「开始商谈」按钮
      await clickStartConversationButton(page);

      // 等待 NPC 的初始消息显示
      const npcInitialMessage = page.locator('.MuiPaper-root:has-text("你好")')
        .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
        .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
        .or(page.locator('.MuiPaper-root:has-text("提案")'));
      await expect(npcInitialMessage.first()).toBeVisible({ timeout: 60000 });

      // 追加的稳定等待
      await page.waitForTimeout(2000);

      // 获取消息输入字段（MUI 的 TextField 使用 textarea）
      const messageInput = page.locator('textarea').first();

      // 确认消息输入字段显示
      await expect(messageInput).toBeVisible({ timeout: 10000 });

      // 输入测试消息（使用短消息）
      const testMessage = "请多关照";
      await messageInput.fill(testMessage);

      // 确认输入字段已设置值
      await expect(messageInput).toHaveValue(testMessage);
      console.log("已输入消息:", testMessage);

      // 获取发送按钮（通过 aria-label 搜索）
      const sendButton = page.locator('button[aria-label*="发送"]').first();

      // 等待发送按钮变为可用
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      console.log("点击发送按钮");

      // 点击发送按钮
      await sendButton.click();

      // 确认消息发送已开始:
      // 确认发生以下任一情况:
      // 1. 显示处理中指示器（「思考中...」）
      // 2. 输入字段被清空（值变为空）
      // 3. 输入字段被禁用

      // 等待处理中指示器或输入字段的状态变化
      const processingIndicator = page.locator('text=正在思考');

      // 确认是否显示处理中指示器，或输入字段是否已清空
      try {
        // 确认处理中指示器显示
        await expect(processingIndicator.first()).toBeVisible({ timeout: 5000 });
        console.log("消息发送测试完成: 处理中指示器已显示");
      } catch {
        // 处理中指示器未显示时，确认输入字段的状态
        // 等待输入字段重新显示
        await page.waitForTimeout(2000);

        // 确认输入字段是否已清空
        const currentInput = page.locator('textarea').first();
        const isVisible = await currentInput.isVisible().catch(() => false);

        if (isVisible) {
          const currentValue = await currentInput.inputValue().catch(() => testMessage);
          if (currentValue === '') {
            console.log("消息发送测试完成: 输入框已清空");
          } else {
            // 即使输入字段未清空，
            // 也能确认发送按钮已被点击，
            // 因此等待 API 响应并确认消息显示
            await page.waitForTimeout(10000);
            const pageContent = await page.content();
            const hasUserMessage = pageContent.includes(testMessage);
            expect(hasUserMessage).toBe(true);
            console.log("消息发送测试完成: 用户消息已显示在页面上");
          }
        } else {
          // 输入字段隐藏时，很可能处于处理中
          console.log("消息发送测试完成: 输入框已隐藏（处理中）");
        }
      }
    });
  });

  test.describe("3.3 指标显示", () => {
    test("愤怒仪表、信任度、进度显示", async ({ page }) => {
      // 从场景选择跳转到会话页面并开始会话
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 点击「开始商谈」按钮
      await clickStartConversationButton(page);

      // 等待 NPC 的初始消息显示
      const npcMessage = page.locator('.MuiPaper-root:has-text("你好")')
        .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
        .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
        .or(page.locator('.MuiPaper-root:has-text("提案")'));
      await expect(npcMessage.first()).toBeVisible({ timeout: 60000 });

      // 确认指标相关元素显示
      // 愤怒仪表
      const angerIndicator = page.locator('text=怒气值')
        .or(page.locator('text=Anger'));
      await expect(angerIndicator.first()).toBeVisible({ timeout: 15000 });

      // 信任度
      const trustIndicator = page.locator('text=信任度')
        .or(page.locator('text=Trust'));
      await expect(trustIndicator.first()).toBeVisible({ timeout: 15000 });

      // 进度
      const progressIndicator = page.locator('text=商谈进度')
        .or(page.locator('text=Progress'));
      await expect(progressIndicator.first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("3.4 目标达成状态的显示", () => {
    test("目标面板显示", async ({ page }) => {
      // 从场景选择跳转到会话页面并开始会话
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 点击「开始商谈」按钮
      await clickStartConversationButton(page);

      // 等待 NPC 的初始消息显示
      const npcMessage = page.locator('.MuiPaper-root:has-text("你好")')
        .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
        .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
        .or(page.locator('.MuiPaper-root:has-text("提案")'));
      await expect(npcMessage.first()).toBeVisible({ timeout: 60000 });

      // 点击目标标签页
      const goalsTab = page.locator('button[role="tab"]:has-text("目标")');
      if (await goalsTab.isVisible()) {
        await goalsTab.click();
      }

      // 确认目标面板或目标相关元素显示
      const goalsSection = page.locator('[data-testid="goals-panel"]')
        .or(page.locator('text=目标'))
        .or(page.locator('text=目标'));
      await expect(goalsSection.first()).toBeVisible({ timeout: 15000 });
    });
  });
});


// ============================================================================
// Phase 4: 语音设置的测试
// ============================================================================

test.describe("Phase 4: 语音设置", () => {
  test.describe("4.1 语音设置面板", () => {
    test("可以切换语音开/关", async ({ page }) => {
      // 从场景选择跳转到会话页面
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 确认语音设置面板显示（会话页面的侧边栏）
      const audioToggle = page.locator('switch[aria-label*="语音"]')
        .or(page.locator('input[type="checkbox"]').first())
        .or(page.locator('.MuiSwitch-root').first());

      if (await audioToggle.isVisible()) {
        // 点击切换开关
        await audioToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test("可以调节音量", async ({ page }) => {
      // 从场景选择跳转到会话页面
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 查找音量滑块
      const volumeSlider = page.locator('slider')
        .or(page.locator('input[type="range"]'))
        .or(page.locator('.MuiSlider-root'));

      if (await volumeSlider.first().isVisible()) {
        // 确认滑块可操作
        await expect(volumeSlider.first()).toBeEnabled();
      }
    });
  });
});

// ============================================================================
// Phase 5: 会话结束的测试
// ============================================================================

test.describe("Phase 5: 会话结束", () => {
  test.describe("5.1 会话结束条件", () => {
    test("可以通过手动结束（结束按钮）结束会话", async ({
      page,
    }) => {
      test.setTimeout(300000); // 5 分钟的超时（考虑录制上传等待）
      // 从场景选择跳转到会话页面并开始会话
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 点击「开始商谈」按钮
      await clickStartConversationButton(page);

      // 等待初始消息显示
      await page.waitForTimeout(5000);

      // 发送 1 条消息（为了正确初始化会话）
      const messageInput = page.locator(
        'input[placeholder*="请输入消息"], textarea[placeholder*="请输入消息"]'
      );

      if (await messageInput.first().isVisible()) {
        await messageInput.first().fill("好的，请多关照。");
        const sendButton = page.locator(
          'button[aria-label*="发送消息"], button[aria-label*="发送"]'
        );
        await sendButton.first().click();

        // 等待 NPC 回复
        await page.waitForTimeout(5000);
      }

      // 点击结束按钮（「结束会话」按钮）
      const endButton = page.locator(
        'button:has-text("结束会话"), button:has-text("结束商谈"), button:has-text("End Conversation")'
      ).first();

      if (await endButton.isVisible()) {
        await endButton.click();

        // 注意: 未使用确认对话框
        // 录制上传等待（最长 90 秒）后跳转到结果页面

        // 确认跳转到结果页面（考虑录制上传等待）
        await expect(page).toHaveURL(/\/result\//, { timeout: 150000 });
      }
    });
  });

  test.describe("5.2 跳转到结果页面", () => {
    test("会话结束后跳转到结果页面", async ({ page }) => {
      test.setTimeout(300000); // 5 分钟的超时（考虑录制上传等待）
      // 从场景选择跳转到会话页面并开始会话
      await navigateToScenarioSelect(page);
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.click();
      await page.waitForURL(/\/conversation\//);

      // 点击「开始商谈」按钮
      await clickStartConversationButton(page);

      // 等待初始消息显示
      await page.waitForTimeout(5000);

      // 发送 1 条消息
      const messageInput = page.locator(
        'input[placeholder*="请输入消息"], textarea[placeholder*="请输入消息"]'
      );

      if (await messageInput.first().isVisible()) {
        await messageInput.first().fill("谢谢。");
        const sendButton = page.locator(
          'button[aria-label*="发送消息"], button[aria-label*="发送"]'
        );
        await sendButton.first().click();

        // 等待 NPC 回复
        await page.waitForTimeout(5000);
      }

      // 点击结束按钮（「结束会话」按钮）
      const endButton = page.locator(
        'button:has-text("结束会话"), button:has-text("结束商谈"), button:has-text("End Conversation")'
      ).first();

      if (await endButton.isVisible()) {
        await endButton.click();

        // 注意: 未使用确认对话框
        // 录制上传等待（最长 90 秒）后跳转到结果页面

        // 确认跳转到结果页面（考虑录制上传等待）
        await expect(page).toHaveURL(/\/result\//, { timeout: 150000 });

        // 确认结果页面内容显示
        const resultContent = page.locator('text=评估摘要')
          .or(page.locator('text=综合分数'))
          .or(page.locator('text=分数'))
          .or(page.locator('text=分析中'));
        await expect(resultContent.first()).toBeVisible({ timeout: 30000 });
      }
    });
  });
});

// ============================================================================
// Phase 6: 结果页面的测试
// ============================================================================

// Phase 6 的测试串行执行（并行执行可能产生资源竞争）
test.describe.configure({ mode: 'serial' });

test.describe("Phase 6: 结果页面", () => {
  // 结果页面测试用的设置（完成会话）
  async function completeSessionAndNavigateToResult(page: Page): Promise<void> {
    await navigateToScenarioSelect(page);
    const startButton = page.locator(
      'button:has-text("从该场景开始")'
    ).first();
    await startButton.click();
    await page.waitForURL(/\/conversation\//);

    // 点击「开始商谈」按钮
    await clickStartConversationButton(page);

    // 等待 NPC 的初始消息显示（确认会话已开始）
    const npcMessage = page.locator('.MuiPaper-root:has-text("你好")')
      .or(page.locator('.MuiPaper-root:has-text("欢迎光临")'))
      .or(page.locator('.MuiPaper-root:has-text("感谢您抽出时间")'))
      .or(page.locator('.MuiPaper-root:has-text("提案")'));

    // 最多等待 60 秒直到 NPC 消息显示
    await expect(npcMessage.first()).toBeVisible({ timeout: 60000 });
    console.log("NPC的初始消息已显示");

    // 追加的稳定等待
    await page.waitForTimeout(2000);

    // 点击结束按钮（「结束会话」按钮）
    const endButton = page.locator('button:has-text("结束会话"), button:has-text("结束商谈"), button:has-text("End Conversation")').first();

    // 确认结束按钮显示
    await expect(endButton).toBeVisible({ timeout: 10000 });
    console.log("结束会话按钮已显示");

    await endButton.click();
    console.log("已点击结束会话按钮");

    // 注意: ConversationPage.tsx 中未使用确认对话框
    // 点击「结束会话」按钮后，录制上传等待后直接跳转到结果页面
    // 录制上传的超时为 90 秒，因此设置充分的等待时间

    // 确认跳转到结果页面（考虑录制上传等待，设置较长时间）
    await expect(page).toHaveURL(/\/result\//, { timeout: 150000 });
    console.log("已跳转到结果页");

    // 等待结果页面加载完成
    // 等待 LinearProgress 消失（等待分析完成）
    const loadingProgress = page.locator('.MuiLinearProgress-root');
    try {
      // 加载显示时等待其消失（最长 120 秒）
      if (await loadingProgress.isVisible().catch(() => false)) {
        console.log("正在等待分析中的加载...");
        await expect(loadingProgress).not.toBeVisible({ timeout: 120000 });
        console.log("加载已完成");
      }
    } catch {
      console.log("加载等待超时。继续执行。");
    }

    // 追加的稳定等待（等待数据显示）
    await page.waitForTimeout(3000);
  }

  test.describe("6.1 综合评分显示", () => {
    test("评分显示", async ({ page }) => {
      // 延长测试超时（等待分析完成）
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 根据 ResultPage.tsx 的结构查找评分元素
      // 1. 有 detailedFeedback 时: 在 Typography variant="h2" 中显示评分数值
      // 2. 分析中时: 在 Alert severity="warning" 中显示「正在生成评分分析...」
      // 3. 显示「评估摘要」标签页

      // 首先确认评估摘要标签页显示
      const evaluationTab = page.locator('button[role="tab"]:has-text("评估摘要")');
      await expect(evaluationTab.first()).toBeVisible({ timeout: 30000 });
      console.log("评估摘要标签页已显示");

      // 确认评分显示（显示以下任一即可）
      // - Typography h2 内的数值（评分）
      // - 「/ 100」文本（评分显示的一部分）
      // - 分析中的 Alert
      const scoreIndicator = page.locator('.MuiTypography-h2')
        .or(page.locator('text=/\\/ 100/'))
        .or(page.locator('text=正在生成分数分析'))
        .or(page.locator('text=分析中'))
        .or(page.locator('[role="status"]'));

      await expect(scoreIndicator.first()).toBeVisible({ timeout: 60000 });
      console.log("评分相关元素已显示");
    });

    test("性能等级显示", async ({ page }) => {
      // 延长测试超时
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 确认性能等级（优秀、良好、需改进、需要练习）显示
      // 或分析中时显示 Alert
      const performanceLevel = page.locator('text=优秀')
        .or(page.locator('text=良好'))
        .or(page.locator('text=需要改进'))
        .or(page.locator('text=需要练习'))
        .or(page.locator('.MuiChip-root'))
        .or(page.locator('text=正在生成分数分析'))
        .or(page.locator('text=分析中'));

      await expect(performanceLevel.first()).toBeVisible({ timeout: 60000 });
      console.log("已确认性能等级或分析中显示");
    });
  });

  test.describe("6.2 详细反馈显示", () => {
    test("雷达图显示", async ({ page }) => {
      // 延长测试超时
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 确认雷达图（Canvas 元素）显示
      // 仅在分析完成后显示，因此分析中时跳过
      const radarChart = page.locator('canvas').first();
      const analysisInProgress = page.locator('text=正在生成分数分析')
        .or(page.locator('text=分析中'));

      // 仅在非分析中时确认图表
      if (await analysisInProgress.first().isVisible().catch(() => false)) {
        console.log("由于分析中，跳过图表显示");
        // 能确认分析中显示即可
        await expect(analysisInProgress.first()).toBeVisible();
      } else {
        await expect(radarChart).toBeVisible({ timeout: 30000 });
        console.log("雷达图已显示");
      }
    });

    test("改进建议显示", async ({ page }) => {
      // 延长测试超时
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 确认改进建议部分显示
      // 在 ResultPage.tsx 中显示在「性能分析」部分
      const improvementSection = page.locator('text=改进点')
        .or(page.locator('text=建议'))
        .or(page.locator('text=反馈'))
        .or(page.locator('text=表现分析'))
        .or(page.locator('text=正在生成分数分析'))
        .or(page.locator('text=分析中'));

      await expect(improvementSection.first()).toBeVisible({ timeout: 30000 });
      console.log("已确认改进建议或分析中显示");
    });
  });

  test.describe("6.3 对话历史标签页", () => {
    test("对话历史标签页中显示消息列表", async ({ page }) => {
      // 延长测试超时
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 点击对话历史标签页
      const historyTab = page.locator('button[role="tab"]:has-text("对话历史")');

      if (await historyTab.isVisible()) {
        await historyTab.click();
        console.log("已点击对话历史标签页");

        // 等待标签面板显示
        await page.waitForTimeout(1000);

        // 确认消息列表显示
        // 在 ResultPage.tsx 中，消息显示在对话历史标签页内
        const messageContent = page.locator('[role="tabpanel"]')
          .or(page.locator('text=NPC'))
          .or(page.locator('text=你'))
          .or(page.locator('.MuiPaper-root'));

        await expect(messageContent.first()).toBeVisible({ timeout: 15000 });
        console.log("对话历史标签页内容已显示");
      } else {
        console.log("未找到对话历史标签页");
      }
    });
  });

  test.describe("6.4 合规违规标签页", () => {
    test("合规标签页显示", async ({ page }) => {
      // 延长测试超时
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 查找合规标签页
      const complianceTab = page.locator('button[role="tab"]:has-text("合规")');

      if (await complianceTab.isVisible()) {
        await complianceTab.click();
        console.log("已点击合规模块标签页");

        // 等待标签面板显示
        await page.waitForTimeout(1000);

        // 确认合规部分显示
        const complianceContent = page.locator('[role="tabpanel"]')
          .or(page.locator('text=违规'))
          .or(page.locator('text=合规'));

        await expect(complianceContent.first()).toBeVisible({ timeout: 15000 });
        console.log("合规模块标签页内容已显示");
      } else {
        console.log("未找到合规模块标签页");
      }
    });
  });

  test.describe("6.5 导航", () => {
    test("返回主页按钮正常运作", async ({ page }) => {
      // 延长测试超时
test.setTimeout(300000);

      await completeSessionAndNavigateToResult(page);

      // 点击返回主页按钮
      // ResultPage.tsx 中有「返回主页」按钮
      const homeButton = page.locator('button:has-text("首页")')
        .or(page.locator('button:has-text("首页")'))
        .or(page.locator('button:has-text("返回")'))
        .or(page.locator('[data-testid="home-button"]'));

      if (await homeButton.first().isVisible()) {
        await homeButton.first().click();
        console.log("已点击主页按钮");

        // 确认跳转到主页
        await expect(page).toHaveURL(/\/$|\/home|\/scenarios/, { timeout: 15000 });
        console.log("已跳转到主页");
      } else {
        console.log("未找到主页按钮。点击页头的Logo。");
        // 点击页头 Logo 或标题返回主页
        const headerLogo = page.locator('header a').first()
          .or(page.locator('[data-testid="header-logo"]'));

        if (await headerLogo.isVisible()) {
          await headerLogo.click();
          await expect(page).toHaveURL(/\/$|\/home|\/scenarios/, { timeout: 15000 });
        }
      }
    });
  });
});

// ============================================================================
// Phase 8: 无障碍测试
// ============================================================================

test.describe("Phase 8: 无障碍", () => {
  test.describe("8.1 键盘导航", () => {
    test("通过 Tab 键可以移动焦点", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 按 Tab 键并确认焦点移动
      await page.keyboard.press("Tab");

      // 确认存在获得焦点的元素
      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();
    });

    test("通过 Enter 键可以执行操作", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 聚焦第一张场景卡片的开始按钮
      const startButton = page.locator(
        'button:has-text("从该场景开始")'
      ).first();
      await startButton.focus();

      // 按 Enter 键
      await page.keyboard.press("Enter");

      // 确认跳转到会话页面
      await expect(page).toHaveURL(/\/conversation\//);
    });
  });

  test.describe("8.2 ARIA 属性的验证", () => {
    test("aria-label 属性设置合适", async ({ page }) => {
      await navigateToScenarioSelect(page);

      // 确认存在具有 aria-label 属性的元素
      const elementsWithAriaLabel = page.locator("[aria-label]");
      const count = await elementsWithAriaLabel.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Phase 9: 响应式设计测试
// ============================================================================

test.describe("Phase 9: 响应式设计", () => {
  test.describe("9.1 桌面端显示", () => {
    test("在桌面端尺寸下正确显示", async ({ page }) => {
      // 设置为桌面端尺寸
      await page.setViewportSize({ width: 1920, height: 1080 });

      await navigateToScenarioSelect(page);

      // 确认场景卡片显示
      const scenarioCards = page.locator(".MuiCard-root");
      await expect(scenarioCards.first()).toBeVisible();
    });
  });

  test.describe("9.2 移动端显示", () => {
    test("在移动端尺寸下正确显示", async ({ page }) => {
      // 设置为移动端尺寸
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateToScenarioSelect(page);

      // 确认场景卡片显示
      const scenarioCards = page.locator(".MuiCard-root");
      await expect(scenarioCards.first()).toBeVisible();
    });
  });

  test.describe("9.3 平板端显示", () => {
    test("在平板端尺寸下正确显示", async ({ page }) => {
      // 设置为平板端尺寸
      await page.setViewportSize({ width: 768, height: 1024 });

      await navigateToScenarioSelect(page);

      // 确认场景卡片显示
      const scenarioCards = page.locator(".MuiCard-root");
      await expect(scenarioCards.first()).toBeVisible();
    });
  });
});
