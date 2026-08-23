import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MessageInput from "../../components/conversation/MessageInput";

// mock
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "conversation.input.placeholder": "请输入消息...",
        "conversation.input.send": "发送消息",
        "conversation.input.startVoice": "开始语音输入",
        "conversation.input.stopVoice": "停止语音输入",
        "conversation.input.continueVoice": "继续语音输入（保留现有文本）",
      };
      return translations[key] || key;
    },
  }),
}));

// mock SpeechRecognitionFeedback
jest.mock(
  "../../components/SpeechRecognitionFeedback",
  () => (props: Record<string, unknown>) => (
    <div
      data-testid="speech-recognition-feedback"
      data-props={JSON.stringify(props)}
    >
      Speech Recognition Feedback
    </div>
  ),
);

describe("MessageInput", () => {
  const defaultProps = {
    userInput: "",
    setUserInput: jest.fn(),
    sendMessage: jest.fn(),
    isProcessing: false,
    isListening: false,
    speechRecognitionError: null,
    startSpeechRecognition: jest.fn(),
    switchToTextInput: jest.fn(),
    handleKeyDown: jest.fn(),
    sessionStarted: true,
    sessionEnded: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("会话未开始时不显示", () => {
    const { container } = render(
      <MessageInput {...defaultProps} sessionStarted={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("会话已结束时不显示", () => {
    const { container } = render(
      <MessageInput {...defaultProps} sessionEnded={true} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("文本输入正常工作", () => {
    render(<MessageInput {...defaultProps} />);

    const textField = screen.getByPlaceholderText("请输入消息...");
    fireEvent.change(textField, { target: { value: "测试消息" } });

    expect(defaultProps.setUserInput).toHaveBeenCalledWith("测试消息");
  });

  test("点击发送按钮时调用发送消息", () => {
    render(<MessageInput {...defaultProps} userInput="测试消息" />);

    const sendButton = screen.getByRole("button", { name: "发送消息" });
    fireEvent.click(sendButton);

    expect(defaultProps.sendMessage).toHaveBeenCalledTimes(1);
  });

  test("空消息时发送按钮被禁用", () => {
    render(<MessageInput {...defaultProps} userInput="" />);

    const sendButton = screen.getByRole("button", { name: "发送消息" });
    expect(sendButton).toBeDisabled();
  });

  test("点击语音输入按钮时开始语音识别", () => {
    render(<MessageInput {...defaultProps} />);

    const micButton = screen.getByRole("button", { name: "开始语音输入" });
    fireEvent.click(micButton);

    expect(defaultProps.startSpeechRecognition).toHaveBeenCalledTimes(1);
  });

  test("处理中输入字段被禁用", () => {
    render(<MessageInput {...defaultProps} isProcessing={true} />);

    const textField = screen.getByPlaceholderText("请输入消息...");
    expect(textField).toBeDisabled();

    const sendButton = screen.getByRole("button", { name: "发送消息" });
    expect(sendButton).toBeDisabled();

    const micButton = screen.getByRole("button", { name: "开始语音输入" });
    expect(micButton).toBeDisabled();
  });

  test("监听中输入字段被禁用", () => {
    render(<MessageInput {...defaultProps} isListening={true} userInput="测试语音输入" />);

    const textField = screen.getByPlaceholderText("请输入消息...");
    expect(textField).toBeDisabled();

    // 监听中只要文本存在发送按钮即可用（用户可手动发送）
    const sendButton = screen.getByRole("button", { name: "发送消息" });
    expect(sendButton).toBeEnabled();

    // isListening=true 时按钮标签变为「停止语音输入」，作为停止按钮可用
    const micButton = screen.getByRole("button", { name: "停止语音输入" });
    expect(micButton).toBeEnabled();
  });

  test("监听中有文本时也可点击发送按钮", () => {
    render(<MessageInput {...defaultProps} isListening={true} userInput="测试语音输入" />);

    const sendButton = screen.getByRole("button", { name: "发送消息" });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);
    expect(defaultProps.sendMessage).toHaveBeenCalledTimes(1);
  });

  test("监听中文本为空时发送按钮禁用", () => {
    render(<MessageInput {...defaultProps} isListening={true} userInput="" />);

    const sendButton = screen.getByRole("button", { name: "发送消息" });
    expect(sendButton).toBeDisabled();
  });

  test("键盘事件（Enter）被正确处理", () => {
    render(<MessageInput {...defaultProps} userInput="测试消息" />);

    const textField = screen.getByPlaceholderText("请输入消息...");
    fireEvent.keyDown(textField, { key: "Enter" });

    expect(defaultProps.handleKeyDown).toHaveBeenCalled();
  });

  test("SpeechRecognitionFeedback 组件接收到正确的属性", () => {
    render(
      <MessageInput
        {...defaultProps}
        isListening={true}
        speechRecognitionError="permission"
      />,
    );

    const feedbackComponent = screen.getByTestId("speech-recognition-feedback");
    const props = JSON.parse(
      feedbackComponent.getAttribute("data-props") || "{}",
    );

    expect(props.isListening).toBe(true);
    expect(props.isProcessing).toBe(false);
    expect(props.errorState).toBe("permission");
  });
});
