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
    console.log("認証サービス初期化");
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
        console.log("ユーザー情報を取得しました:", this.cachedUser);
      } else {
        this.cachedUser = null;
        console.log("ユーザー情報が取得できませんでした");
      }
    } catch (error) {
      console.error("ユーザー情報の取得中にエラーが発生しました:", error);
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
        console.log("ローカル認証ログアウト完了");
        return;
      }
      await signOut();
      this.cachedUser = null;
      this.cachedIsAdmin = null;
      this.cachedIsAdminAt = 0;
      console.log("ログアウト完了");
    } catch (error) {
      console.error("ログアウト中にエラーが発生しました:", error);
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
      console.error("認証状態の確認中にエラーが発生しました:", error);
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
      console.error("管理者判定エラー:", error);
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
      console.error("認証トークンの取得中にエラーが発生しました:", error);
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

      console.log("ユーザー名を更新しました:", preferredUsername);
    } catch (error) {
      console.error("ユーザー名の更新中にエラーが発生しました:", error);
      throw error;
    }
  }
}
