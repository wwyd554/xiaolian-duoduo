/**
 * セッションID生成のテスト
 *
 * 商談開始時にフロントエンド側でUUIDを生成する機能をテストします。
 */

describe("セッションID生成", () => {
  test("crypto.randomUUID()が有効なUUIDを生成する", () => {
    // UUIDの正規表現パターン
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // UUIDを生成
    const sessionId = crypto.randomUUID();

    // UUIDの形式が正しいことを確認
    expect(sessionId).toMatch(uuidPattern);
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBe(36);
  });

  test("複数回生成したUUIDが異なることを確認", () => {
    const sessionId1 = crypto.randomUUID();
    const sessionId2 = crypto.randomUUID();
    const sessionId3 = crypto.randomUUID();

    // 各UUIDが異なることを確認
    expect(sessionId1).not.toBe(sessionId2);
    expect(sessionId2).not.toBe(sessionId3);
    expect(sessionId1).not.toBe(sessionId3);
  });

  test("生成されたUUIDがバージョン4であることを確認", () => {
    const sessionId = crypto.randomUUID();

    // バージョン4のUUIDは13番目の文字が'4'である
    expect(sessionId.charAt(14)).toBe("4");

    // バリアント部分（17番目の文字）が8, 9, a, bのいずれかである
    const variantChar = sessionId.charAt(19).toLowerCase();
    expect(["8", "9", "a", "b"]).toContain(variantChar);
  });
});
