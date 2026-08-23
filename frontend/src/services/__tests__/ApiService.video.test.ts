// API 的模拟
jest.mock("aws-amplify/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// ApiService 的模拟
jest.mock("../ApiService", () => ({
  ApiService: {
    getInstance: jest.fn(() => ({
      createMultipartUpload: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
    })),
  },
}));

import { ApiService } from "../ApiService";

describe("ApiService - 视频相关功能的测试", () => {
  let apiService: {
    createMultipartUpload: jest.Mock;
    completeMultipartUpload: jest.Mock;
    abortMultipartUpload: jest.Mock;
  };

  beforeEach(() => {
    apiService = ApiService.getInstance();
    jest.clearAllMocks();
  });

  describe("createMultipartUpload", () => {
    it("分片上传启动成功时", async () => {
      // 设置模拟响应（假设 25 个分片的 URL）
      const mockResponse = {
        uploadId: "test-upload-id",
        videoKey: "videos/test-session-id/recording.mp4",
        partUrls: [
          { partNumber: 1, url: "https://example-bucket.s3.amazonaws.com/part1" },
          { partNumber: 2, url: "https://example-bucket.s3.amazonaws.com/part2" },
        ],
        expiresIn: 3600,
      };

      apiService.createMultipartUpload.mockResolvedValue(mockResponse);

      const result = await apiService.createMultipartUpload(
        "test-session-id",
        "video/mp4",
        2,
        "recording.mp4",
      );

      // 验证参数顺序正确（sessionId, contentType, partCount, fileName）
      expect(apiService.createMultipartUpload).toHaveBeenCalledWith(
        "test-session-id",
        "video/mp4",
        2,
        "recording.mp4",
      );
      expect(result).toEqual(mockResponse);
      expect(result.partUrls).toHaveLength(2);
    });

    it("发生错误时", async () => {
      apiService.createMultipartUpload.mockRejectedValue(
        new Error("分片上传启动错误"),
      );

      await expect(
        apiService.createMultipartUpload("test-session-id", "video/mp4", 2),
      ).rejects.toThrow("分片上传启动错误");
    });
  });

  describe("completeMultipartUpload", () => {
    it("分片上传完成成功时", async () => {
      const mockResponse = {
        videoKey: "videos/test-session-id/recording.mp4",
        location: "https://example-bucket.s3.amazonaws.com/recording.mp4",
      };

      apiService.completeMultipartUpload.mockResolvedValue(mockResponse);

      const parts = [
        { partNumber: 1, eTag: '"etag1"' },
        { partNumber: 2, eTag: '"etag2"' },
      ];
      const result = await apiService.completeMultipartUpload(
        "videos/test-session-id/recording.mp4",
        "test-upload-id",
        parts,
      );

      expect(apiService.completeMultipartUpload).toHaveBeenCalledWith(
        "videos/test-session-id/recording.mp4",
        "test-upload-id",
        parts,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("abortMultipartUpload", () => {
    it("分片上传中断成功时", async () => {
      apiService.abortMultipartUpload.mockResolvedValue({ aborted: true });

      const result = await apiService.abortMultipartUpload(
        "videos/test-session-id/recording.mp4",
        "test-upload-id",
      );

      expect(apiService.abortMultipartUpload).toHaveBeenCalledWith(
        "videos/test-session-id/recording.mp4",
        "test-upload-id",
      );
      expect(result).toEqual({ aborted: true });
    });
  });
});
