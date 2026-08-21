import { Page } from "@playwright/test";

// テスト用の型定義
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
 * AWS Amplify認証のモック関数
 *
 * テスト時にAWS Amplify認証をモックするための関数
 * @param page Playwrightのページオブジェクト
 */
export async function mockAmplifyAuth(page: Page): Promise<void> {
  // Amplify Auth APIをモック
  await page.addInitScript(() => {
    // グローバルオブジェクトにモックを設定
    (window as unknown as MockWindow).mockAuthState = {
      isSignedIn: true,
      user: {
        username: "testuser",
        email: "test@example.com",
        preferredUsername: "テストユーザー",
      },
    };

    // Auth.getCurrentUserをモック
    (window as unknown as MockWindow).getCurrentUser = () => {
      return Promise.resolve(
        (window as unknown as MockWindow).mockAuthState.user,
      );
    };

    // Authenticatorコンポーネントをモック
    Object.defineProperty(window, "Authenticator", {
      value: ({ children }: { children: () => unknown }) => {
        if (typeof children === "function") {
          return children();
        }
        return children;
      },
      writable: true,
    });

    // AuthServiceのgetCurrentUserをモック
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
