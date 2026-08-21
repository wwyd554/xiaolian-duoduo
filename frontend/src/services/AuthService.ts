/**
 * 認証サービス - Cognito連携版
 *
 * Amazon Cognitoと連携して認証機能を提供
 *
 * ユーザープロフィール情報
 * - email: メールアドレス（必須、サインイン用）
 * - name: 名前（表示用）
 * - preferredUsername: ユーザー名（表示、変更可能）
 * - userId: Cognito ID (sub属性)
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
    userId?: string; // Cognito ID (sub属性)
  } | null = null;
  private cachedIsAdmin: boolean | null = null;
  private cachedIsAdminAt: number = 0;
  /** 管理者キャッシュの有効期間（5分） */
  private static readonly ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

  private constructor() {
    // シングルトンパターン
    console.log("认证服务初始化");
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * ローカル（邀请码制）認証データを取得。未ログイン時は null。
   */
  private getLocalAuth() {
    return loadAuth();
  }

  /**
   * ユーザー情報を取得してキャッシュする
   * @private
   */
  private async fetchAndCacheUserInfo(): Promise<void> {
    try {
      // ローカル認証（邀请码制）が有効ならそれを使う
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
      // 現在のユーザー情報を取得
      const cognitoUser = await getCurrentUser();
      // ユーザー属性を取得
      const userAttributes = await fetchUserAttributes();
      // セッション情報を取得
      const session = await fetchAuthSession();

      if (cognitoUser && session) {
        // Cognitoからユーザー情報を取得
        // ユーザー属性からpreferred_usernameを取得
        const preferredUsername =
          userAttributes["preferred_username"] || cognitoUser.username;

        this.cachedUser = {
          name: cognitoUser.username,
          email:
            userAttributes.email || cognitoUser.signInDetails?.loginId || "",
          preferredUsername: preferredUsername,
          userId: cognitoUser.userId, // Cognitoのsub属性（ユーザーID）
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
   * ログアウト
   */
  public async logout(): Promise<void> {
    try {
      if (this.getLocalAuth()) {
        // ローカル認証：ローカルストレージをクリア
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
   * 認証状態を取得
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
   * 現在のユーザー情報を取得
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
   * 現在のユーザーIDを取得
   */
  public async getUserId(): Promise<string | null> {
    if (!this.cachedUser) {
      await this.fetchAndCacheUserInfo();
    }
    return this.cachedUser?.userId || null;
  }

  /**
   * 現在のユーザーが管理者グループに所属しているかを判定する
   * ローカル認証：register 時の isAdmin を使用。Cognito：IDトークンの cognito:groups を確認。
   */
  public async isAdmin(): Promise<boolean> {
    const local = this.getLocalAuth();
    if (local) {
      return local.isAdmin;
    }

    // キャッシュが有効期間内ならそのまま返す
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
   * 認証トークンを取得
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
   * ユーザー名を更新する
   * @param preferredUsername 新しいユーザー名
   */
  public async updatePreferredUsername(
    preferredUsername: string,
  ): Promise<void> {
    try {
      // Cognitoのユーザー属性を更新
      await updateUserAttributes({
        userAttributes: {
          preferred_username: preferredUsername,
        },
      });

      // キャッシュを更新
      if (this.cachedUser) {
        this.cachedUser.preferredUsername = preferredUsername;
      }

      // 最新のユーザー情報を再取得
      await this.fetchAndCacheUserInfo();

      console.log("已更新用户名:", preferredUsername);
    } catch (error) {
      console.error("更新用户名时出错:", error);
      throw error;
    }
  }
}
