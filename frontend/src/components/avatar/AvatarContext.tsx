/**
 * 化身 Context
 * 提供化身信息状态管理及经 CloudFront 的 VRM 模型加载
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { AvatarInfo, AvatarContextState } from '../../types/avatar';

/**
 * 化身 Context 值的类型定义
 */
interface AvatarContextValue extends AvatarContextState {
  loadAvatar: (avatarId: string, s3Key?: string) => Promise<void>;
}

/**
 * 化身 Context 的默认值
 */
const defaultContextValue: AvatarContextValue = {
  currentAvatarId: null,
  avatarInfo: null,
  isLoading: false,
  error: null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadAvatar: async (_avatarId: string, _s3Key?: string) => { },
};

/**
 * 化身 Context
 */
const AvatarContext = createContext<AvatarContextValue>(defaultContextValue);

/**
 * 经 CloudFront 的化身 CDN URL
 */
const AVATAR_CDN_URL = import.meta.env.VITE_AVATAR_CDN_URL || '';

/**
 * 默认化身的模型路径（本地资源）
 */
const DEFAULT_AVATAR_MODEL_PATH = '/models/avatars/default_girl1.vrm';

/**
 * AvatarProvider 的属性
 */
interface AvatarProviderProps {
  children: ReactNode;
}

/**
 * 化身 Context 提供者
 * 提供化身信息状态管理的组件
 */
export const AvatarProvider: React.FC<AvatarProviderProps> = ({ children }) => {
  // 状態管理
  const [currentAvatarId, setCurrentAvatarId] = useState<string | null>(null);
  const [avatarInfo, setAvatarInfo] = useState<AvatarInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 加载化身
   * 指定了 avatarId 时经 CloudFront 引用 VRM 模型
   * 未指定时使用默认化身
   * @param avatarId - 要加载的化身 ID
   * @param s3Key - S3 键（"avatars/{userId}/{avatarId}/{fileName}" 格式）
   */
  const loadAvatar = useCallback(async (avatarId: string, s3Key?: string): Promise<void> => {
    // 相同化身已加载时跳过
    // 但若新提供了 s3Key 则重新加载
    if (currentAvatarId === avatarId && avatarInfo) {
      if (!s3Key || avatarInfo.s3Key === s3Key) {
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      if (avatarId === 'default' || !avatarId) {
        // 默认化身
        setCurrentAvatarId('default');
        setAvatarInfo({
          id: 'default',
          name: 'default',
          modelPath: DEFAULT_AVATAR_MODEL_PATH,
        });
      } else if (AVATAR_CDN_URL && s3Key) {
        // s3Key 为 "avatars/{userId}/{avatarId}/{fileName}" 格式
        // 由于 VITE_AVATAR_CDN_URL 是 "https://xxx.cloudfront.net/avatars"
        // 去除 s3Key 开头的 "avatars/" 后进行拼接
        const relativePath = s3Key.replace(/^avatars\//, '');
        const modelPath = `${AVATAR_CDN_URL}/${relativePath}`;
        setCurrentAvatarId(avatarId);
        setAvatarInfo({
          id: avatarId,
          name: avatarId,
          modelPath,
          s3Key,
        });
      } else if (AVATAR_CDN_URL) {
        console.warn('s3Key not provided, falling back to default avatar');
        setCurrentAvatarId('default');
        setAvatarInfo({
          id: 'default',
          name: 'default',
          modelPath: DEFAULT_AVATAR_MODEL_PATH,
        });
      } else {
        console.warn('VITE_AVATAR_CDN_URL not configured, falling back to default avatar');
        setCurrentAvatarId('default');
        setAvatarInfo({
          id: 'default',
          name: 'default',
          modelPath: DEFAULT_AVATAR_MODEL_PATH,
        });
      }
    } catch (err) {
      const errorObj = err instanceof Error
        ? err
        : new Error('Failed to load avatar');
      setError(errorObj);
      console.error('Avatar load error:', errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [currentAvatarId, avatarInfo]);

  // 记忆化 Context 的值
  const contextValue = useMemo<AvatarContextValue>(
    () => ({
      currentAvatarId,
      avatarInfo,
      isLoading,
      error,
      loadAvatar,
    }),
    [
      currentAvatarId,
      avatarInfo,
      isLoading,
      error,
      loadAvatar,
    ]
  );

  return (
    <AvatarContext.Provider value={contextValue}>
      {children}
    </AvatarContext.Provider>
  );
};

/**
 * 使用化身 Context 的自定义钩子
 * @returns 化身 Context 的值
 * @throws 在 AvatarProvider 之外使用时会报错
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAvatar = (): AvatarContextValue => {
  const context = useContext(AvatarContext);

  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider');
  }

  return context;
};

export default AvatarContext;
