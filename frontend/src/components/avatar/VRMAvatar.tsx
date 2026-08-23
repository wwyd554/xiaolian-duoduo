/**
 * VRM 化身组件
 * 负责 Three.js 场景管理和 VRM 模型渲染
 */
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { VRMAvatarProps } from '../../types/avatar';
import { EmotionState } from '../../types/index';
import VRMLoader from './VRMLoader';
import ExpressionController from './ExpressionController';
import LipSyncController from './LipSyncController';
import AnimationController from './AnimationController';

/**
 * 目标帧率（30fps）
 */
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/**
 * 摄像头设置 - 可拍到上半身整体（头至腰部）的半身镜头
 */
const CAMERA_CONFIG = {
  fov: 30,
  near: 0.1,
  far: 100,
  position: { x: 0, y: 1.2, z: 1.2 },
  lookAt: { x: 0, y: 1.25, z: 0 },
};

/**
 * 灯光设置 - 照亮面部
 */
const LIGHT_CONFIG = {
  ambient: { color: 0xffffff, intensity: 0.8 },
  directional: { color: 0xffffff, intensity: 1.0, position: { x: 0.5, y: 1.5, z: 1 } },
  fill: { color: 0xffffff, intensity: 0.4, position: { x: -1, y: 1, z: 0.5 } },
};

/**
 * VRM 化身组件
 * 使用 Three.js 渲染 VRM 模型
 */
