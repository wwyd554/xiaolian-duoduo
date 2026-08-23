/**
 * 认证服务 - Cognito 集成版
 *
 * 与 Amazon Cognito 集成，提供认证功能
 *
 * 用户资料信息
 * - email：邮箱地址（必填，用于登录）
 * - name：姓名（用于显示）
 * - preferredUsername：用户名（用于显示、可修改）
 * - userId：Cognito ID（sub 属性）
 */
import {
  getCurrentUser,
  fetchAuthSession,
  signOut,
  updateUserAttributes,
  fetchUserAttributes,
} from "aws-amplify/auth";
import { loadAuth, clearAuth } from "./LocalAuth";

export class AuthService {
  private static instance: AuthService;
  private cachedUser: {
    name: string;
    email: string;
    preferredUsername?: string;
    userId?: string; // Cognito ID（sub 属性）
  } | null = null;
  private cachedIsAdmin: boolean | null = null;
  private cachedIsAdminAt: number = 0;
  /** 管理员缓存有效期（5 分钟） */
  private static readonly ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

  private constructor() {
    // 单例模式
    console.log("认证服务初始化");
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 获取本地（邀请码制）认证数据。未登录时为 null。
   */
  private getLocalAuth() {
    return loadAuth();
  }

  /**
   * 获取用户信息并缓存
   * @private
   */
  private async fetchAndCacheUserInfo(): Promise<void> {
    try {
      // 若本地认证（邀请码制）有效则使用它
      const local = this.getLocalAuth();
      if (local) {
        this.cachedUser = {
          name: local.nickname,
          email: "",
          preferredUsername: local.nickname,
          userId: local.userId,
        };
        return;
      }
      // 获取当前用户信息
      const cognitoUser = await getCurrentUser();
      // 获取用户属性
      const userAttributes = await fetchUserAttributes();
      // 获取会话信息
      const session = await fetchAuthSession();

      if (cognitoUser && session) {
        // 从 Cognito 获取用户信息
        // 从用户属性中获取 preferred_username
        const preferredUsername =
          userAttributes["preferred_username"] || cognitoUser.username;

        this.cachedUser = {
          name: cognitoUser.username,
          email:
            userAttributes.email || cognitoUser.signInDetails?.loginId || "",
          preferredUsername: preferredUsername,
          userId: cognitoUser.userId, // Cognito 的 sub 属性（用户 ID）
        };
        console.log("已获取用户信息:", this.cachedUser);
      } else {
        this.cachedUser = null;
        console.log("无法获取用户信息");
      }
    } catch (error) {
      console.error("获取用户信息时出错:", error);
      this.cachedUser = null;
    }
  }

  /**
   * 登出
   */
  public async logout(): Promise<void> {
    try {
      if (this.getLocalAuth()) {
        // 本地认证：清除本地存储
        clearAuth();
        this.cachedUser = null;
        this.cachedIsAdmin = null;
        this.cachedIsAdminAt = 0;
        console.log("本地认证登出完成");
        return;
      }
      await signOut();
      this.cachedUser = null;
      this.cachedIsAdmin = null;
      this.cachedIsAdminAt = 0;
      console.log("登出完成");
    } catch (error) {
      console.error("登出时出错:", error);
    }
  }

  /**
   * 获取认证状态
   */
  public async isLoggedIn(): Promise<boolean> {
    try {
      if (this.getLocalAuth()) {
        return true;
      }
      const session = await fetchAuthSession();
      return !!session.tokens;
    } catch (error) {
      console.error("确认认证状态时出错:", error);
      return false;
    }
  }

  /**
   * 获取当前用户信息
   */
  public async getCurrentUser(): Promise<{
    name: string;
    email: string;
    preferredUsername?: string;
    userId?: string;
  } | null> {
    if (!this.cachedUser) {
      await this.fetchAndCacheUserInfo();
    }
    return this.cachedUser;
  }

  /**
   * 获取当前用户 ID
   */
  public async getUserId(): Promise<string | null> {
    if (!this.cachedUser) {
      await this.fetchAndCacheUserInfo();
    }
    return this.cachedUser?.userId || null;
  }

  /**
   * 判断当前用户是否属于管理员组
   * 本地认证：使用注册时的 isAdmin。Cognito：检查 ID 令牌中的 cognito:groups。
   */
  public async isAdmin(): Promise<boolean> {
    const local = this.getLocalAuth();
    if (local) {
      return local.isAdmin;
    }

    // 若缓存仍在有效期内则直接返回
    if (
      this.cachedIsAdmin !== null &&
      Date.now() - this.cachedIsAdminAt < AuthService.ADMIN_CACHE_TTL_MS
    ) {
      return this.cachedIsAdmin;
    }

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      if (!idToken) {
        this.cachedIsAdmin = false;
        this.cachedIsAdminAt = Date.now();
        return false;
      }

      const groups = idToken.payload["cognito:groups"];
      this.cachedIsAdmin = Array.isArray(groups) && groups.includes("admin");
      this.cachedIsAdminAt = Date.now();
      return this.cachedIsAdmin;
    } catch (error) {
      console.error("管理员判定错误:", error);
      this.cachedIsAdmin = false;
      this.cachedIsAdminAt = Date.now();
      return false;
    }
  }

  /**
   * 获取认证令牌
   */
  public async getAuthToken(): Promise<string> {
    try {
      const local = this.getLocalAuth();
      if (local) {
        return local.token;
      }
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || "";
    } catch (error) {
      console.error("获取认证令牌时出错:", error);
      return "";
    }
  }

  /**
   * 更新用户名
   * @param preferredUsername 新的用户名
   */
  public async updatePreferredUsername(
    preferredUsername: string,
  ): Promise<void> {
    try {
      // 更新 Cognito 的用户属性
      await updateUserAttributes({
        userAttributes: {
          preferred_username: preferredUsername,
        },
      });

      // 更新缓存
      if (this.cachedUser) {
        this.cachedUser.preferredUsername = preferredUsername;
      }

      // 重新获取最新用户信息
      await this.fetchAndCacheUserInfo();

      console.log("已更新用户名:", preferredUsername);
    } catch (error) {
      console.error("更新用户名时出错:", error);
      throw error;
    }
  }
}
