import React from "react";
import { render, screen, act } from "@testing-library/react";
import AnimatedMessage from "../../components/AnimatedMessage";

describe("AnimatedMessage", () => {
  // 日付をモック
  const mockDate = new Date("2023-06-15T12:30:45");

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("ユーザーメッセージが正しくレンダリングされる", async () => {
    render(
      <AnimatedMessage
        content="こんにちは、テストメッセージです"
        sender="user"
        timestamp={mockDate}
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // アニメーションの完了を待つ
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // メッセージ内容が表示されている
    expect(
      screen.getByText("こんにちは、テストメッセージです"),
    ).toBeInTheDocument();

    // タイムスタンプが表示されている
    expect(screen.getByText(mockDate.toLocaleTimeString())).toBeInTheDocument();

    // ユーザーアバターが表示されている（"U"のデフォルト文字）
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  test("NPCメッセージが正しくレンダリングされる", async () => {
    render(
      <AnimatedMessage
        content="こんにちは、NPCからの返信です"
        sender="npc"
        timestamp={mockDate}
        name="テストNPC"
        avatar="T"
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // アニメーションの完了を待つ
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // メッセージ内容が表示されている
    expect(
      screen.getByText("こんにちは、NPCからの返信です"),
    ).toBeInTheDocument();

    // NPCの名前が表示されている
    expect(screen.getByText("テストNPC")).toBeInTheDocument();

    // NPCのアバターが表示されている（指定された"T"文字）
    expect(screen.getByText("T")).toBeInTheDocument();

    // タイムスタンプが表示されている
    expect(screen.getByText(mockDate.toLocaleTimeString())).toBeInTheDocument();
  });

  test("タイピングエフェクトが動作する", async () => {
    const testMessage = "テスト";

    render(
      <AnimatedMessage
        content={testMessage}
        sender="npc"
        timestamp={mockDate}
        animationDelay={0}
        typingEffect={true}
      />,
    );

    // 最初は表示されない
    act(() => {
      jest.advanceTimersByTime(10);
    });

    // 部分的に表示される（1文字目）
    act(() => {
      jest.advanceTimersByTime(30);
    });

    // タイピングが完了するまで待機
    act(() => {
      jest.advanceTimersByTime(testMessage.length * 30 + 100);
    });

    // 最終的に全体が表示される
    expect(screen.getByText(testMessage)).toBeInTheDocument();
  });

  test("アニメーション遅延が適用される", async () => {
    const animationDelay = 1000;
    const { container } = render(
      <AnimatedMessage
        content="遅延メッセージ"
        sender="user"
        timestamp={mockDate}
        animationDelay={animationDelay}
        typingEffect={false}
      />,
    );

    // 遅延前はopacity: 0
    const messageElement = container.firstChild as HTMLElement;
    expect(messageElement).toHaveStyle("opacity: 0");

    // 遅延後はopacity: 1
    act(() => {
      jest.advanceTimersByTime(animationDelay + 100);
    });

    expect(messageElement).toHaveStyle("opacity: 1");
  });

  test("文字列形式のタイムスタンプが正しく処理される", async () => {
    const timestampString = "2023-06-15T12:30:45";
    const expectedTime = new Date(timestampString).toLocaleTimeString();

    render(
      <AnimatedMessage
        content="メッセージ内容"
        sender="npc"
        timestamp={timestampString}
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // アニメーションの完了を待つ
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 正しいフォーマットのタイムスタンプが表示されている
    expect(screen.getByText(expectedTime)).toBeInTheDocument();
  });

  test("アバターが指定されていない場合のデフォルトが表示される", async () => {
    render(
      <AnimatedMessage
        content="アバターなしメッセージ"
        sender="npc"
        timestamp={mockDate}
        name="テスト"
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // アニメーションの完了を待つ
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 名前の頭文字がアバターとして使用される
    expect(screen.getByText("テ")).toBeInTheDocument();

    // 名前もアバターも指定されていない場合のテスト
    render(
      <AnimatedMessage
        content="アバターなしメッセージ"
        sender="npc"
        timestamp={mockDate}
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // アニメーションの完了を待つ
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // デフォルト文字「N」が表示される
    expect(screen.getByText("N")).toBeInTheDocument();
  });
});
