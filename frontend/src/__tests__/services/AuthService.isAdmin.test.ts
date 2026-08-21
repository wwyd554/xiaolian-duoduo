/**
 * AuthService.isAdmin() のテスト
 *
 * Cognito IDトークンの cognito:groups クレームから
 * 管理者グループ所属を判定するロジックをテストする
 */

// fetchAuthSessionのモック
const mockFetchAuthSession = jest.fn();

jest.mock("aws-amplify/auth", () => ({
  getCurrentUser: jest.fn(),
  fetchAuthSession: (...args: unknown[]) => mockFetchAuthSession(...args),
  signOut: jest.fn(),
  updateUserAttributes: jest.fn(),
  fetchUserAttributes: jest.fn(),
}));

import { AuthService } from "../../services/AuthService";

describe("AuthService.isAdmin", () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // シングルトンをリセット
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AuthService as any).instance = undefined;
    authService = AuthService.getInstance();
  });

  it("adminグループに所属している場合trueを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(true);
  });

  it("adminグループに所属していない場合falseを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["users", "editors"],
          },
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("複数グループにadminが含まれている場合trueを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["users", "admin", "editors"],
          },
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(true);
  });

  it("cognito:groupsが空配列の場合falseを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": [],
          },
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("cognito:groupsクレームが存在しない場合falseを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {},
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("IDトークンが存在しない場合falseを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {},
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("tokensが存在しない場合falseを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("fetchAuthSessionがエラーを投げた場合falseを返す", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("認証エラー"));

    // console.errorをスパイしてエラーログ出力を抑制
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

    const result = await authService.isAdmin();
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  it("cognito:groupsが配列でない場合falseを返す", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": "admin", // 文字列（配列ではない）
          },
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("2回目の呼び出しではキャッシュが使われfetchAuthSessionが再呼び出しされない", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    // 1回目
    const result1 = await authService.isAdmin();
    expect(result1).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);

    // 2回目（キャッシュから返される）
    const result2 = await authService.isAdmin();
    expect(result2).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1); // 呼び出し回数が増えない
  });

  it("キャッシュTTL期限切れ後はfetchAuthSessionが再呼び出しされる", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    // 1回目
    const result1 = await authService.isAdmin();
    expect(result1).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);

    // キャッシュのタイムスタンプを5分以上前に巻き戻す
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authService as any).cachedIsAdminAt = Date.now() - 6 * 60 * 1000;

    // TTL期限切れ後の呼び出し（再取得される）
    const result2 = await authService.isAdmin();
    expect(result2).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(2); // 再呼び出しされる
  });

  it("ログアウト後はキャッシュがクリアされ再取得される", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    // 1回目: admin
    const result1 = await authService.isAdmin();
    expect(result1).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);

    // ログアウト
    await authService.logout();

    // ログアウト後: グループが変わった想定
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["users"],
          },
        },
      },
    });

    // ログアウト後の呼び出し（キャッシュクリア済みなので再取得）
    // シングルトンをリセットして再取得（ログアウトでcachedIsAdminがnullになる）
    const result2 = await authService.isAdmin();
    expect(result2).toBe(false);
  });
});
