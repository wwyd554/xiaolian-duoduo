/**
 * 化身组件导出
 * 导出与 3D 化身功能相关的所有组件和工具函数
 */

// ===== 主要组件 =====
// VRM 化身显示组件（Three.js + @pixiv/three-vrm）
export { default as VRMAvatar } from './VRMAvatar';

// VRM 化身容器（带感情状态管理）
export { default as VRMAvatarContainer } from './VRMAvatarContainer';

// ===== Context =====
// 化身状态管理 Context
export {
  default as AvatarContext,
  AvatarProvider,
  useAvatar,
} from './AvatarContext';

// ===== UI 辅助组件 =====

// ===== 工具类 =====
// VRM 文件加载器
export { default as VRMLoader } from './VRMLoader';
export type { LoadProgressCallback } from './VRMLoader';

// 表情控制器
export { default as ExpressionController } from './ExpressionController';

// 口型同步控制器
export { default as LipSyncController } from './LipSyncController';

// 动画控制器（眨眼、呼吸）
export { default as AnimationController } from './AnimationController';

// ===== 类型定义再导出 =====
export type {
  AvatarInfo,
  AvatarContextState,
  VisemeData,
  VRMExpressionName,
  ExpressionMapping,
  VRMAvatarProps,
  VRMAvatarContainerProps,
} from '../../types/avatar';

// 从感情到表情的映射常量
export { EMOTION_TO_VRM_EXPRESSION } from '../../types/avatar';
