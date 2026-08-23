/**
 * 会话 ID 生成的测试
 *
 * 测试在商谈开始时由前端生成 UUID 的功能。
 */

describe("会话 ID 生成", () => {
  test("crypto.randomUUID() 生成有效的 UUID", () => {
    // UUID 的正则表达式模式
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // 生成 UUID
    const sessionId = crypto.randomUUID();

    // 确认 UUID 格式正确
    expect(sessionId).toMatch(uuidPattern);
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBe(36);
  });

  test("确认多次生成的 UUID 各不相同", () => {
    const sessionId1 = crypto.randomUUID();
    const sessionId2 = crypto.randomUUID();
    const sessionId3 = crypto.randomUUID();

    // 确认各 UUID 均不相同
    expect(sessionId1).not.toBe(sessionId2);
    expect(sessionId2).not.toBe(sessionId3);
    expect(sessionId1).not.toBe(sessionId3);
  });

  test("确认生成的 UUID 为版本 4", () => {
    const sessionId = crypto.randomUUID();

    // 版本 4 的 UUID 第 13 个字符为 '4'
    expect(sessionId.charAt(14)).toBe("4");

    // 变体部分（第 17 个字符）为 8、9、a、b 之一
    const variantChar = sessionId.charAt(19).toLowerCase();
    expect(["8", "9", "a", "b"]).toContain(variantChar);
  });
});
