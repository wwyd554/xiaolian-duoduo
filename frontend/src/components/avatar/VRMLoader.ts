/**
 * VRM 文件加载器
 * 使用 GLTFLoader + VRMLoaderPlugin 异步加载 VRM 文件
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm';

export type LoadProgressCallback = (progress: number) => void;

export class VRMLoader {
  private loader: GLTFLoader;
  private currentVRM: VRM | null = null;

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * 异步加载 VRM 文件
   */
  async load(url: string, onProgress?: LoadProgressCallback): Promise<VRM> {
    console.log('VRMLoader: Loading VRM from URL:', url);
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
            reject(new Error('未找到 VRM 数据'));
            return;
          }

          // 在 @pixiv/three-vrm v3.x 中使用 VRMUtils.rotateVRM0
          // 仅 VRM 0.x 格式需要旋转处理
          // VRM 1.0 格式无需旋转处理
          try {
            // 仅当 VRMUtils 存在且有 rotateVRM0 方法时执行
            if (typeof VRMUtils?.rotateVRM0 === 'function') {
              VRMUtils.rotateVRM0(vrm);
            }
          } catch {
            // 旋转处理失败也继续（因 VRM 1.0 无需此处理）
          }

          this.currentVRM = vrm;
          resolve(vrm);
        },
        (progress) => {
          if (onProgress && progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            onProgress(percent);
          }
        },
        (error) => {
          console.error('VRM加载错误:', error);
          reject(error instanceof Error ? error : new Error('VRM 加载失败'));
        }
      );
    });
  }

  /**
   * 获取当前 VRM
   */
  getCurrentVRM(): VRM | null {
    return this.currentVRM;
  }

  /**
   * 资源释放
   */
  dispose(): void {
    if (this.currentVRM) {
      // 从 VRM 场景中删除所有对象
      this.currentVRM.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
      this.currentVRM = null;
    }
  }
}

export default VRMLoader;
