import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MessageList from "../../components/conversation/MessageList";
import type { Scenario, Metrics } from "../../types/index";

// i18n mock（直接返回 key 对应的中文以便识别分支）
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "conversation.startQuestion": "开始商谈吗？",
        "conversation.startButton": "开始商谈",
        "conversation.startButtonNoRecording": "开始商谈（无录制）",
        "conversation.cameraInitializing": "摄像头初始化中...",
        "conversation.cameraInitializingMessage": "正在初始化摄像头...",
        "conversation.cameraAccessFailed": "访问摄像头失败",
        "conversation.recordingDisabledMessage": "视频录制已关闭",
      };
      return translations[key] || key;
    },
  }),
}));

// mock dialogueEngine 的 getSessionEndReason（用于会话结束提示）
jest.mock("../../utils/dialogueEngine", () => ({
  getSessionEndReason: () => "会话结束原因",
}));

describe("MessageList - 视频录制开/关对开始按钮的影响", () => {
  const mockScenario: Scenario = {
    id: "test-scenario",
    title: "测试场景",
    description: "测试用场景说明",
    difficulty: "normal",
    industry: "IT",
    npc: {
      id: "npc-1",
      name: "测试太郎",
      role: "部长",
      company: "测试株式会社",
      personality: [],
      avatar: "👤",
      description: "",
    },
    initialMetrics: {
      angerLevel: 1,
      trustLevel: 1,
      progressLevel: 1,
    },
    goals: [],
  };

  const mockMetrics: Metrics = {
    angerLevel: 1,
    trustLevel: 1,
    progressLevel: 1,
  };

  const defaultProps = {
    messages: [],
    isProcessing: false,
    sessionStarted: false,
    sessionEnded: false,
    currentMetrics: mockMetrics,
    scenario: mockScenario,
    onStartConversation: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("开始前直接确认练习，不再要求预选输入方式", () => {
    render(<MessageList {...defaultProps} />);
    expect(
      screen.queryByRole("button", { name: "语音练习" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "文字练习" }),
    ).not.toBeInTheDocument();
    expect(defaultProps.onStartConversation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("start-conversation-button"));
    expect(defaultProps.onStartConversation).toHaveBeenCalledTimes(1);
  });

  describe("录制开启时（videoRecordingEnabled = true）", () => {
    test("摄像头未初始化且无错误时，开始按钮禁用并显示摄像头初始化中标签", () => {
      render(
        <MessageList
          {...defaultProps}
          videoRecordingEnabled={true}
          isCameraInitialized={false}
          cameraError={false}
        />,
      );

      const button = screen.getByTestId("start-conversation-button");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("摄像头初始化中...");
    });

    test("摄像头初始化完成时，开始按钮启用并显示常规开始商谈标签", () => {
      render(
        <MessageList
          {...defaultProps}
          videoRecordingEnabled={true}
          isCameraInitialized={true}
          cameraError={false}
        />,
      );

      const button = screen.getByTestId("start-conversation-button");
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent("开始商谈");
    });

    test("摄像头错误时，开始按钮启用并显示无录制标签", () => {
      render(
        <MessageList
          {...defaultProps}
          videoRecordingEnabled={true}
          isCameraInitialized={false}
          cameraError={true}
        />,
      );

      const button = screen.getByTestId("start-conversation-button");
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent("开始商谈");
    });
  });

  describe("录制关闭时（videoRecordingEnabled = false）", () => {
    test("无论摄像头初始化状态如何，开始按钮立即可用并显示无录制标签", () => {
      render(
        <MessageList
          {...defaultProps}
          videoRecordingEnabled={false}
          isCameraInitialized={false}
          cameraError={false}
        />,
      );

      const button = screen.getByTestId("start-conversation-button");
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent("开始商谈");
    });

    test("不显示无关的录制关闭消息", () => {
      render(<MessageList {...defaultProps} videoRecordingEnabled={false} />);

      expect(screen.queryByText("视频录制已关闭")).not.toBeInTheDocument();
    });

    test("录制关闭时不显示摄像头初始化中消息", () => {
      render(
        <MessageList
          {...defaultProps}
          videoRecordingEnabled={false}
          isCameraInitialized={false}
          cameraError={false}
        />,
      );

      expect(screen.queryByText("正在初始化摄像头...")).not.toBeInTheDocument();
    });
  });

  describe("videoRecordingEnabled 未指定（默认 = 录制关闭）", () => {
    test("默认按录制关闭处理，开始按钮可直接使用（无录制）", () => {
      render(
        <MessageList
          {...defaultProps}
          isCameraInitialized={false}
          cameraError={false}
        />,
      );

      const button = screen.getByTestId("start-conversation-button");
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent("开始商谈");
    });
  });
});
