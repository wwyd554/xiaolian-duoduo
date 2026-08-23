/**
 * 场景管理页面的权限检查逻辑测试
 *
 * 验证系统场景仅管理员可编辑、不可删除，
 * 自定义场景仅创建者可编辑、删除
 */
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// 测试用 i18n 配置
i18n.use(initReactI18next).init({
  lng: "ja",
  fallbackLng: "ja",
  debug: false,
  interpolation: { escapeValue: false },
  resources: {
    ja: {
      translation: {
        "scenarios.management.title": "场景管理",
        "scenarios.management.subtitle": "场景的管理",
        "scenarios.management.importButton": "导入",
        "scenarios.management.scenarioTitle": "标题",
        "scenarios.management.difficulty": "难度",
        "scenarios.management.category": "类别",
        "scenarios.management.language": "语言",
        "scenarios.management.actions": "操作",
        "scenarios.management.edit": "编辑",
        "scenarios.management.delete": "删除",
        "scenarios.management.export": "导出",
        "scenarios.beginner": "初级",
        "scenarios.intermediate": "中级",
        "scenarios.advanced": "高级",
        "common.processing": "处理中...",
        "scenarios.noScenarios": "没有场景",
      },
    },
  },
});

// 供 mock 使用的变量（可按测试用例修改）
let mockIsAdmin = false;

// AWS Amplify 的 mock
jest.mock("aws-amplify/auth", () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    userId: "test-user-id",
    username: "testuser",
  }),
}));

// AuthService 的 mock
jest.mock("../../../../services/AuthService", () => ({
  AuthService: {
    getInstance: jest.fn().mockReturnValue({
      isAdmin: jest.fn().mockImplementation(() => Promise.resolve(mockIsAdmin)),
    }),
  },
}));

// ApiService 的 mock（按测试用例修改场景数据）
let mockScenarios: Array<Record<string, unknown>> = [];

jest.mock("../../../../services/ApiService", () => ({
  ApiService: {
    getInstance: jest.fn().mockReturnValue({
      getScenarios: jest.fn().mockImplementation(() =>
        Promise.resolve({ scenarios: mockScenarios })
      ),
      exportScenario: jest.fn().mockResolvedValue({ scenarios: [], npcs: [] }),
    }),
  },
}));

import ScenarioManagementPage from "../../../../pages/scenarios/management/ScenarioManagementPage";

// 测试辅助函数：渲染组件
const renderPage = () => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <ScenarioManagementPage />
      </I18nextProvider>
    </BrowserRouter>,
  );
};

