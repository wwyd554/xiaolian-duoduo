/**
 * 本地认证工具 —— 邀请码制（替代原 Cognito/aws-amplify 认证）
 *
 * 注册成功后 JWT 等凭据存 localStorage，ApiService/AuthService 均从此读取。
 */
const AUTH_STORAGE_KEY = "sales_roleplay_auth";

export interface LocalAuthData {
  token: string;
  userId: string;
  nickname: string;
  isAdmin: boolean;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
}

/** 本地后端地址（开发期默认本机；部署时通过 VITE_LOCAL_BACKEND_URL 覆盖） */
export const LOCAL_BACKEND_URL =
  (import.meta.env.VITE_LOCAL_BACKEND_URL as string | undefined) ||
  "http://127.0.0.1:8000";

/** 开发期认证绕过开关（VITE_DEV_BYPASS=1 时自动调用 /auth/dev-login 免邀请码直登） */
export const DEV_BYPASS_ENABLED =
  (import.meta.env.VITE_DEV_BYPASS as string | undefined) === "1";

export function saveAuth(data: LocalAuthData): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export function loadAuth(): LocalAuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LocalAuthData;
    if (!data.token) return null;
    if (data.expiresAt && Date.now() > data.expiresAt) {
      clearAuth();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * 邀请码注册（登录）。成功返回用户数据。
 */
export async function registerWithInviteCode(
  inviteCode: string,
  nickname: string,
): Promise<LocalAuthData> {
  const response = await fetch(`${LOCAL_BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteCode, nickname }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    throw new Error(data.detail || data.message || "注册失败，请检查邀请码");
  }

  const auth: LocalAuthData = {
    token: data.token,
    userId: data.userId,
    nickname: data.nickname || nickname,
    isAdmin: Boolean(data.isAdmin),
    // 后端默认 JWT 有效期；此处给一个兜底（7 天）
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  saveAuth(auth);
  return auth;
}

/**
 * 开发期直登：调用后端 /auth/dev-login（需服务器开启 AUTH_DEV_BYPASS=1）。
 */
export async function devLogin(): Promise<LocalAuthData> {
  const response = await fetch(`${LOCAL_BACKEND_URL}/auth/dev-login`, {
    method: "POST",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    throw new Error(data.detail || "开发直登失败，请检查后端 AUTH_DEV_BYPASS 配置");
  }

  const auth: LocalAuthData = {
    token: data.token,
    userId: data.userId,
    nickname: data.nickname || "开发者",
    isAdmin: Boolean(data.isAdmin),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  saveAuth(auth);
  return auth;
}
