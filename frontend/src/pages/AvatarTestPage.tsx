/**
 * VRM 头像测试页面
 * 用于确认 3D 模型加载和表情变化的简单测试页面
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import {
  Box,
  Button,
  ButtonGroup,
  Typography,
  CircularProgress,
  Alert,
  Slider,
  Stack,
  Divider,
  Chip,
} from '@mui/material';
import VRMLoader from '../components/avatar/VRMLoader';
import ExpressionController from '../components/avatar/ExpressionController';
import AnimationController from '../components/avatar/AnimationController';
import LipSyncController from '../components/avatar/LipSyncController';
import { EmotionState } from '../types/index';
import { VRMExpressionName } from '../types/avatar';

// VRM 文件的路径（从 public 目录提供）
const DEFAULT_MODEL_URL = '/models/avatars/default_girl1.vrm';

const CAMERA_CONFIG = {
  fov: 20,
  near: 0.1,
  far: 100,
  position: { x: 0, y: 1.35, z: 1.0 },
  lookAt: { x: 0, y: 1.35, z: 0 },
};

const EMOTIONS: { label: string; value: EmotionState; emoji: string }[] = [
  { label: '愤怒', value: 'angry', emoji: '😡' },
  { label: '不満', value: 'annoyed', emoji: '😒' },
  { label: '中立', value: 'neutral', emoji: '😐' },
  { label: '満足', value: 'satisfied', emoji: '🙂' },
  { label: '高兴', value: 'happy', emoji: '😄' },
];

const VRM_EXPRESSIONS: { label: string; value: VRMExpressionName }[] = [
  { label: 'Happy', value: 'happy' },
  { label: 'Angry', value: 'angry' },
  { label: 'Sad', value: 'sad' },
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'Neutral', value: 'neutral' },
];

// Phase 2: Viseme 测试用元音按钮定义
const VOWEL_SHAPES: { label: string; blendShape: string; emoji: string }[] = [
  { label: '啊 (aa)', blendShape: 'aa', emoji: '👄' },
  { label: '衣 (ih)', blendShape: 'ih', emoji: '😬' },
  { label: '呜 (ou)', blendShape: 'ou', emoji: '😗' },
  { label: '诶 (ee)', blendShape: 'ee', emoji: '😁' },
  { label: '哦 (oh)', blendShape: 'oh', emoji: '😮' },
  { label: '闭嘴 (sil)', blendShape: '', emoji: '😶' },
];

// Phase 2: directEmotion 用的情绪定义（符合 EmotionState 类型）
const DIRECT_EMOTIONS: { label: string; value: EmotionState; emoji: string }[] = [
  { label: 'Happy', value: 'happy', emoji: '😊' },
  { label: 'Satisfied', value: 'satisfied', emoji: '🙂' },
  { label: 'Neutral', value: 'neutral', emoji: '😐' },
  { label: 'Annoyed', value: 'annoyed', emoji: '😒' },
  { label: 'Angry', value: 'angry', emoji: '😠' },
];

// Phase 2: Viseme 自动序列（「你好」的模拟）
const SAMPLE_VISEME_SEQUENCE = [
  { time: 0, type: 'viseme', value: 'k' },
  { time: 100, type: 'viseme', value: 'o' },
  { time: 250, type: 'viseme', value: 'N' },
  { time: 400, type: 'viseme', value: 'n' },
  { time: 500, type: 'viseme', value: 'i' },
  { time: 650, type: 'viseme', value: 't' },
  { time: 750, type: 'viseme', value: 'i' },
  { time: 900, type: 'viseme', value: 'w' },
  { time: 1050, type: 'viseme', value: 'a' },
  { time: 1300, type: 'viseme', value: 'sil' },
];

const AvatarTestPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const vrmLoaderRef = useRef<VRMLoader | null>(null);
  const expressionCtrlRef = useRef<ExpressionController | null>(null);
  const animationCtrlRef = useRef<AnimationController | null>(null);
  const lipSyncCtrlRef = useRef<LipSyncController | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const cleanupTimerRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState>('neutral');
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [directMode, setDirectMode] = useState(false);
  const [directExpression, setDirectExpression] = useState<string>('neutral');
  const [directIntensity, setDirectIntensity] = useState(0.8);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingTimeRef = useRef(0);

  // Phase 2: 追加状态
  const [currentVowel, setCurrentVowel] = useState<string>('');
  const [isVisemePlaying, setIsVisemePlaying] = useState(false);
  const [directEmotionMode, setDirectEmotionMode] = useState(false);
  const [selectedDirectEmotion, setSelectedDirectEmotion] = useState<EmotionState>('neutral');
  const [currentModelUrl] = useState<string>(DEFAULT_MODEL_URL);

  // 渲染循环（通过 Ref 保持）
  const renderLoopRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    renderLoopRef.current = () => {
      const deltaTime = clockRef.current.getDelta();

      if (!directMode) {
        expressionCtrlRef.current?.update(deltaTime);
      }
      animationCtrlRef.current?.update(deltaTime);

      // Phase 2: LipSyncController 的 viseme 基础更新
      lipSyncCtrlRef.current?.update(deltaTime);

      // 发音模拟：用正弦波再现口型（仅非 viseme 模式时）
      if (isSpeaking && !isVisemePlaying && vrmRef.current?.expressionManager) {
        speakingTimeRef.current += deltaTime;
        // 合成多个正弦波以再现更自然的口部动作
        const t = speakingTimeRef.current;
        const mouthOpen =
          Math.abs(Math.sin(t * 8.0)) * 0.4 +
          Math.abs(Math.sin(t * 12.5)) * 0.2 +
          Math.abs(Math.sin(t * 3.0)) * 0.15;
        vrmRef.current.expressionManager.setValue('aa', Math.min(mouthOpen, 0.8));
      } else if (!isSpeaking && vrmRef.current?.expressionManager) {
        // 停止发音时闭上嘴
        speakingTimeRef.current = 0;
        vrmRef.current.expressionManager.setValue('aa', 0);
      }

      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animFrameRef.current = requestAnimationFrame(renderLoopRef.current!);
    };
  }, [directMode, isSpeaking, isVisemePlaying]);

  // 尺寸调整处理
  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    cameraRef.current.aspect = w / h;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(w, h);
  }, []);

  // 全部资源清理
  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    expressionCtrlRef.current?.dispose();
    expressionCtrlRef.current = null;
    animationCtrlRef.current?.dispose();
    animationCtrlRef.current = null;
    lipSyncCtrlRef.current?.dispose();
    lipSyncCtrlRef.current = null;

    if (vrmRef.current && sceneRef.current) {
      sceneRef.current.remove(vrmRef.current.scene);
      vrmRef.current.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
    }
    vrmRef.current = null;
    vrmLoaderRef.current?.dispose();
    vrmLoaderRef.current = null;

    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    if (sceneRef.current) {
      sceneRef.current.clear();
      sceneRef.current = null;
    }
    cameraRef.current = null;
  }, []);

  // 初始化（带 StrictMode 双重挂载对策）
  useEffect(() => {
    // 取消上一次的延迟清理（StrictMode 重新挂载时）
    if (cleanupTimerRef.current !== null) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    // 已存在 Renderer 时跳过（StrictMode 重新挂载对策）
    if (rendererRef.current) {
      if (animFrameRef.current === null && renderLoopRef.current) {
        animFrameRef.current = requestAnimationFrame(renderLoopRef.current);
      }
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        const currentRenderer = rendererRef.current;
        cleanupTimerRef.current = window.setTimeout(() => {
          if (rendererRef.current === currentRenderer) {
            cleanup();
          }
        }, 50);
      };
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // 相机
    const camera = new THREE.PerspectiveCamera(CAMERA_CONFIG.fov, w / h, CAMERA_CONFIG.near, CAMERA_CONFIG.far);
    camera.position.set(CAMERA_CONFIG.position.x, CAMERA_CONFIG.position.y, CAMERA_CONFIG.position.z);
    camera.lookAt(CAMERA_CONFIG.lookAt.x, CAMERA_CONFIG.lookAt.y, CAMERA_CONFIG.lookAt.z);
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(0.5, 1.5, 1);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-1, 1, 0.5);
    scene.add(fillLight);

    clockRef.current.start();

    // 加载 VRM
    const loader = new VRMLoader();
    vrmLoaderRef.current = loader;

    loader.load(currentModelUrl, (progress) => {
      setLoadProgress(Math.round(progress));
    }).then((vrm) => {
      // 已清理时丢弃加载的资源
      if (!sceneRef.current) {
        vrm.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => mat.dispose());
            } else if (object.material) {
              object.material.dispose();
            }
          }
        });
        return;
      }

      vrmRef.current = vrm;
      sceneRef.current.add(vrm.scene);

      // 获取可用表情
      if (vrm.expressionManager) {
        const exprs = vrm.expressionManager.expressions.map(e => e.expressionName);
        setAvailableExpressions(exprs);
      }

      // 控制器初始化
      expressionCtrlRef.current = new ExpressionController(vrm);
      animationCtrlRef.current = new AnimationController(vrm);
      animationCtrlRef.current.startIdleAnimations();
      lipSyncCtrlRef.current = new LipSyncController(vrm);

      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'VRM 加载失败');
      setLoading(false);
    });

    // 开始渲染循环
    if (renderLoopRef.current) {
      animFrameRef.current = requestAnimationFrame(renderLoopRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // StrictMode 假卸载对策：延迟清理
      const currentRenderer = rendererRef.current;
      cleanupTimerRef.current = window.setTimeout(() => {
        if (rendererRef.current === currentRenderer) {
          cleanup();
        }
      }, 50);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在挂载时执行一次
  }, []);

  // Phase 2: 切换头像时的模型重载
  useEffect(() => {
    // 首次挂载时跳过（已在初始化 useEffect 中处理）
    if (!vrmLoaderRef.current || !sceneRef.current || loading) return;

    // 删除既有 VRM
    if (vrmRef.current) {
      sceneRef.current.remove(vrmRef.current.scene);
      vrmRef.current.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
      vrmRef.current = null;
    }

    // 重置控制器
    expressionCtrlRef.current?.dispose();
    expressionCtrlRef.current = null;
    animationCtrlRef.current?.dispose();
    animationCtrlRef.current = null;
    lipSyncCtrlRef.current?.dispose();
    lipSyncCtrlRef.current = null;

    setLoading(true);
    setLoadProgress(0);

    const loader = new VRMLoader();
    vrmLoaderRef.current = loader;

    loader.load(currentModelUrl, (progress) => {
      setLoadProgress(Math.round(progress));
    }).then((vrm) => {
      if (!sceneRef.current) return;

      vrmRef.current = vrm;
      sceneRef.current.add(vrm.scene);

      if (vrm.expressionManager) {
        const exprs = vrm.expressionManager.expressions.map(e => e.expressionName);
        setAvailableExpressions(exprs);
      }

      expressionCtrlRef.current = new ExpressionController(vrm);
      animationCtrlRef.current = new AnimationController(vrm);
      animationCtrlRef.current.startIdleAnimations();
      lipSyncCtrlRef.current = new LipSyncController(vrm);

      // 重新应用当前情绪状态
      expressionCtrlRef.current.setEmotion(currentEmotion);

      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'VRM 加载失败');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 currentModelUrl 变更时执行
  }, [currentModelUrl]);

  // directMode 变更时重启渲染循环
  useEffect(() => {
    if (loading || !rendererRef.current) return;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (renderLoopRef.current) {
      animFrameRef.current = requestAnimationFrame(renderLoopRef.current);
    }
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [loading, directMode, isSpeaking, isVisemePlaying]);

  // 情绪状态的变更（经 ExpressionController）
  const handleEmotionChange = useCallback((emotion: EmotionState) => {
    setCurrentEmotion(emotion);
    setDirectMode(false);
    expressionCtrlRef.current?.setEmotion(emotion);
  }, []);

  // VRM 表情的直接操作
  const handleDirectExpression = useCallback((exprName: string, intensity: number) => {
    const vrm = vrmRef.current;
    if (!vrm?.expressionManager) return;

    setDirectMode(true);
    setDirectExpression(exprName);
    setDirectIntensity(intensity);

    // 重置全部表情
    for (const expr of vrm.expressionManager.expressions) {
      vrm.expressionManager.setValue(expr.expressionName, 0);
    }

    // 应用指定的表情
    if (exprName !== 'neutral') {
      vrm.expressionManager.setValue(exprName, intensity);
    }
  }, []);

  // 多个表情的混合应用
  const handleBlendPreset = useCallback((blend: Record<string, number>) => {
    const vrm = vrmRef.current;
    if (!vrm?.expressionManager) return;

    setDirectMode(true);
    setDirectExpression('blend');

    // 重置全部表情
    for (const expr of vrm.expressionManager.expressions) {
      vrm.expressionManager.setValue(expr.expressionName, 0);
    }

    // 混合应用
    for (const [name, value] of Object.entries(blend)) {
      vrm.expressionManager.setValue(name, value);
    }
  }, []);

  // Phase 2: 元音混合形状的直接操作
  const handleVowelShape = useCallback((blendShape: string) => {
    const vrm = vrmRef.current;
    if (!vrm?.expressionManager) return;

    setCurrentVowel(blendShape);

    // 重置全部元音
    const vowelShapes = ['aa', 'ih', 'ou', 'ee', 'oh'];
    for (const shape of vowelShapes) {
      vrm.expressionManager.setValue(shape, 0);
    }

    // 应用指定的元音
    if (blendShape) {
      vrm.expressionManager.setValue(blendShape, 0.8);
    }
  }, []);

  // Phase 2: Viseme 序列自动播放
  const handleVisemeSequence = useCallback(() => {
    if (!lipSyncCtrlRef.current) return;

    setIsVisemePlaying(true);
    lipSyncCtrlRef.current.setVisemeData(SAMPLE_VISEME_SEQUENCE);
    lipSyncCtrlRef.current.startVisemePlayback();

    // 序列结束后重置标志
    const duration = SAMPLE_VISEME_SEQUENCE[SAMPLE_VISEME_SEQUENCE.length - 1].time + 500;
    setTimeout(() => {
      setIsVisemePlaying(false);
      setCurrentVowel('');
    }, duration);
  }, []);

  // Phase 2: directEmotion 切换
  const handleDirectEmotion = useCallback((emotion: EmotionState) => {
    setSelectedDirectEmotion(emotion);
    setDirectEmotionMode(true);
    setDirectMode(false);

    // 通过 ExpressionController 应用情绪
    expressionCtrlRef.current?.setEmotion(emotion);
  }, []);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', p: 2, gap: 2 }}>
      {/* 3D 显示区域 */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 400,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
          aria-label="VRM 模型测试显示区域"
          role="img"
        />

        {/* 加载中 */}
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'rgba(255,255,255,0.9)',
            }}
          >
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              VRM 模型加载中... {loadProgress}%
            </Typography>
          </Box>
        )}

        {/* 错误 */}
        {error && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
      </Box>

      {/* 控制面板 */}
      <Box sx={{ width: 320, flexShrink: 0, overflow: 'auto' }}>
        <Stack spacing={3}>
          <Typography variant="h6">VRM 表情测试</Typography>

          {/* 情绪状态按钮（经 ExpressionController） */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              发音模拟
            </Typography>
            <Button
              variant={isSpeaking ? 'contained' : 'outlined'}
              color={isSpeaking ? 'error' : 'primary'}
              onClick={() => setIsSpeaking((prev) => !prev)}
              fullWidth
              size="small"
              aria-pressed={isSpeaking}
            >
              {isSpeaking ? '🔊 停止发音' : '🗣️ 开始发音'}
            </Button>
          </Box>

          {/* 愤怒混合预设 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              愤怒混合（多个表情的组合）
            </Typography>
            <Stack spacing={1}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => handleBlendPreset({ angry: 1.0 })}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                😡 angry 单独 (1.0)
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => handleBlendPreset({ angry: 1.0, lookDown: 0.4 })}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                😡 angry + lookDown（怒视）
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => handleBlendPreset({ angry: 1.0, blink: 0.3 })}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                😡 angry + blink（眯眼）
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => handleBlendPreset({ angry: 1.0, aa: 0.3 })}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                😡 angry + aa（张嘴）
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => handleBlendPreset({ angry: 1.0, lookDown: 0.3, blink: 0.25 })}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                😡 angry + lookDown + blink（组合）
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => handleBlendPreset({ angry: 1.0, lookDown: 0.3, blink: 0.25, aa: 0.2 })}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                😡 angry + lookDown + blink + aa（全部叠加）
              </Button>
            </Stack>
          </Box>

          {/* 情绪状态按钮（经 ExpressionController） */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              情绪状态（经 EmotionState）
            </Typography>
            <Stack spacing={1}>
              {EMOTIONS.map(({ label, value, emoji }) => (
                <Button
                  key={value}
                  variant={!directMode && currentEmotion === value ? 'contained' : 'outlined'}
                  onClick={() => handleEmotionChange(value)}
                  fullWidth
                  size="small"
                >
                  {emoji} {label} ({value})
                </Button>
              ))}
            </Stack>
          </Box>

          {/* VRM 表情的直接操作 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              VRM 表情（直接操作）
            </Typography>
            <ButtonGroup orientation="vertical" fullWidth size="small">
              {VRM_EXPRESSIONS.map(({ label, value }) => (
                <Button
                  key={value}
                  variant={directMode && directExpression === value ? 'contained' : 'outlined'}
                  onClick={() => handleDirectExpression(value, directIntensity)}
                >
                  {label}
                </Button>
              ))}
            </ButtonGroup>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption">强度: {directIntensity.toFixed(2)}</Typography>
              <Slider
                value={directIntensity}
                min={0}
                max={1}
                step={0.05}
                onChange={(_, val) => {
                  const v = val as number;
                  setDirectIntensity(v);
                  if (directMode) {
                    handleDirectExpression(directExpression, v);
                  }
                }}
                size="small"
                aria-label="表情强度"
              />
            </Box>
          </Box>

          {/* 模型中可用的表情列表 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              可用表情（模型内）
            </Typography>
            {availableExpressions.length > 0 ? (
              <Stack spacing={0.5}>
                {availableExpressions.map((expr) => (
                  <Button
                    key={expr}
                    variant="text"
                    size="small"
                    onClick={() => handleDirectExpression(expr, directIntensity)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    {expr}
                  </Button>
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {loading ? '加载中...' : '未找到表情'}
              </Typography>
            )}
          </Box>

          {/* Phase 2 区域分隔符 */}
          <Divider>
            <Chip label="Phase 2" color="primary" size="small" />
          </Divider>

          {/* Phase 2: Viseme 口型同步测试 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Viseme 口型同步
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {VOWEL_SHAPES.map(({ label, blendShape, emoji }) => (
                  <Button
                    key={label}
                    variant={currentVowel === blendShape ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => handleVowelShape(blendShape)}
                    sx={{ textTransform: 'none', minWidth: 'auto', px: 1.5 }}
                  >
                    {emoji} {label}
                  </Button>
                ))}
              </Stack>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                fullWidth
                onClick={handleVisemeSequence}
                disabled={isVisemePlaying}
              >
                {isVisemePlaying ? '🔊 播放中...' : '▶️ 播放「你好」'}
              </Button>
            </Stack>
          </Box>

          {/* Phase 2: directEmotion 测试 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              directEmotion（AI 情绪分析）
            </Typography>
            <Stack spacing={1}>
              {DIRECT_EMOTIONS.map(({ label, value, emoji }) => (
                <Button
                  key={value}
                  variant={directEmotionMode && selectedDirectEmotion === value ? 'contained' : 'outlined'}
                  color="secondary"
                  onClick={() => handleDirectEmotion(value)}
                  fullWidth
                  size="small"
                >
                  {emoji} {label} ({value})
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default AvatarTestPage;
