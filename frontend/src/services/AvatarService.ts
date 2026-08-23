/**
 * 头像管理 API 服务
 * 提供 VRM 头像的 CRUD 操作
 */
import { post, del, put, get } from "aws-amplify/api";
import { getCurrentUser, fetchAuthSession, signOut } from "aws-amplify/auth";

/** 头像元数据 */
export interface AvatarMetadata {
  userId: string;
  avatarId: string;
  name: string;
  fileName: string;
  s3Key: string;
  contentType: string;
  status: 'uploading' | 'active';
  createdAt: number;
  updatedAt: number;
}

/** 创建头像响应 */
export interface AvatarCreateResponse {
  success: boolean;
  avatarId: string;
  uploadUrl: string;
  formData: Record<string, string>;
  avatar: AvatarMetadata;
}

export class AvatarService {
  private static instance: AvatarService;

  private constructor() { }

  public static getInstance(): AvatarService {
    if (!AvatarService.instance) {
      AvatarService.instance = new AvatarService();
    }
    return AvatarService.instance;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      await getCurrentUser();
      const authSession = await fetchAuthSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authSession.tokens?.idToken) {
        headers["Authorization"] = authSession.tokens.idToken.toString();
        const payload = authSession.tokens.idToken.payload;
        const expectedClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
        if (payload.aud !== expectedClientId) {
          await signOut();
          throw new Error("设置已更新，请重新登录。");
        }
      }
      return headers;
    } catch {
      throw new Error("用户未登录");
    }
  }

  /** 创建头像（元数据注册 + 获取上传 URL） */
  public async createAvatar(
    fileName: string,
    name: string,
    contentType: string = 'application/octet-stream'
  ): Promise<AvatarCreateResponse> {
    const headers = await this.getAuthHeaders();
    const restOperation = post({
      apiName: "AISalesRoleplayAPI",
      path: "/avatars",
      options: {
        body: { fileName, name, contentType } as never,
        headers,
      },
    });
    const response = await restOperation.response;
    return JSON.parse(await response.body.text()) as AvatarCreateResponse;
  }

  /** 将 VRM 文件上传到 S3 */
  public async uploadVrmFile(
    uploadUrl: string,
    formData: Record<string, string>,
    file: File
  ): Promise<void> {
    const formDataObj = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataObj.append(key, value);
    });
    formDataObj.append("file", file);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formDataObj,
    });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status}`);
    }
  }

  /** 确认上传完成 */
  public async confirmUpload(avatarId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const restOperation = put({
      apiName: "AISalesRoleplayAPI",
      path: `/avatars/${avatarId}/confirm`,
      options: {
        body: {} as never,
        headers,
      },
    });
    await restOperation.response;
  }

  /** 获取头像详情 */
  public async getAvatarDetail(avatarId: string): Promise<AvatarMetadata | null> {
    try {
      const headers = await this.getAuthHeaders();
      const restOperation = get({
        apiName: "AISalesRoleplayAPI",
        path: `/avatars/${avatarId}`,
        options: { headers },
      });
      const response = await restOperation.response;
      const data = JSON.parse(await response.body.text()) as { success: boolean; avatar?: AvatarMetadata };
      return data.success && data.avatar ? data.avatar : null;
    } catch {
      console.warn("头像详情获取失败（可能是共享头像）:", avatarId);
      return null;
    }
  }

  /** 删除头像 */
  public async deleteAvatar(avatarId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const restOperation = del({
      apiName: "AISalesRoleplayAPI",
      path: `/avatars/${avatarId}`,
      options: { headers },
    });
    await restOperation.response;
  }
}
