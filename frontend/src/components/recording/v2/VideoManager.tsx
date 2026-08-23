import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Box } from "@mui/material";
import VideoRecorder from "./VideoRecorder";
import type { VideoManagerRef, VideoRecorderRef } from "../../../types/components";

interface VideoManagerProps {
  sessionId: string;
  sessionStarted: boolean;
  sessionEnded: boolean;
  onCameraInitialized?: (initialized: boolean) => void; // 摄像头初始化状态的通知
}

/**
 * 视频录像管理组件
 * 在整个会话生命周期内管理视频录像状态。
 * 由于该组件会在商谈页面中持续显示，
 * 规避商谈开始时的组件重新挂载问题。
 */
const VideoManager = forwardRef<VideoManagerRef, VideoManagerProps>(({
  sessionId,
  sessionStarted,
  sessionEnded,
  onCameraInitialized,
}, ref) => {
  const [videoKey, setVideoKey] = useState<string>("");
  const [recordingError, setRecordingError] = useState<string>("");
  const videoRecorderRef = useRef<VideoRecorderRef | null>(null);

  // 记录 sessionId 的变化日志（详细版）
  useEffect(() => {
    console.log(
      "VideoManager: sessionId変更:",
      sessionId,
      "sessionStarted:",
      sessionStarted,
      "sessionEnded:",
      sessionEnded,
      "isActive計算結果:",
      sessionStarted && !sessionEnded && sessionId !== "",
    );
  }, [sessionId, sessionStarted, sessionEnded]);

  // 录像完成时的处理
  const handleRecordingComplete = (key: string) => {
    console.log(`録画完了: ${key}`);
    setVideoKey(key);

    // 将会话信息与录像键关联保存
    localStorage.setItem(`session_${sessionId}_videoKey`, key);
    localStorage.setItem("lastRecordingKey", key);
  };

  // 错误处理
  const handleRecordingError = (error: string) => {
    console.error(`录制错误: ${error}`);
    setRecordingError(error);
  };

  // videoKey 发生变化时在控制台记录
  useEffect(() => {
    if (videoKey) {
      console.log(`VideoManager: 已设置新的videoKey: ${videoKey}`);
    }
  }, [videoKey]);

  // 公开用于从父组件显式停止录像的函数
  useImperativeHandle(ref, () => ({
    forceStopRecording: async () => {
      console.log("VideoManager: 已请求显式停止录制");
      if (videoRecorderRef.current) {
        return await videoRecorderRef.current.forceStopRecording();
      }
      return Promise.resolve();
    }
  }));

  // sessionEnded 变化时的显式处理
  useEffect(() => {
    if (sessionEnded && sessionStarted && videoRecorderRef.current) {
      console.log("VideoManager: 检测到sessionEnded，执行停止录制处理");
      
      // 确保执行录像停止处理
      const forceStopWithRetry = async () => {
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            console.log(`VideoManager: 録画停止試行 ${attempts + 1}/${maxAttempts}`);
            if (videoRecorderRef.current) {
              await videoRecorderRef.current.forceStopRecording();
              console.log("VideoManager: 録画停止完了");
              break;
            }
          } catch (error) {
            console.error(`VideoManager: 停止录制尝试第 ${attempts + 1} 次出错:`, error);
            attempts++;
            
            if (attempts < maxAttempts) {
              // 等待 1 秒后重试
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        if (attempts >= maxAttempts) {
          console.error("VideoManager: 停止录制已达到最大尝试次数");
        }
      };
      
      // 稍作延迟后确保执行录像停止
      setTimeout(() => {
        forceStopWithRetry();
      }, 100);
    }
  }, [sessionEnded, sessionStarted]);

  return (
    <Box>
      {/* 
        VideoRecorder 组件保持挂载，
        通过 isActive 属性控制录像的开/关
      */}
      <VideoRecorder
        ref={videoRecorderRef}
        sessionId={sessionId}
        isActive={sessionStarted && !sessionEnded && sessionId !== ""}
        onRecordingComplete={handleRecordingComplete}
        onError={handleRecordingError}
        onCameraInitialized={onCameraInitialized}
      />

      {recordingError && (
        <Box
          mt={1}
          p={1}
          bgcolor="error.light"
          color="error.contrastText"
          borderRadius={1}
        >
          {recordingError}
        </Box>
      )}
    </Box>
  );
});

VideoManager.displayName = 'VideoManager';

export default VideoManager;
