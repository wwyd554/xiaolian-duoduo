import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SpeechRecognitionFeedback from "../../components/SpeechRecognitionFeedback";

// i18n 的 mock
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "speech.listening": "正在聆听...",
        "speech.processing": "处理中...",
        "speech.a11y.listening": "正在语音识别，请说话。",
        "speech.a11y.processing": "正在处理语音，请稍候。",
        "speech.error.permissionDenied": "麦克风使用未获得许可。",
        "speech.error.noSpeech": "未检测到语音。",
        "speech.error.network": "发生网络错误。",
        "speech.error.notSupported":
          "您的浏览器不支持语音识别。",
        "speech.error.unknown": "发生意外错误。",
        "speech.switchToTextInput": "切换到文本输入",
        "speech.switchToText": "切换到文本输入",
      };
      return translations[key] || key;
    },
  }),
}));

describe("SpeechRecognitionFeedback", () => {
  test("聆听中的状态正确显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={true}
        isProcessing={false}
        errorState={null}
      />,
    );

    // 聆听中的文本显示
    expect(screen.getByText("正在聆听...")).toBeInTheDocument();

    // 图标显示 (Mic 图标)
    const micIcon = document.querySelector("svg");
    expect(micIcon).toBeInTheDocument();
  });

  test("处理中的状态正确显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={true}
        errorState={null}
      />,
    );

    // 处理中的文本显示
    expect(screen.getByText("处理中...")).toBeInTheDocument();

    // 进度指示器显示
    const progressIndicator = document.querySelector(
      ".MuiCircularProgress-root",
    );
    expect(progressIndicator).toBeInTheDocument();
  });

  test("非活动状态不显示任何内容", () => {
    const { container } = render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState={null}
      />,
    );

    // 无任何显示
    expect(container).toBeEmptyDOMElement();
  });

  test("麦克风权限错误显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="permission"
        onSwitchToTextInput={() => {}}
      />,
    );

    // 错误消息显示
    expect(
      screen.getByText("麦克风使用未获得许可。"),
    ).toBeInTheDocument();

    // 文本输入切换按钮显示
    expect(screen.getByText("切换到文本输入")).toBeInTheDocument();
  });

  test("未检测到语音错误显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="no-speech"
      />,
    );

    expect(
      screen.getByText("未检测到语音。"),
    ).toBeInTheDocument();
  });

  test("网络错误显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="network"
      />,
    );

    expect(
      screen.getByText("发生网络错误。"),
    ).toBeInTheDocument();
  });

  test("浏览器不支持错误显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="not-supported"
      />,
    );

    expect(
      screen.getByText("您的浏览器不支持语音识别。"),
    ).toBeInTheDocument();
  });

  test("未知错误显示", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="unknown"
      />,
    );

    expect(
      screen.getByText("发生意外错误。"),
    ).toBeInTheDocument();
  });

  test("点击切换到文本输入按钮时被调用", () => {
    const handleSwitchToTextInput = jest.fn();

    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="permission"
        onSwitchToTextInput={handleSwitchToTextInput}
      />,
    );

    // 点击文本输入切换按钮
    fireEvent.click(screen.getByText("切换到文本输入"));

    // 确认回调被调用
    expect(handleSwitchToTextInput).toHaveBeenCalledTimes(1);
  });

  test("为无障碍设置了 aria 属性", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={true}
        isProcessing={false}
        errorState={null}
      />,
    );

    // 聆听状态的 aria-live 元素
    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveAttribute("aria-live", "polite");

    // 面向屏幕阅读器的文本
    expect(
      screen.getByText("正在语音识别，请说话。"),
    ).toBeInTheDocument();
  });

  test("错误时的提示包含 aria-live", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="network"
      />,
    );

    // 错误提示的 aria-live 元素
    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveAttribute("aria-live", "assertive");
  });
});
