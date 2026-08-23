import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorAlert from "../../components/ErrorAlert";

// i18n 的 mock
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "common.error": "错误",
        "common.warning": "警告",
        "common.info": "通知",
        "common.success": "成功",
        "common.retry": "重试",
        "common.close": "关闭",
      };
      return translations[key] || key;
    },
  }),
}));

describe("ErrorAlert", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    message: "测试错误消息",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Snackbar 模式下错误提示显示", () => {
    render(<ErrorAlert {...defaultProps} />);

    // 标题和消息显示
    expect(screen.getByText("错误")).toBeInTheDocument();
    expect(screen.getByText("测试错误消息")).toBeInTheDocument();
  });

  test("全屏模式下错误提示显示", () => {
    render(<ErrorAlert {...defaultProps} fullScreen={true} />);

    // 标题和消息显示
    expect(screen.getByText("错误")).toBeInTheDocument();
    expect(screen.getByText("测试错误消息")).toBeInTheDocument();

    // 关闭按钮显示
    expect(screen.getByText("关闭")).toBeInTheDocument();
  });

  test("自定义标题生效", () => {
    render(<ErrorAlert {...defaultProps} title="自定义错误标题" />);

    expect(screen.getByText("自定义错误标题")).toBeInTheDocument();
    expect(screen.getByText("测试错误消息")).toBeInTheDocument();
  });

  test("各种 severity 正确应用", () => {
    // 警告
    const { rerender } = render(
      <ErrorAlert {...defaultProps} severity="warning" />,
    );
    expect(screen.getByText("警告")).toBeInTheDocument();

    // 信息
    rerender(<ErrorAlert {...defaultProps} severity="info" />);
    expect(screen.getByText("通知")).toBeInTheDocument();

    // 成功
    rerender(<ErrorAlert {...defaultProps} severity="success" />);
    expect(screen.getByText("成功")).toBeInTheDocument();
  });

  test("点击关闭按钮时调用 onClose", () => {
    render(<ErrorAlert {...defaultProps} />);

    // 点击关闭图标
    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test("全屏模式下点击关闭按钮时调用 onClose", () => {
    render(<ErrorAlert {...defaultProps} fullScreen={true} />);

    // 点击关闭按钮
    const closeButton = screen.getByText("关闭");
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test("重试按钮显示，点击时调用 onRetry", () => {
    const onRetry = jest.fn();

    // Snackbar 模式
    const { rerender } = render(
      <ErrorAlert {...defaultProps} onRetry={onRetry} />,
    );

    // 点击重试按钮
    const retryButton = screen.getByText("重试");
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);

    // 全屏模式
    onRetry.mockClear();
    rerender(
      <ErrorAlert {...defaultProps} onRetry={onRetry} fullScreen={true} />,
    );

    // 点击重试按钮
    const fullScreenRetryButton = screen.getAllByText("重试")[0];
    fireEvent.click(fullScreenRetryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("没有重试处理函数时不显示重试按钮", () => {
    render(<ErrorAlert {...defaultProps} />);

    // 重试按钮不显示
    expect(screen.queryByText("重试")).not.toBeInTheDocument();
  });

  test("open 为 false 时全屏提示不显示", () => {
    const { container } = render(
      <ErrorAlert {...defaultProps} open={false} fullScreen={true} />,
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveStyle("display: none");
  });
});
