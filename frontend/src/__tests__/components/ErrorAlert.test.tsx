import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorAlert from "../../components/ErrorAlert";

// i18nのモック
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "common.error": "エラー",
        "common.warning": "警告",
        "common.info": "お知らせ",
        "common.success": "成功",
        "common.retry": "再試行",
        "common.close": "閉じる",
      };
      return translations[key] || key;
    },
  }),
}));

describe("ErrorAlert", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    message: "テストエラーメッセージ",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Snackbarモードでエラーアラートが表示される", () => {
    render(<ErrorAlert {...defaultProps} />);

    // タイトルとメッセージが表示されている
    expect(screen.getByText("エラー")).toBeInTheDocument();
    expect(screen.getByText("テストエラーメッセージ")).toBeInTheDocument();
  });

  test("フルスクリーンモードでエラーアラートが表示される", () => {
    render(<ErrorAlert {...defaultProps} fullScreen={true} />);

    // タイトルとメッセージが表示されている
    expect(screen.getByText("エラー")).toBeInTheDocument();
    expect(screen.getByText("テストエラーメッセージ")).toBeInTheDocument();

    // 閉じるボタンが表示されている
    expect(screen.getByText("閉じる")).toBeInTheDocument();
  });

  test("カスタムタイトルが適用される", () => {
    render(<ErrorAlert {...defaultProps} title="カスタムエラータイトル" />);

    expect(screen.getByText("カスタムエラータイトル")).toBeInTheDocument();
    expect(screen.getByText("テストエラーメッセージ")).toBeInTheDocument();
  });

  test("各種severityが正しく適用される", () => {
    // 警告
    const { rerender } = render(
      <ErrorAlert {...defaultProps} severity="warning" />,
    );
    expect(screen.getByText("警告")).toBeInTheDocument();

    // 情報
    rerender(<ErrorAlert {...defaultProps} severity="info" />);
    expect(screen.getByText("お知らせ")).toBeInTheDocument();

    // 成功
    rerender(<ErrorAlert {...defaultProps} severity="success" />);
    expect(screen.getByText("成功")).toBeInTheDocument();
  });

  test("閉じるボタンがクリックされるとonCloseが呼ばれる", () => {
    render(<ErrorAlert {...defaultProps} />);

    // 閉じるアイコンをクリック
    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test("フルスクリーンモードで閉じるボタンがクリックされるとonCloseが呼ばれる", () => {
    render(<ErrorAlert {...defaultProps} fullScreen={true} />);

    // 閉じるボタンをクリック
    const closeButton = screen.getByText("閉じる");
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test("再試行ボタンが表示され、クリックするとonRetryが呼ばれる", () => {
    const onRetry = jest.fn();

    // Snackbarモード
    const { rerender } = render(
      <ErrorAlert {...defaultProps} onRetry={onRetry} />,
    );

    // 再試行ボタンをクリック
    const retryButton = screen.getByText("再試行");
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);

    // フルスクリーンモード
    onRetry.mockClear();
    rerender(
      <ErrorAlert {...defaultProps} onRetry={onRetry} fullScreen={true} />,
    );

    // 再試行ボタンをクリック
    const fullScreenRetryButton = screen.getAllByText("再試行")[0];
    fireEvent.click(fullScreenRetryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("再試行ハンドラがない場合は再試行ボタンが表示されない", () => {
    render(<ErrorAlert {...defaultProps} />);

    // 再試行ボタンが表示されていない
    expect(screen.queryByText("再試行")).not.toBeInTheDocument();
  });

  test("openがfalseの場合、フルスクリーンアラートが表示されない", () => {
    const { container } = render(
      <ErrorAlert {...defaultProps} open={false} fullScreen={true} />,
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveStyle("display: none");
  });
});
