import React from "react";
import { render, screen, act } from "@testing-library/react";
import AnimatedMessage from "../../components/AnimatedMessage";

describe("AnimatedMessage", () => {
  // mock 日期
  const mockDate = new Date("2023-06-15T12:30:45");

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("用户消息正确渲染", async () => {
    render(
      <AnimatedMessage
        content="你好，测试消息"
        sender="user"
        timestamp={mockDate}
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // 等待动画完成
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 消息内容显示
    expect(screen.getByText("你好，测试消息")).toBeInTheDocument();

    // 时间戳显示
    expect(screen.getByText(mockDate.toLocaleTimeString())).toBeInTheDocument();

    // 用户头像显示（默认字符 "U"）
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  test("NPC 消息正确渲染", async () => {
    render(
      <AnimatedMessage
        content="你好，来自NPC的回复"
        sender="npc"
        timestamp={mockDate}
        name="测试NPC"
        avatar="T"
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // 等待动画完成
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 消息内容显示
    expect(screen.getByText("你好，来自NPC的回复")).toBeInTheDocument();

    // NPC 名称显示
    expect(screen.getByText("测试NPC")).toBeInTheDocument();

    // NPC 头像显示（指定的 "T" 字符）
    expect(screen.getByText("T")).toBeInTheDocument();

    // 时间戳显示
    expect(screen.getByText(mockDate.toLocaleTimeString())).toBeInTheDocument();
  });

  test("打字效果正常工作", async () => {
    const testMessage = "测试";

    render(
      <AnimatedMessage
        content={testMessage}
        sender="npc"
        timestamp={mockDate}
        animationDelay={0}
        typingEffect={true}
      />,
    );

    // 最初不显示
    act(() => {
      jest.advanceTimersByTime(10);
    });

    // 部分显示（第 1 个字符）
    act(() => {
      jest.advanceTimersByTime(30);
    });

    // 等待打字完成
    act(() => {
      jest.advanceTimersByTime(testMessage.length * 30 + 100);
    });

    // 最终全部显示
    expect(screen.getByText(testMessage)).toBeInTheDocument();
  });

  test("动画延迟生效", async () => {
    const animationDelay = 1000;
    const { container } = render(
      <AnimatedMessage
        content="延迟消息"
        sender="user"
        timestamp={mockDate}
        animationDelay={animationDelay}
        typingEffect={false}
      />,
    );

    // 延迟前 opacity: 0
    const messageElement = container.firstChild as HTMLElement;
    expect(messageElement).toHaveStyle("opacity: 0");

    // 延迟后 opacity: 1
    act(() => {
      jest.advanceTimersByTime(animationDelay + 100);
    });

    expect(messageElement).toHaveStyle("opacity: 1");
  });

  test("字符串形式的时间戳正确处理", async () => {
    const timestampString = "2023-06-15T12:30:45";
    const expectedTime = new Date(timestampString).toLocaleTimeString();

    render(
      <AnimatedMessage
        content="消息内容"
        sender="npc"
        timestamp={timestampString}
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // 等待动画完成
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 正确格式的时间戳显示
    expect(screen.getByText(expectedTime)).toBeInTheDocument();
  });

  test("未指定头像时显示默认头像", async () => {
    render(
      <AnimatedMessage
        content="无头像消息"
        sender="npc"
        timestamp={mockDate}
        name="测试"
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // 等待动画完成
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 名称首字符用作头像
    expect(screen.getByText("测")).toBeInTheDocument();

    // 名称和头像都未指定时的测试
    render(
      <AnimatedMessage
        content="无头像消息"
        sender="npc"
        timestamp={mockDate}
        animationDelay={0}
        typingEffect={false}
      />,
    );

    // 等待动画完成
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 默认字符「N」显示
    expect(screen.getByText("N")).toBeInTheDocument();
  });
});
