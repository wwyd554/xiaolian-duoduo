import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Box, Alert, Snackbar } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { VideoRecorderRef } from "../../../types/components";

// 分片上传每个分片的大小（10MB，大于 S3 的最小 5MB）
// 由于录像视频无论大小均通过分片上传发送，
// 即使是长时间会话的大容量视频（超过 200MB）也不会达到 S3 的大小限制
const MULTIPART_PART_SIZE_BYTES = 10 * 1024 * 1024;

interface VideoRecorderProps {
  sessionId: string;
  isActive: boolean; // 会话是否处于激活状态（是否应进行录像）
  onRecordingComplete?: (videoKey: string) => void;
  onError?: (error: string) => void;
  onCameraInitialized?: (initialized: boolean) => void; // 摄像头初始化状态的通知
}

/**
 * 会话录像组件（改良版）
 * 负责摄像头访问、录像和上传
 * 为解决商谈开始时的卸载问题，组件本身保持挂载，
 * 仅修改内部状态，从而跨会话持续录像
 */
const VideoRecorder = forwardRef<VideoRecorderRef, VideoRecorderProps>(({
  sessionId,
  isActive,
  onRecordingComplete,
  onError,
  onCameraInitialized,
}, ref) => {
  const { t } = useTranslation();

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<number | null>(null);

  // state
  const [isAccessGranted, setIsAccessGranted] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [, setRecordingDuration] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  // 摄像头访问的初始化 - 仅在组件挂载时执行一次
  useEffect(() => {
    if (import.meta.env.DEV) console.log("Component mounted");

    // 摄像头访问初始化函数
    const initializeCamera = async () => {
      try {
        if (import.meta.env.DEV) console.log("Requesting camera access");
        setError("");

        // 添加超时处理（10 秒）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Camera initialization timeout")), 10000);
        });

        const stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: true,
          }),
          timeoutPromise
        ]);

        // 将流保存到 ref
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsAccessGranted(true);
          if (import.meta.env.DEV) console.log("Camera initialized");
          // 向父组件通知摄像头初始化完成
          if (onCameraInitialized) onCameraInitialized(true);
        }
      } catch (error) {
        console.error("Camera access error:", error);
        setError(t("recording.cameraAccessError"));
        setSnackbarOpen(true);
        if (onError) onError(t("recording.cameraAccessError"));
        // 向父组件通知摄像头初始化失败
        if (onCameraInitialized) onCameraInitialized(false);
      }
    };

    // 组件挂载时初始化摄像头
    initializeCamera();

    // 清理函数
    return () => {
      if (import.meta.env.DEV) console.log("Component unmounting - releasing resources");
      stopRecording();
      releaseCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 以空依赖数组在组件挂载时仅执行一次

  // isActive 属性发生变化时的处理
  useEffect(() => {
    if (import.meta.env.DEV) console.log(
      "isActive changed:",
      isActive,
      "recording:",
      isRecording,
      "sessionId:",
      sessionId,
      "camera initialized:",
      isAccessGranted,
    );

    if (isActive && !isRecording && sessionId) {
      // 仅当会话处于激活状态且 sessionId 有效时开始录像
      // 摄像头初始化完成后立即开始录像
      if (isAccessGranted) {
        if (import.meta.env.DEV) console.log("Camera initialized, starting recording");
        startRecording();
      } else {
        if (import.meta.env.DEV) console.log("Waiting for camera initialization, recording deferred");
      }
    } else if (!isActive && isRecording) {
      // 会话变为非激活状态时停止录像
      stopRecording();
    } else if (isActive && !sessionId) {
      // sessionId 无效时输出警告
      console.warn("Recording start requested but sessionId is empty");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isRecording, sessionId]);

  // 释放摄像头流
  const releaseCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsAccessGranted(false);

    // 释放预览 URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  };

  // 録画開始
  const startRecording = () => {
    if (isRecording || !isAccessGranted) return;

    if (import.meta.env.DEV) console.log("Recording started");

    if (!streamRef.current) {
      console.error("Camera stream not available");
      setError(t("recording.cameraNotInitialized"));
      setSnackbarOpen(true);
      return;
    }

    try {
      // 仅支持 MP4 格式
      // 限制比特率以控制文件大小（应对 S3 上传上限）
      const videoBitsPerSecond = 1_500_000; // 1.5Mbps（录像 10 分钟约 112MB 以内）
      let options: MediaRecorderOptions;
      if (MediaRecorder.isTypeSupported("video/mp4; codecs=h264")) {
        options = { mimeType: "video/mp4; codecs=h264", videoBitsPerSecond };
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        options = { mimeType: "video/mp4", videoBitsPerSecond };
      } else {
        throw new Error(t("recording.browserNotSupported"));
      }

      // 重置数据块
      chunksRef.current = [];

      // 创建 MediaRecorder 实例
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);

      // 数据获取的事件处理器
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // 录像停止时的处理
      mediaRecorderRef.current.onstop = () => {
        if (import.meta.env.DEV) console.log("Recording stopped");

        try {
          // 以 MP4 格式创建 Blob
          const blob = new Blob(chunksRef.current, { type: "video/mp4" });
          if (import.meta.env.DEV) console.log(
            "Recording blob size:",
            blob.size,
            "bytes",
            "MIME type: video/mp4",
          );

          // 释放之前的 URL
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          // 仅对有效的 Blob 创建 URL
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);

            // 保存录像数据
            saveRecordingData(blob);
          } else {
            console.warn("Empty blob generated");
          }
        } catch (err) {
          console.error("Recording data processing error:", err);
        }

        // 重置录像时长
        stopDurationTimer();
        setIsRecording(false);
      };

      // 録画開始
      mediaRecorderRef.current.start(100); // 每 100ms 获取数据
      setIsRecording(true);
      startDurationTimer();
    } catch (error) {
      console.error("Recording start error:", error);
      setError(t("recording.startError"));
      setSnackbarOpen(true);
      if (onError) onError(t("recording.startError"));
    }
  };

  // 録画停止
  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    if (import.meta.env.DEV) console.log("Recording stopped");

    try {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } catch (error) {
      console.error("Recording stop error:", error);
    }
  };

  // 开始录像时长计时器
  const startDurationTimer = () => {
    setRecordingDuration(0);
    durationTimerRef.current = window.setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  // 停止录像时长计时器
  const stopDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  // 单个分片的上传（带重试功能，返回 ETag）
  const uploadPartWithRetry = async (
    url: string,
    partBlob: Blob,
    partNumber: number,
    maxRetries = 3,
  ): Promise<string> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 每个分片 5 分钟超时

        const response = await fetch(url, {
          method: "PUT",
          body: partBlob,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        // S3 在分片上传的响应中返回 ETag 头
        // （已通过 CORS 的 exposedHeaders 公开 ETag）
        const eTag = response.headers.get("ETag");
        if (!eTag) {
          throw new Error(`ETag header not found for part ${partNumber}`);
        }

        if (import.meta.env.DEV) {
          console.log(`Part ${partNumber} uploaded: eTag=${eTag}`);
        }
        return eTag;
      } catch (error) {
        console.error(`Part ${partNumber} upload attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          throw error;
        }
        // 以指数退避方式等待
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    // 此处不会到达，但为类型明确写出
    throw new Error(`Failed to upload part ${partNumber}`);
  };

  // 向 localStorage 写入（即使在 Safari 隐私模式等情况下抛出异常，
  // 为不让整个上传成功处理失败，用 try-catch 保护）
  const safeSetLocalStorage = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (storageError) {
      console.warn(`localStorage保存失败（key=${key}）:`, storageError);
    }
  };

  // 分片上传（面向长时间会话的大容量视频）
  // 成功时返回服务端编号的视频键（videos/{sessionId}/...）。
  // 调用方将该键用于下游处理（localStorage、录像完成通知），
  // 在前端与后端之间统一键。
  const uploadWithMultipart = async (
    blob: Blob,
    sessionId: string,
    videoKey: string,
  ): Promise<string> => {
    const { ApiService } = await import("../../../services/ApiService");
    const apiService = ApiService.getInstance();

    // 计算分片数量（按 S3 规范，除最后一个分片外需 5MB 以上）
    const partCount = Math.ceil(blob.size / MULTIPART_PART_SIZE_BYTES);
    const fileName = videoKey.split("/").pop() || "recording.mp4";

    if (import.meta.env.DEV) {
      console.log(
        `Multipart upload start: size=${Math.round(blob.size / 1024 / 1024 * 100) / 100}MB, parts=${partCount}`,
      );
    }

    // 开始分片上传，获取各分片的签名 URL
    const { uploadId, videoKey: serverVideoKey, partUrls } =
      await apiService.createMultipartUpload(sessionId, "video/mp4", partCount, fileName);

    try {
      // 依次上传各分片并收集 ETag
      const uploadedParts: Array<{ partNumber: number; eTag: string }> = [];
      for (const { partNumber, url } of partUrls) {
        const start = (partNumber - 1) * MULTIPART_PART_SIZE_BYTES;
        const end = Math.min(start + MULTIPART_PART_SIZE_BYTES, blob.size);
        const partBlob = blob.slice(start, end);

        const eTag = await uploadPartWithRetry(url, partBlob, partNumber);
        uploadedParts.push({ partNumber, eTag });
      }

      // 全部分片完成后，指示 S3 合并分片
      await apiService.completeMultipartUpload(serverVideoKey, uploadId, uploadedParts);

      if (import.meta.env.DEV) console.log("Multipart upload success:", serverVideoKey);

      // 以服务端编号的键保存并通知，使前后端键保持一致
      safeSetLocalStorage("lastRecordingKey", serverVideoKey);

      // 触发录像完成事件
      const event = new CustomEvent("recordingComplete", {
        detail: { videoKey: serverVideoKey, sessionId },
      });
      window.dispatchEvent(event);

      // 返回给调用方，以便其使用服务端编号的键
      return serverVideoKey;
    } catch (error) {
      // 失败时中止分片上传并销毁残留分片
      console.error("Multipart upload failed, aborting:", error);
      await apiService.abortMultipartUpload(serverVideoKey, uploadId);
      throw error;
    }
  };

  // 录像数据的保存处理
  const saveRecordingData = async (blob: Blob) => {
    try {
      // sessionId 无效时抛出错误
      if (!sessionId || sessionId.trim() === "") {
        throw new Error(t("recording.sessionIdNotSet"));
      }

      // 本地临时键。上传成功时用服务端编号的键覆盖
      const localVideoKey = `session_${sessionId}_${new Date().getTime()}.mp4`;
      if (import.meta.env.DEV) console.log("S3 upload start:", localVideoKey, "size:", Math.round(blob.size / 1024 / 1024 * 100) / 100, "MB");

      // 通过分片上传保存到 S3
      // 无论文件大小统一采用分片方式，
      // 即使是长时间会话的大容量视频（超过 200MB）也不会达到 S3 的大小限制
      // 上传成功时采用服务端编号的键（videos/{sessionId}/...）
      let resultVideoKey = localVideoKey;
      try {
        resultVideoKey = await uploadWithMultipart(blob, sessionId, localVideoKey);
      } catch (uploadError) {
        console.error("S3 upload process error:", uploadError);
        // 即使发生错误，也向父组件传递错误信息
        if (onError) {
          onError(t("recording.uploadError"));
        }
        // 即使发生错误也传递 videoKey 并继续处理
      }

      if (import.meta.env.DEV) console.log("Recording data saved:", resultVideoKey);

      // 调用回调（即使发生错误也传递 videoKey）
      // 成功时传入服务端编号的键，失败时传入本地临时键
      if (onRecordingComplete) {
        onRecordingComplete(resultVideoKey);
      }
    } catch (err) {
      console.error("Recording data processing failed:", err);
      if (onError) {
        onError(t("recording.recordingDataProcessingFailed"));
      }
    }
  };

  // 对外公开用于显式停止录像的方法
  useImperativeHandle(ref, () => ({
    forceStopRecording: async () => {
      if (import.meta.env.DEV) console.log("VideoRecorder: forceStopRecording called");
      return new Promise<void>((resolve) => {
        if (isRecording && mediaRecorderRef.current) {
          if (import.meta.env.DEV) console.log("VideoRecorder: Recording in progress, stopping");

          // 设置用于等待录像停止完成的事件监听器
          const handleStop = () => {
            if (import.meta.env.DEV) console.log("VideoRecorder: Recording stopped");
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.removeEventListener('stop', handleStop);
            }
            resolve();
          };

          mediaRecorderRef.current.addEventListener('stop', handleStop);
          stopRecording();
        } else {
          if (import.meta.env.DEV) console.log("VideoRecorder: Not recording, skipping stop");
          resolve();
        }
      });
    }
  }));

  // 关闭 Snackbar
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box sx={{ borderRadius: 1, overflow: "hidden", lineHeight: 0 }}>
      {/* 错误显示用 Snackbar */}
      <Snackbar
        open={snackbarOpen && !!error}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="error"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* 视频预览 */}
      <Box sx={{ position: "relative" }}>
        {previewUrl ? (
          <Box sx={{ position: "relative" }}>
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              width="100%"
              height="auto"
              style={{ display: "block", borderRadius: 4 }}
              onError={(e) => {
                console.error("Video load error:", e);
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl("");
                }
              }}
            />
          </Box>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            width="100%"
            height="auto"
            style={{ display: "block", borderRadius: 4 }}
          />
        )}
      </Box>

      {/* 录像状态指示器 */}
      {isActive && (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            animation: "pulse 1.5s infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.4 },
            },
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }}
          aria-label={t("recording.recordingActive")}
        />
      )}
    </Box>
  );
});

VideoRecorder.displayName = 'VideoRecorder';

export default VideoRecorder;
