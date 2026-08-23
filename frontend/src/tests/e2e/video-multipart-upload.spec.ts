/**
 * E2E 测试: 会话录制的分片上传
 *
 * 针对 GitHub Issue #68「会话录制的 S3 上传因 EntityTooLarge 失败」
 * 作为根本对策引入的分片上传 E2E 测试。
 * 涉及 dev 环境（CloudFront / API Gateway）连接的集成测试。
 *
 * 验证要点:
 * 1. /videos/multipart/create 在带认证的情况下返回 uploadId 和 partUrls
 * 2. 能向返回的签名 URL PUT 真实数据，并能获取 ETag
 *    （同时验证 S3 存储桶 CORS 的 exposedHeaders 中公开了 ETag）
 * 3. /videos/multipart/complete 能成功合并分片
 * 4. 非法请求（缺少 partCount）被 400 拒绝
 * 5. 旧 /videos/upload-url 已删除，统一为分片上传
 * 6. 中断（abort）后再调用 complete 也不能成功合并（异常场景）
 *
 * 【重要】执行前提:
 * - 本测试针对 E2E_API_GATEWAY_ENDPOINT 指向的已部署环境（dev 等）执行。
 *   验证要点 5（确认旧端点已删除）需先通过
 *   `npm run deploy:dev` 部署包含本变更的堆栈后才能正确评估。
 *   部署前执行时旧端点仍存活，会导致错误判定。
 * - 未接入 CI，因此按手动执行设计。执行命令:
 *   `cd frontend && npx playwright test video-multipart-upload.spec.ts --project=chromium`
 *
 * 设计上的注意:
 * - 浏览器无法访问真实摄像头，因此 E2E 中不验证录制视频的实际生成。
 *   取而代之，使用在已登录浏览器上下文中获取的真实 Cognito ID 令牌，
 *   在 API 层面对已部署的分片 API 进行端到端验证。
 * - 认证令牌从应用上下文中获取 Amplify 保存在 localStorage 中的内容。
 *   为避免对键结构产生直接依赖，通过模式搜索获取 Cognito 的 idToken 键。
 */
import { test, expect, Page } from "@playwright/test";
import { login } from "./helpers";

// API 端点（从测试环境变量获取与应用构建时环境变量相同的值）
const API_ENDPOINT = (process.env.E2E_API_GATEWAY_ENDPOINT || "").replace(
  /\/$/,
  "",
);

// S3 分片上传的最小分片大小为 5MB。
// 为验证多个分片的合并，第 1 片准备 5MB 以上的数据。
const PART_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * 从已登录浏览器上下文获取 Cognito ID 令牌
 *
 * Amplify v6 将 Cognito 的令牌保存到 localStorage，
 * 以 `CognitoIdentityServiceProvider.<clientId>.<username>.idToken` 形式保存。
 * 为不依赖键结构的细节，通过模式搜索获取以 `.idToken` 结尾的键。
 *
 * @param page Playwright 的页面对象
 * @returns Cognito ID 令牌字符串
 */
async function getIdToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        key.startsWith("CognitoIdentityServiceProvider") &&
        key.endsWith(".idToken")
      ) {
        return window.localStorage.getItem(key);
      }
    }
    return null;
  });

  if (!token) {
    throw new Error(
      "未能获取 Cognito ID 令牌。请确认登录是否已完成。",
    );
  }
  return token;
}

test.beforeEach(async ({ page }) => {
  // 未设置 API 端点时使测试失败，并明确原因
  expect(
    API_ENDPOINT,
    "必须在 .env.test 中设置 E2E_API_GATEWAY_ENDPOINT",
  ).not.toBe("");

  await login(page);
});

