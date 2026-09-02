/**
 * AuthService.isAdmin() 的测试
 *
 * 测试根据 Cognito ID 令牌的 cognito:groups 声明
 * 判断是否属于管理员组别的逻辑
 */

// mock fetchAuthSession
const mockFetchAuthSession = jest.fn();

jest.mock("aws-amplify/auth", () => ({
  getCurrentUser: jest.fn(),
  fetchAuthSession: (...args: unknown[]) => mockFetchAuthSession(...args),
  signOut: jest.fn(),
  updateUserAttributes: jest.fn(),
  fetchUserAttributes: jest.fn(),
}));

// 本测试只覆盖旧 Cognito 回退分支；隔离使用 Vite import.meta.env 的本地认证模块。
jest.mock("../../services/LocalAuth", () => ({
  loadAuth: jest.fn(() => null),
  clearAuth: jest.fn(),
}));

import { AuthService } from "../../services/AuthService";

describe("AuthService.isAdmin", () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // 重置单例
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AuthService as any).instance = undefined;
    authService = AuthService.getInstance();
  });

  it("属于 admin 组时返回 true", async () => {
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

  it("不属于 admin 组时返回 false", async () => {
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

  it("多个组中包含 admin 时返回 true", async () => {
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

  it("cognito:groups 为空数组时返回 false", async () => {
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

  it("cognito:groups 声明不存在时返回 false", async () => {
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

  it("ID 令牌不存在时返回 false", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {},
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("tokens 不存在时返回 false", async () => {
    mockFetchAuthSession.mockResolvedValue({});

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("fetchAuthSession 抛出错误时返回 false", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("认证错误"));

    // spy console.error 以抑制错误日志输出
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

    const result = await authService.isAdmin();
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  it("cognito:groups 不是数组时返回 false", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": "admin", // 字符串（非数组）
          },
        },
      },
    });

    const result = await authService.isAdmin();
    expect(result).toBe(false);
  });

  it("第二次调用使用缓存，不再次调用 fetchAuthSession", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    // 第 1 次
    const result1 = await authService.isAdmin();
    expect(result1).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);

    // 第 2 次（从缓存返回）
    const result2 = await authService.isAdmin();
    expect(result2).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1); // 调用次数不增加
  });

  it("缓存 TTL 过期后重新调用 fetchAuthSession", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    // 第 1 次
    const result1 = await authService.isAdmin();
    expect(result1).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);

    // 将缓存的时间戳回拨到 5 分钟之前
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authService as any).cachedIsAdminAt = Date.now() - 6 * 60 * 1000;

    // TTL 过期后的调用（重新获取）
    const result2 = await authService.isAdmin();
    expect(result2).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(2); // 重新调用
  });

  it("登出后缓存被清除并重新获取", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["admin"],
          },
        },
      },
    });

    // 第 1 次: admin
    const result1 = await authService.isAdmin();
    expect(result1).toBe(true);
    expect(mockFetchAuthSession).toHaveBeenCalledTimes(1);

    // 登出
    await authService.logout();

    // 登出后: 假定组别已变化
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          payload: {
            "cognito:groups": ["users"],
          },
        },
      },
    });

    // 登出后的调用（缓存已清除，重新获取）
    // 重置单例后重新获取（登出后 cachedIsAdmin 变为 null）
    const result2 = await authService.isAdmin();
    expect(result2).toBe(false);
  });
});
