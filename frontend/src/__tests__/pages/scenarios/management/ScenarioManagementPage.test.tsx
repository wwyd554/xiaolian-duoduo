import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
// 测试用 i18n 配置
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  lng: "ja",
  fallbackLng: "ja",
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  resources: {
    ja: {
      translation: {
        "scenarios.management.title": "场景管理",
        "scenarios.management.subtitle":
          "可以对场景进行编辑、删除、导入、导出",
        "scenarios.management.importButton": "导入场景",
        "scenarios.management.scenarioTitle": "标题",
        "scenarios.management.difficulty": "难度",
        "scenarios.management.category": "类别",
        "scenarios.management.language": "语言",
        "scenarios.management.actions": "操作",
        "scenarios.beginner": "初级",
        "scenarios.intermediate": "中级",
        "scenarios.advanced": "高级",
        "common.processing": "处理中...",
      },
    },
  },
});
import ScenarioManagementPage from "../../../../pages/scenarios/management/ScenarioManagementPage";

// AWS Amplify 的 mock
jest.mock("aws-amplify/auth", () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    userId: "test-user-id",
    username: "testuser",
  }),
}));

// ApiService 的 mock
jest.mock("../../../../services/ApiService", () => {
  return {
    ApiService: {
      getInstance: jest.fn().mockReturnValue({
        getScenarios: jest.fn().mockResolvedValue({
          scenarios: [
            {
              scenarioId: "test-scenario-1",
              title: "测试场景1",
              difficulty: "beginner",
              category: "Technology",
              language: "ja",
              createdBy: "test-user-id",
            },
          ],
        }),
        exportScenario: jest.fn().mockResolvedValue({
          scenarios: [
            { scenarioId: "test-scenario-1", title: "测试场景1" },
          ],
          npcs: [{ id: "npc-1", name: "NPC 1" }],
        }),
      }),
    },
  };
});

// AuthService 的 mock
jest.mock("../../../../services/AuthService", () => ({
  AuthService: {
    getInstance: jest.fn().mockReturnValue({
      isAdmin: jest.fn().mockResolvedValue(false),
    }),
  },
}));

describe("ScenarioManagementPage Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders component with basic elements", () => {
    render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <ScenarioManagementPage />
        </I18nextProvider>
      </BrowserRouter>,
    );

    // 确认基本元素显示
    expect(screen.getByText(/场景管理/i)).toBeInTheDocument();
  });
});