describe("场景权限检查", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = false;
    mockScenarios = [];
  });

  describe("系统场景（createdBy: system）", () => {
    beforeEach(() => {
      mockScenarios = [
        {
          scenarioId: "system-scenario-1",
          title: "系统场景",
          difficulty: "normal",
          category: "IT",
          language: "ja",
          createdBy: "system",
        },
      ];
    });

    it("普通用户不显示编辑按钮", async () => {
      mockIsAdmin = false;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("系统场景")).toBeInTheDocument();
      });

      // 确认编辑按钮不存在
      const editButtons = screen.queryAllByLabelText(/编辑/);
      expect(editButtons).toHaveLength(0);
    });

    it("管理员显示编辑按钮", async () => {
      mockIsAdmin = true;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("系统场景")).toBeInTheDocument();
      });

      // 确认编辑按钮存在
      const editButton = screen.getByLabelText("编辑 系统场景");
      expect(editButton).toBeInTheDocument();
    });

    it("即使是管理员也不显示删除按钮", async () => {
      mockIsAdmin = true;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("系统场景")).toBeInTheDocument();
      });

      // 确认删除按钮不存在
      const deleteButtons = screen.queryAllByLabelText(/删除/);
      expect(deleteButtons).toHaveLength(0);
    });
  });

  describe("自定义场景（自己创建）", () => {
    beforeEach(() => {
      mockScenarios = [
        {
          scenarioId: "my-scenario-1",
          title: "自己的场景",
          difficulty: "beginner",
          category: "通用",
          language: "ja",
          createdBy: "test-user-id", // 当前用户 ID
        },
      ];
    });

    it("创建者显示编辑按钮和删除按钮", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("自己的场景")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("编辑 自己的场景")).toBeInTheDocument();
      expect(screen.getByLabelText("删除 自己的场景")).toBeInTheDocument();
    });
  });

  describe("自定义场景（他人创建）", () => {
    beforeEach(() => {
      mockScenarios = [
        {
          scenarioId: "other-scenario-1",
          title: "他人的场景",
          difficulty: "advanced",
          category: "金融",
          language: "ja",
          createdBy: "other-user-id", // 其他用户 ID
        },
      ];
    });

    it("他人的场景不显示编辑、删除按钮", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("他人的场景")).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByLabelText(/编辑/);
      const deleteButtons = screen.queryAllByLabelText(/删除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });

    it("即使是管理员也不能编辑、删除他人的自定义场景", async () => {
      mockIsAdmin = true;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("他人的场景")).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByLabelText(/编辑/);
      const deleteButtons = screen.queryAllByLabelText(/删除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });
  });

  describe("混合场景列表", () => {
    it("管理员可以编辑系统场景并编辑、删除自己的场景", async () => {
      mockIsAdmin = true;
      mockScenarios = [
        {
          scenarioId: "system-1",
          title: "系统A",
          difficulty: "normal",
          category: "IT",
          language: "ja",
          createdBy: "system",
        },
        {
          scenarioId: "my-1",
          title: "自己的B",
          difficulty: "beginner",
          category: "通用",
          language: "ja",
          createdBy: "test-user-id",
        },
        {
          scenarioId: "other-1",
          title: "他人的C",
          difficulty: "advanced",
          category: "金融",
          language: "ja",
          createdBy: "other-user-id",
        },
      ];

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("系统A")).toBeInTheDocument();
        expect(screen.getByText("自己的B")).toBeInTheDocument();
        expect(screen.getByText("他人的C")).toBeInTheDocument();
      });

      // 系统场景: 编辑○、删除×
      expect(screen.getByLabelText("编辑 系统A")).toBeInTheDocument();
      expect(screen.queryByLabelText("删除 系统A")).not.toBeInTheDocument();

      // 自己的场景: 编辑○、删除○
      expect(screen.getByLabelText("编辑 自己的B")).toBeInTheDocument();
      expect(screen.getByLabelText("删除 自己的B")).toBeInTheDocument();

      // 他人的场景: 编辑×、删除×
      expect(screen.queryByLabelText("编辑 他人的C")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("删除 他人的C")).not.toBeInTheDocument();
    });
  });

  describe("旧版场景（createdBy 未设置）", () => {
    it("createdBy 未设置的场景不显示编辑、删除按钮", async () => {
      mockScenarios = [
        {
          scenarioId: "legacy-scenario-1",
          title: "旧版场景",
          difficulty: "normal",
          category: "通用",
          language: "ja",
          // 无 createdBy（旧数据）
        },
      ];

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("旧版场景")).toBeInTheDocument();
      });

      // createdBy 未设置时，任何人都不能编辑、删除
      const editButtons = screen.queryAllByLabelText(/编辑/);
      const deleteButtons = screen.queryAllByLabelText(/删除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });

    it("即使是管理员也不能编辑、删除 createdBy 未设置的场景", async () => {
      mockIsAdmin = true;
      mockScenarios = [
        {
          scenarioId: "legacy-scenario-2",
          title: "旧版场景2",
          difficulty: "normal",
          category: "通用",
          language: "ja",
          // 无 createdBy
        },
      ];

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("旧版场景2")).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByLabelText(/编辑/);
      const deleteButtons = screen.queryAllByLabelText(/删除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });
  });
});
