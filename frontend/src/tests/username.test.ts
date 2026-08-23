import { test, expect } from "@playwright/test";
import { mockAmplifyAuth } from "./mocks/auth-mock";

test.describe("用户名注册、编辑功能", () => {
  // 在预发环境 Amplify 认证 mock 不生效，因此跳过
  // 仅在本地开发环境可运行
  test.skip();

  test.beforeEach(async ({ page }) => {
    // Amplify 认证的 mock
    await mockAmplifyAuth(page);
  });

  test("新用户注册时显示用户名字段", async ({
    page,
  }) => {
    // 访问首页
    await page.goto("/");

    // 跳转到注册页
    await page.locator("text=Sign up").click();

    // 确认存在邮箱输入字段
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // 确认存在用户名输入字段
    await expect(
      page.locator('input[name="preferred_username"]'),
    ).toBeVisible();

    // 确认用户名字段带有标签
    await expect(
      page.locator('label:has-text("Preferred Username")'),
    ).toBeVisible();
  });

  test("在个人资料页面可以编辑用户名", async ({ page }) => {
    // 以已登录状态访问首页
    await page.goto("/");

    // 确认头部显示用户图标
    await expect(
      page.locator('button[aria-label="user account"]'),
    ).toBeVisible();

    // 打开用户菜单
    await page.locator('button[aria-label="user account"]').click();

    // 点击个人资料菜单
    await page.locator("text=个人资料").click();

    // 确认跳转到个人资料页
    await expect(page).toHaveURL(/\/profile/);

    // 确认显示用户名
    await expect(page.locator("text=用户名:")).toBeVisible();

    // 点击编辑按钮
    await page.locator("text=编辑").click();

    // 确认进入编辑模式并显示文本字段
    const usernameField = page.locator('input[type="text"]').first();
    await expect(usernameField).toBeVisible();

    // 修改用户名
    await usernameField.clear();
    await usernameField.fill("新用户名");

    // 点击保存按钮
    await page.locator("text=保存").click();

    // 确认显示成功消息
    await expect(page.locator("text=用户名已更新")).toBeVisible();

    // 确认编辑模式结束并显示新的用户名
    await expect(page.locator("text=新用户名")).toBeVisible();
  });
});
