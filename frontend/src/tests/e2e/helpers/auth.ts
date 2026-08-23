/**
 * E2E 测试用认证辅助函数
 *
 * 对预发环境的 Cognito 执行实际登录
 */
import { Page, expect } from "@playwright/test";

// 从环境变量获取认证信息
const TEST_USER_EMAIL = process.env.E2E_TEST_USER_EMAIL || "";
const TEST_USER_PASSWORD = process.env.E2E_TEST_USER_PASSWORD || "";

/**
 * 检查认证信息是否已设置
 */
export function validateAuthConfig(): void {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    throw new Error(
      "未设置 E2E 测试用认证信息。" +
      "请在 .env.test 文件中设置 E2E_TEST_USER_EMAIL 和 E2E_TEST_USER_PASSWORD。"
    );
  }
}

/**
 * 执行 Cognito 登录
 *
 * 使用 AWS Amplify UI 的 Authenticator 组件执行登录流程
 *
 * @param page Playwright 的页面对象
 */
export async function login(page: Page): Promise<void> {
  validateAuthConfig();

  // 访问首页（未认证时显示登录画面）
  await page.goto("/");

  // 等待登录表单显示
  // 假设使用 AWS Amplify UI 的 Authenticator 组件
  const emailInput = page.locator('input[name="username"], input[type="email"]');
  const passwordInput = page.locator('input[name="password"], input[type="password"]');

  // 确认登录表单是否显示
  const isLoginFormVisible = await emailInput.isVisible().catch(() => false);

  if (isLoginFormVisible) {
    // 输入邮箱
    await emailInput.fill(TEST_USER_EMAIL);

    // 输入密码
    await passwordInput.fill(TEST_USER_PASSWORD);

    // 点击登录按钮
    const submitButton = page.locator(
      'button[type="submit"]:has-text("Sign in"), button[type="submit"]:has-text("登录"), button[type="submit"]:has-text("登录")'
    );
    await submitButton.click();

    // 等待登录完成（直到首页内容显示）
    // 确认首页元素显示
    const homeIndicator = page.locator('text=AI 销售角色扮演')
      .or(page.locator('text=开始销售角色扮演'))
      .or(page.locator('button:has-text("首页")'));
    await expect(homeIndicator.first()).toBeVisible({ timeout: 30000 });
  } else {
    // 已登录的情况 - 确认首页显示
    const homeIndicator = page.locator('text=AI 销售角色扮演')
      .or(page.locator('text=开始销售角色扮演'))
      .or(page.locator('button:has-text("首页")'));
    await expect(homeIndicator.first()).toBeVisible({ timeout: 10000 });
  }
}

/**
 * 执行登出
 *
 * @param page Playwright 的页面对象
 */
export async function logout(page: Page): Promise<void> {
  // 打开用户菜单
  const userMenuButton = page.locator(
    'button[aria-label="user account"], button[aria-label="用户账户"]'
  );

  if (await userMenuButton.isVisible()) {
    await userMenuButton.click();

    // 点击登出按钮
    const logoutButton = page.locator('text=退出登录, text=Sign out');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // 等待登出完成（直到登录画面显示）
      await expect(
        page.locator('input[name="username"], input[type="email"]')
      ).toBeVisible({ timeout: 10000 });
    }
  }
}

/**
 * 确认认证状态
 *
 * @param page Playwright 的页面对象
 * @returns 已登录时返回 true
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // 通过用户菜单按钮是否显示来判断
  const userMenuButton = page.locator(
    'button[aria-label="user account"], button[aria-label="用户账户"]'
  );
  return userMenuButton.isVisible();
}