const VRMAvatar: React.FC<VRMAvatarProps> = ({
  modelUrl,
  emotion,
  isSpeaking,
  visemeData,
  // directEmotion 已包含在 VRMAvatarContainer 整合后的 emotion 中，因此此处不使用
  gesture,
  onLoad,
  onError,
}) => {
  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const vrmLoaderRef = useRef<VRMLoader | null>(null);

  // 控制器 Refs
  const expressionControllerRef = useRef<ExpressionController | null>(null);
  const lipSyncControllerRef = useRef<LipSyncController | null>(null);
  const animationControllerRef = useRef<AnimationController | null>(null);

  // 动画 Refs
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const timerRef = useRef<THREE.Timer>(new THREE.Timer());
  const isMountedRef = useRef<boolean>(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 状態追跡 Refs
  const previousEmotionRef = useRef<EmotionState>(emotion);
  const previousIsSpeakingRef = useRef<boolean>(isSpeaking);

  // 用 Ref 保持回调（避免 useEffect 依赖）
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  // 用 Ref 保存初始值
  const modelUrlRef = useRef<string>(modelUrl);
  const initialEmotionRef = useRef<EmotionState>(emotion);
  const initialIsSpeakingRef = useRef<boolean>(isSpeaking);

  /**
   * 渲染循环（通过 Ref 保持以避免自引用）
   */
  const renderLoopRef = useRef<() => void>(undefined);

  useEffect(() => {
    renderLoopRef.current = () => {
      const currentTime = performance.now();
      const elapsed = currentTime - lastFrameTimeRef.current;

      if (elapsed >= FRAME_INTERVAL) {
        lastFrameTimeRef.current = currentTime - (elapsed % FRAME_INTERVAL);
        timerRef.current.update();
        const deltaTime = timerRef.current.getDelta();

        // 控制器的更新（在 vrm.update() 之前执行）
        expressionControllerRef.current?.update(deltaTime);
        lipSyncControllerRef.current?.update(deltaTime);
        animationControllerRef.current?.update(deltaTime);

        // VRM 的更新
        if (vrmRef.current) {
          vrmRef.current.update(deltaTime);
        }

        // 渲染
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoopRef.current!);
    };
  }, []);

  /**
   * 调整大小处理器
   * 容器尺寸为 0 时跳过（针对布局未完成的处理）
   */
  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width === 0 || height === 0) return;
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  /**
   * 完全释放 VRM 资源
   */
  const disposeVRM = useCallback(() => {
    if (vrmRef.current && sceneRef.current) {
      sceneRef.current.remove(vrmRef.current.scene);
      vrmRef.current.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });
    }
    vrmRef.current = null;
  }, []);

  /**
   * 清理所有资源
   */
  const cleanup = useCallback(() => {
    // 取消动画帧
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 释放控制器
    expressionControllerRef.current?.dispose();
    expressionControllerRef.current = null;
    lipSyncControllerRef.current?.dispose();
    lipSyncControllerRef.current = null;
    animationControllerRef.current?.dispose();
    animationControllerRef.current = null;

    // 释放 VRM 资源
    disposeVRM();
    vrmLoaderRef.current?.dispose();
    vrmLoaderRef.current = null;

    // 释放 Three.js 资源
    timerRef.current.dispose();

    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    if (sceneRef.current) {
      sceneRef.current.clear();
      sceneRef.current = null;
    }

    cameraRef.current = null;
  }, [disposeVRM]);

  /**
   * 主要的初始化与清理 useEffect
   * 将依赖数组置空，仅在挂载时执行一次
   *
   * StrictMode対策:
   * 在 React StrictMode 下会按 挂载→清理→再挂载 的顺序执行。
   * Three.js/VRM 资源的立即销毁→再生成成本较高，因此通过以下策略规避：
   * - 清理时用 setTimeout(0) 安排延迟销毁
   * - 重新挂载时用 clearTimeout 取消延迟销毁
   * - 若 rendererRef.current 仍存在则跳过初始化
   * - 用 isMountedRef 在异步处理（loadModel）完成时进行卸载判定
   */
  useEffect(() => {
    isMountedRef.current = true;

    // StrictMode 重新挂载时：取消延迟清理
    if (cleanupTimerRef.current !== null) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    // 已存在 Renderer 时跳过（StrictMode 重新挂载对策）
    if (rendererRef.current) {
      if (animationFrameRef.current === null && renderLoopRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderLoopRef.current);
      }
      // 用 ResizeObserver 检测容器尺寸变化
      const container = containerRef.current;
      let resizeObserver: ResizeObserver | null = null;
      if (container) {
        resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(container);
      }
      return () => {
        isMountedRef.current = false;
        resizeObserver?.disconnect();
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // === 场景初始化 ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // 摄像头
    const camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov, width / height, CAMERA_CONFIG.near, CAMERA_CONFIG.far
    );
    camera.position.set(CAMERA_CONFIG.position.x, CAMERA_CONFIG.position.y, CAMERA_CONFIG.position.z);
    camera.lookAt(CAMERA_CONFIG.lookAt.x, CAMERA_CONFIG.lookAt.y, CAMERA_CONFIG.lookAt.z);
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // 灯光
    const ambientLight = new THREE.AmbientLight(LIGHT_CONFIG.ambient.color, LIGHT_CONFIG.ambient.intensity);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(LIGHT_CONFIG.directional.color, LIGHT_CONFIG.directional.intensity);
    directionalLight.position.set(
      LIGHT_CONFIG.directional.position.x, LIGHT_CONFIG.directional.position.y, LIGHT_CONFIG.directional.position.z
    );
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(LIGHT_CONFIG.fill.color, LIGHT_CONFIG.fill.intensity);
    fillLight.position.set(LIGHT_CONFIG.fill.position.x, LIGHT_CONFIG.fill.position.y, LIGHT_CONFIG.fill.position.z);
    scene.add(fillLight);

    // Timer：启用 Page Visibility API
    timerRef.current.connect(document);

    // === VRM 模型加载 ===
    const loadModel = async () => {
      if (!sceneRef.current || !modelUrlRef.current) return;

      try {
        const loader = new VRMLoader();
        vrmLoaderRef.current = loader;

        const vrm = await loader.load(modelUrlRef.current, () => { });

        // 已清理时销毁已加载的资源
        if (!isMountedRef.current) {
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

        // 初始化控制器
        expressionControllerRef.current = new ExpressionController(vrm);
        lipSyncControllerRef.current = new LipSyncController(vrm);
        animationControllerRef.current = new AnimationController(vrm);

        // 将 ExpressionController 的引用设置到 AnimationController（避免 blink 冲突）
        animationControllerRef.current.setExpressionController(expressionControllerRef.current);

        // 设置初始感情状态
        expressionControllerRef.current.setEmotion(initialEmotionRef.current);

        // 开始待机动画
        animationControllerRef.current.startIdleAnimations();

        // 发言中时连接口型同步
        if (initialIsSpeakingRef.current) {
          lipSyncControllerRef.current.connectToAudioService();
        }

        // 加载完成回调
        onLoadRef.current?.();
      } catch (error) {
        console.error('VRM模型加载错误:', error);
        const errorObj = error instanceof Error
          ? error
          : new Error('VRM 模型加载失败');
        onErrorRef.current?.(errorObj);
      }
    };

    loadModel();

    // 开始渲染循环
    if (renderLoopRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderLoopRef.current);
    }

    // 用 ResizeObserver 检测容器尺寸变化（比 window.resize 更准确）
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // 清理
    return () => {
      isMountedRef.current = false;
      resizeObserver.disconnect();

      // 取消动画帧
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // StrictMode 对策：用 setTimeout(0) 安排延迟清理。
      // 重新挂载时会用 clearTimeout 取消，因此在 StrictMode 的伪卸载中
      // 资源不会被销毁，仅在真正卸载时执行 cleanup()。
      const currentRenderer = rendererRef.current;
      cleanupTimerRef.current = setTimeout(() => {
        if (rendererRef.current === currentRenderer) {
          cleanup();
        }
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在挂载时执行一次。用 rendererRef.current 的守卫防止 StrictMode 的双重初始化
  }, []);

  // 监听感情状态的变化
  // ※ VRMAvatarContainer 已经整合了 directEmotion 和指标
  //    由于已将 currentEmotion 作为 emotion prop 传入，此处
  //    不再通过 directEmotion 重新覆盖
  useEffect(() => {
    if (emotion !== previousEmotionRef.current) {
      expressionControllerRef.current?.setEmotion(emotion);
      previousEmotionRef.current = emotion;
    }
  }, [emotion]);

  // 监听 viseme 数据的变化
  useEffect(() => {
    if (visemeData && visemeData.length > 0 && lipSyncControllerRef.current) {
      lipSyncControllerRef.current.setVisemeData(visemeData as Array<{ time: number; type: string; value: string }>);
      lipSyncControllerRef.current.startVisemePlayback();
    }
  }, [visemeData]);

  // 监听发言状态的变化
  useEffect(() => {
    if (isSpeaking !== previousIsSpeakingRef.current) {
      if (isSpeaking) {
        lipSyncControllerRef.current?.connectToAudioService();
      } else {
        lipSyncControllerRef.current?.disconnect();
      }
      // 向 AnimationController 通知发言状态（用于抑制待机动作）
      animationControllerRef.current?.setIsSpeaking(isSpeaking);
      previousIsSpeakingRef.current = isSpeaking;
    }
  }, [isSpeaking]);

  // 监听手势的变化
  useEffect(() => {
    if (gesture && gesture !== 'none' && animationControllerRef.current) {
      animationControllerRef.current.triggerGesture(gesture);
    }
  }, [gesture]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
        aria-label="3D化身显示区域"
        role="img"
      />
    </div>
  );
};

export default VRMAvatar;
