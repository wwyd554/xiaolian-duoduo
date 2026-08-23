import { Page } from "@playwright/test";

// 测试用的类型定义
interface MockAuthState {
  isSignedIn: boolean;
  user: {
    username: string;
    email: string;
    preferredUsername: string;
  };
}

interface MockWindow {
  mockAuthState: MockAuthState;
  getCurrentUser: () => Promise<MockAuthState["user"]>;
  AuthService?: {
    getInstance: () => unknown;
  };
  Authenticator: unknown;
}

/**
 * AWS Amplify 认证的 mock 函数
 *
 * 测试时用于 mock AWS Amplify 认证的函数
 * @param page Playwright 的页面对象
 */
export async function mockAmplifyAuth(page: Page): Promise<void> {
  // mock Amplify Auth API
  await page.addInitScript(() => {
    // 在全局对象上设置 mock
    (window as unknown as MockWindow).mockAuthState = {
      isSignedIn: true,
      user: {
        username: "testuser",
        email: "test@example.com",
        preferredUsername: "测试用户",
      },
    };

    // mock Auth.getCurrentUser
    (window as unknown as MockWindow).getCurrentUser = () => {
      return Promise.resolve(
        (window as unknown as MockWindow).mockAuthState.user,
      );
    };

    // mock Authenticator 组件
    Object.defineProperty(window, "Authenticator", {
      value: ({ children }: { children: () => unknown }) => {
        if (typeof children === "function") {
          return children();
        }
        return children;
      },
      writable: true,
    });

    // mock AuthService 的 getCurrentUser
    const originalGetInstance = (window as unknown as MockWindow).AuthService
      ?.getInstance;
    if (originalGetInstance) {
      (window as unknown as MockWindow).AuthService = {
        getInstance: () => {
          const instance = originalGetInstance();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (instance as any).getCurrentUser = () =>
            (window as unknown as MockWindow).mockAuthState.user;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (instance as any).isLoggedIn = () =>
            (window as unknown as MockWindow).mockAuthState.isSignedIn;
          return instance;
        },
      };
    }
  });
}
