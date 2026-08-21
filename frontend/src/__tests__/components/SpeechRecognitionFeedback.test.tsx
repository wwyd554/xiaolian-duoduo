import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SpeechRecognitionFeedback from "../../components/SpeechRecognitionFeedback";

// i18nのモック
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "speech.listening": "リスニング中...",
        "speech.processing": "処理中...",
        "speech.a11y.listening": "音声認識中です。話しかけてください。",
        "speech.a11y.processing": "音声を処理中です。お待ちください。",
        "speech.error.permissionDenied": "マイクの使用が許可されていません。",
        "speech.error.noSpeech": "音声が検出されませんでした。",
        "speech.error.network": "ネットワークエラーが発生しました。",
        "speech.error.notSupported":
          "お使いのブラウザは音声認識に対応していません。",
        "speech.error.unknown": "予期しないエラーが発生しました。",
        "speech.switchToTextInput": "テキスト入力に切り替える",
        "speech.switchToText": "テキスト入力に切り替え",
      };
      return translations[key] || key;
    },
  }),
}));

describe("SpeechRecognitionFeedback", () => {
  test("リスニング中の状態が正しく表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={true}
        isProcessing={false}
        errorState={null}
      />,
    );

    // リスニング中のテキストが表示されている
    expect(screen.getByText("リスニング中...")).toBeInTheDocument();

    // アイコンが表示されている (Micアイコン)
    const micIcon = document.querySelector("svg");
    expect(micIcon).toBeInTheDocument();
  });

  test("処理中の状態が正しく表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={true}
        errorState={null}
      />,
    );

    // 処理中のテキストが表示されている
    expect(screen.getByText("処理中...")).toBeInTheDocument();

    // プログレスインジケータが表示されている
    const progressIndicator = document.querySelector(
      ".MuiCircularProgress-root",
    );
    expect(progressIndicator).toBeInTheDocument();
  });

  test("非アクティブ状態では何も表示されない", () => {
    const { container } = render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState={null}
      />,
    );

    // 何も表示されていない
    expect(container).toBeEmptyDOMElement();
  });

  test("マイク許可エラーが表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="permission"
        onSwitchToTextInput={() => {}}
      />,
    );

    // エラーメッセージが表示されている
    expect(
      screen.getByText("マイクの使用が許可されていません。"),
    ).toBeInTheDocument();

    // テキスト入力切替ボタンが表示されている
    expect(screen.getByText("テキスト入力に切り替え")).toBeInTheDocument();
  });

  test("音声未検出エラーが表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="no-speech"
      />,
    );

    expect(
      screen.getByText("音声が検出されませんでした。"),
    ).toBeInTheDocument();
  });

  test("ネットワークエラーが表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="network"
      />,
    );

    expect(
      screen.getByText("ネットワークエラーが発生しました。"),
    ).toBeInTheDocument();
  });

  test("ブラウザ非対応エラーが表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="not-supported"
      />,
    );

    expect(
      screen.getByText("お使いのブラウザは音声認識に対応していません。"),
    ).toBeInTheDocument();
  });

  test("不明なエラーが表示される", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="unknown"
      />,
    );

    expect(
      screen.getByText("予期しないエラーが発生しました。"),
    ).toBeInTheDocument();
  });

  test("テキスト入力に切り替えボタンがクリックで呼び出される", () => {
    const handleSwitchToTextInput = jest.fn();

    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="permission"
        onSwitchToTextInput={handleSwitchToTextInput}
      />,
    );

    // テキスト入力切替ボタンをクリック
    fireEvent.click(screen.getByText("テキスト入力に切り替え"));

    // コールバックが呼ばれたことを確認
    expect(handleSwitchToTextInput).toHaveBeenCalledTimes(1);
  });

  test("アクセシビリティのためのaria属性が設定されている", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={true}
        isProcessing={false}
        errorState={null}
      />,
    );

    // リスニング状態のaria-live要素
    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveAttribute("aria-live", "polite");

    // スクリーンリーダー向けのテキスト
    expect(
      screen.getByText("音声認識中です。話しかけてください。"),
    ).toBeInTheDocument();
  });

  test("エラー時のアラートがaria-liveを持っている", () => {
    render(
      <SpeechRecognitionFeedback
        isListening={false}
        isProcessing={false}
        errorState="network"
      />,
    );

    // エラーアラートのaria-live要素
    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveAttribute("aria-live", "assertive");
  });
});
