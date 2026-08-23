/**
 * VRM 化身容器组件
 * 提供与 EmojiFeedbackContainer 相同的接口，
 * 包含 WebGL 支持检查、错误处理和发言指示器
 */
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { VRMAvatarContainerProps } from '../../types/avatar';
import { VisemeData } from '../../types/avatar';
import { EmotionState } from '../../types/index';
import { calculateEmotionState } from '../../utils/emotionUtils';
import { useAvatar } from './AvatarContext';
import VRMAvatar from './VRMAvatar';

/**
 * 检查 WebGL 支持（仅在初始化时执行一次）
 */
const checkWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
};

// 在模块级别缓存 WebGL 支持状态
const webGLSupported = checkWebGLSupport();

/**
 * VRM 化身容器组件
 * 提供与 EmojiFeedbackContainer 相同的接口
 */
const VRMAvatarContainer: React.FC<VRMAvatarContainerProps> = ({
  avatarId,
  avatarS3Key,
  angerLevel,
  trustLevel,
  progressLevel,
  isSpeaking,
  directEmotion,
  gesture,
  onEmotionChange,
}) => {
  const { t } = useTranslation();
  const { avatarInfo, isLoading: isContextLoading, error: contextError, loadAvatar } = useAvatar();

  // 本地状态
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [modelError, setModelError] = useState<Error | null>(null);
  const [previousEmotion, setPreviousEmotion] = useState<EmotionState>('neutral');
  const [visemeData, setVisemeData] = useState<VisemeData[] | undefined>(undefined);

  // 感情变更通知的标志（防止无限循环）
  const emotionChangeNotifiedRef = useRef<EmotionState>('neutral');

  // 用 Ref 保持 loadAvatar（避免 useEffect 依赖）
  const loadAvatarRef = useRef(loadAvatar);

  useEffect(() => {
    loadAvatarRef.current = loadAvatar;
  }, [loadAvatar]);

  // 化身加载
  useEffect(() => {
    const initializeAvatar = async () => {
      try {
        const targetId = avatarId || 'default';
        // 自定义化身时，等待 s3Key 齐全后再加载
        if (targetId !== 'default' && !avatarS3Key) {
          return;
        }
        await loadAvatarRef.current(targetId, avatarS3Key);
      } catch (error) {
        console.error('头像初始化错误:', error);
      }
    };

    initializeAvatar();
  }, [avatarId, avatarS3Key]);

  // 感情状态的计算（整合基于指标与 directEmotion）
  const currentEmotion = useMemo<EmotionState>(() => {
    // 始终计算基于指标的感情
    const metricsEmotion = calculateEmotionState({
      angerLevel,
      trustLevel,
      progressLevel,
      previousEmotion,
    });

    // 未指定 directEmotion 时使用基于指标的
    if (!directEmotion) return metricsEmotion;

    // 当指标显示强烈感情时优先采用指标
    // （防止愤怒计很高却仍保持 neutral 的问题）
    if (metricsEmotion === 'angry' || metricsEmotion === 'annoyed') {
      return metricsEmotion;
    }

    // 否则优先采用 directEmotion（API 响应）
    return directEmotion;
  }, [angerLevel, trustLevel, progressLevel, previousEmotion, directEmotion]);

  // viseme 数据的 CustomEvent 监听器
  useEffect(() => {
    const handleVisemeData = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.visemes) {
        setVisemeData(customEvent.detail.visemes);
      }
    };
    window.addEventListener('visemeData', handleVisemeData);
    return () => {
      window.removeEventListener('visemeData', handleVisemeData);
    };
  }, []);

  // 通知感情状态的变化（通过 Ref 防止重复通知）
  useEffect(() => {
    if (currentEmotion !== emotionChangeNotifiedRef.current) {
      emotionChangeNotifiedRef.current = currentEmotion;
      // previousEmotion 的更新在下一个渲染周期进行
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 有意的设计：用于跟踪感情状态
      setPreviousEmotion(currentEmotion);
      onEmotionChange?.(currentEmotion);
    }
  }, [currentEmotion, onEmotionChange]);

  // 模型加载完成处理器
  const handleModelLoad = useCallback(() => {
    setIsModelLoading(false);
    setModelError(null);
  }, []);

  // 模型加载错误处理器
  const handleModelError = useCallback((error: Error) => {
    setIsModelLoading(false);
    setModelError(error);
    console.error('VRM模型加载错误:', error);
  }, []);

  // 模型 URL 的获取
  const modelUrl = useMemo(() => {
    if (!avatarInfo?.modelPath) return null;
    // WR-006: CDN URL（https://）时直接使用
    if (avatarInfo.modelPath.startsWith('http://') || avatarInfo.modelPath.startsWith('https://')) {
      return avatarInfo.modelPath;
    }
    // 绝对路径时直接使用
    if (avatarInfo.modelPath.startsWith('/')) {
      return avatarInfo.modelPath;
    }
    // 相对路径时附加 /models/avatars/
    const url = `/models/avatars/${avatarInfo.modelPath}`;
    return url;
  }, [avatarInfo]);

  // 加载状态
  const isLoading = isContextLoading || isModelLoading;

  // 错误状态
  const error = contextError || modelError;

  // 不支持 WebGL 的情况
  if (!webGLSupported) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'grey.100',
          borderRadius: 1,
          p: 2,
        }}
        role="alert"
        aria-live="polite"
      >
        <ErrorIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
        <Typography variant="body1" color="text.secondary" textAlign="center">
          {t('avatar.webglNotSupported', '您的浏览器不支持 WebGL。要显示 3D 化身，请使用支持 WebGL 的浏览器。')}
        </Typography>
      </Box>
    );
  }

  // 错误显示
  if (error) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
        }}
      >
        <Alert
          severity="error"
          sx={{ maxWidth: '100%' }}
          role="alert"
        >
          <Typography variant="body2">
            {t('avatar.loadError', '化身加载失败')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('avatar.loadErrorDetail', '发生错误，请重新加载。')}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // 加载显示
  if (isLoading || !modelUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'grey.50',
        }}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          {t('avatar.loading', '正在加载化身...')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      {/* 用于无障碍支持的标签 */}
      <Typography
        id="avatar-label"
        sx={{ position: 'absolute', left: '-9999px' }}
      >
        {t('avatar.label', '3D化身显示区域')}
      </Typography>

      <Typography
        id="avatar-description"
        sx={{ position: 'absolute', left: '-9999px' }}
      >
        {t('avatar.description', '当前感情状态通过 3D 化身呈现')}
      </Typography>

      {/* VRM 化身 */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
        }}
        aria-labelledby="avatar-label"
        aria-describedby="avatar-description"
      >
        <VRMAvatar
          modelUrl={modelUrl}
          emotion={currentEmotion}
          isSpeaking={isSpeaking}
          visemeData={visemeData}
          directEmotion={directEmotion}
          gesture={gesture}
          onLoad={handleModelLoad}
          onError={handleModelError}
        />
      </Box>



      {/* 感情状态指示器（调试用，生产环境可隐藏） */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '8px',
            fontSize: '0.7rem',
            zIndex: 10,
          }}
        >
          <Typography variant="caption" sx={{ color: 'inherit' }}>
            {t('avatar.emotion', '感情')}: {currentEmotion}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default VRMAvatarContainer;