test.describe("会话录制的分片上传", () => {
  test("分片上传的完整流程（create→PUT→complete）成功", async ({
    page,
  }) => {
    const idToken = await getIdToken(page);
    const sessionId = `e2e-multipart-${Date.now()}`;

    // --- 步骤 1: 开始分片上传（请求 2 个分片的 URL） ---
    const createResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/create`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: {
          sessionId,
          contentType: "video/mp4",
          partCount: 2,
          fileName: "e2e-recording.mp4",
        },
      },
    );

    expect(
      createResponse.ok(),
      `create 失败: status=${createResponse.status()}`,
    ).toBeTruthy();

    const createBody = await createResponse.json();
    expect(createBody.uploadId, "应返回 uploadId").toBeTruthy();
    expect(createBody.videoKey, "应返回 videoKey").toBeTruthy();
    expect(
      Array.isArray(createBody.partUrls),
      "partUrls 应为数组",
    ).toBeTruthy();
    expect(createBody.partUrls).toHaveLength(2);
    expect(createBody.partUrls[0].partNumber).toBe(1);
    expect(createBody.partUrls[0].url).toContain("http");

    const { uploadId, videoKey, partUrls } = createBody;

    // --- 步骤 2: 将各分片 PUT 到签名 URL 并获取 ETag ---
    // 按 S3 规范，除最后一个分片外均需 5MB 以上。
    // 第 1 片: 恰好 5MB，第 2 片: 1KB（最后一片可以较小）。
    // ASCII 字符串在 UTF-8 中 1 个字符 = 1 字节，因此字符数可视为字节数。
    const part1Data = "a".repeat(PART_SIZE_BYTES);
    const part2Data = "a".repeat(1024);
    const partPayloads = [part1Data, part2Data];

    const uploadedParts: Array<{ partNumber: number; eTag: string }> = [];

    for (const { partNumber, url } of partUrls) {
      const putResponse = await page.request.put(url, {
        headers: { "Content-Type": "application/octet-stream" },
        data: partPayloads[partNumber - 1],
      });

      expect(
        putResponse.ok(),
        `分片 ${partNumber} 的 PUT 失败: status=${putResponse.status()}`,
      ).toBeTruthy();

      // S3 在分片上传的响应中返回 ETag 头。
      // 存储桶 CORS 的 exposedHeaders 未公开 ETag 时无法获取。
      const eTag = putResponse.headers()["etag"];
      expect(eTag, `应能获取分片 ${partNumber} 的 ETag`).toBeTruthy();

      uploadedParts.push({ partNumber, eTag });
    }

    // --- 步骤 3: 分片上传完成（合并分片） ---
    const completeResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/complete`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: {
          videoKey,
          uploadId,
          parts: uploadedParts,
        },
      },
    );

    expect(
      completeResponse.ok(),
      `complete 失败: status=${completeResponse.status()}`,
    ).toBeTruthy();

    const completeBody = await completeResponse.json();
    expect(completeBody.videoKey, "完成响应中应包含 videoKey").toBe(
      videoKey,
    );
  });

  test("缺少 partCount 的非法 create 请求被 400 拒绝", async ({
    page,
  }) => {
    const idToken = await getIdToken(page);

    const response = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/create`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: {
          sessionId: `e2e-invalid-${Date.now()}`,
          contentType: "video/mp4",
          // 故意省略 partCount
        },
      },
    );

    expect(
      response.status(),
      "缺少 partCount 的请求应返回 400",
    ).toBe(400);
  });

  test("中断（abort）请求成功", async ({ page }) => {
    const idToken = await getIdToken(page);
    const sessionId = `e2e-abort-${Date.now()}`;

    // 开始分片上传
    const createResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/create`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: {
          sessionId,
          contentType: "video/mp4",
          partCount: 1,
          fileName: "e2e-abort.mp4",
        },
      },
    );
    expect(createResponse.ok()).toBeTruthy();
    const { uploadId, videoKey } = await createResponse.json();

    // 不上传分片直接中断
    const abortResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/abort`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: { videoKey, uploadId },
      },
    );

    expect(
      abortResponse.ok(),
      `abort 失败: status=${abortResponse.status()}`,
    ).toBeTruthy();
    const abortBody = await abortResponse.json();
    expect(abortBody.aborted, "应返回中断成功标志").toBe(true);
  });

  test("中断（abort）后再调用 complete 也不能成功合并", async ({
    page,
  }) => {
    const idToken = await getIdToken(page);
    const sessionId = `e2e-abort-then-complete-${Date.now()}`;

    // 开始分片上传
    const createResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/create`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: {
          sessionId,
          contentType: "video/mp4",
          partCount: 1,
          fileName: "e2e-abort-then-complete.mp4",
        },
      },
    );
    expect(createResponse.ok()).toBeTruthy();
    const { uploadId, videoKey, partUrls } = await createResponse.json();

    // 上传第 1 片并获取 ETag（恰好 5MB）
    const putResponse = await page.request.put(partUrls[0].url, {
      headers: { "Content-Type": "application/octet-stream" },
      data: "a".repeat(PART_SIZE_BYTES),
    });
    expect(putResponse.ok(), "分片的 PUT 应成功").toBeTruthy();
    const eTag = putResponse.headers()["etag"];
    expect(eTag, "应能获取 ETag").toBeTruthy();

    // 中断并丢弃已上传的分片
    const abortResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/abort`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: { videoKey, uploadId },
      },
    );
    expect(abortResponse.ok(), "abort 应成功").toBeTruthy();

    // 对已中断的 uploadId 调用 complete。
    // S3 不识别已中断的分片上传，因此无法成功合并
    // （产生与 NoSuchUpload 相当的错误，complete 端点不返回 2xx）。
    const completeResponse = await page.request.post(
      `${API_ENDPOINT}/videos/multipart/complete`,
      {
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        data: {
          videoKey,
          uploadId,
          parts: [{ partNumber: 1, eTag }],
        },
      },
    );

    expect(
      completeResponse.ok(),
      "已中断上传的 complete 不应成功",
    ).toBeFalsy();
  });

  test("旧 /videos/upload-url 端点已删除且不响应", async ({
    page,
  }) => {
    const idToken = await getIdToken(page);

    // 旧端点已因分片统一而删除。
    // API Gateway 不存在该路由，因此不会返回成功响应（2xx）。
    // 未定义路由的具体状态码（403/404/500 等）取决于 API Gateway 的
    // 认证和 GatewayResponse 配置，因此不校验状态码的精确值，
    // 而是验证「不成功（不签发录制用 URL）」。
    const response = await page.request.get(
      `${API_ENDPOINT}/videos/upload-url?sessionId=e2e-legacy&contentType=video/mp4`,
      {
        headers: { Authorization: idToken },
      },
    );

    expect(
      response.ok(),
      "已删除的旧端点不应返回成功响应",
    ).toBeFalsy();

    // 即使不是 2xx，也双重确认不包含签名 URL（uploadUrl）
    const bodyText = await response.text();
    expect(
      bodyText.includes("uploadUrl"),
      "旧端点不应签发签名 URL",
    ).toBeFalsy();
  });
});
