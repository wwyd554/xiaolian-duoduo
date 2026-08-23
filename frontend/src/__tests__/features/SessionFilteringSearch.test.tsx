import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import SessionHistoryPage from "../../pages/history/SessionHistoryPage";
import { ApiService } from "../../services/ApiService";

// ApiService 的 mock
jest.mock("../../services/ApiService", () => ({
  ApiService: {
    getInstance: jest.fn(),
  },
}));

// AuthService 的 mock
jest.mock("../../services/AuthService", () => ({
  AuthService: {
    getInstance: jest.fn(() => ({
      getCurrentUser: jest.fn().mockResolvedValue({
        name: "Test User",
        email: "test@example.com",
        preferredUsername: "testuser",
      }),
    })),
  },
}));

// i18n 的 mock
jest.mock("react-i18next", () => ({
  useTranslation: () => {
    return {
      t: (key: string) => {
        const translations: { [key: string]: string } = {
          "history.title": "会话记录",
          "history.search": "搜索",
          "history.searchPlaceholder": "按标题或NPC名称搜索",
          "history.scenarioFilter": "场景",
          "history.allScenarios": "全部场景",
          "history.completed": "已完成",
          "history.active": "进行中",
        };
        return translations[key] || key;
      },
    };
  },
}));

// useNavigate 的 mock
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

// 测试数据
const mockSessions = [
  {
    sessionId: "session-1",
    userId: "user-1",
    title: "定投NISA提案",
    status: "completed" as const,
    createdAt: "2025-06-28T10:00:00Z",
    updatedAt: "2025-06-28T10:30:00Z",
    scenarioId: "scenario-1",
    npcInfo: {
      name: "佐藤课长",
      role: "资产运用顾问",
      company: "ABC证券",
    },
  },
  {
    sessionId: "session-2",
    userId: "user-1",
    title: "终身保险提案",
    status: "completed" as const,
    createdAt: "2025-06-27T09:00:00Z",
    updatedAt: "2025-06-27T09:45:00Z",
    scenarioId: "scenario-2",
    npcInfo: {
      name: "铃木部长",
      role: "保险营业经理",
      company: "DEF保险",
    },
  },
  {
    sessionId: "session-3",
    userId: "user-1",
    title: "房贷咨询",
    status: "active" as const,
    createdAt: "2025-06-29T11:00:00Z",
    updatedAt: "2025-06-29T11:20:00Z",
    scenarioId: "scenario-3",
    npcInfo: {
      name: "田中支行长",
      role: "房贷负责人",
      company: "GHI银行",
    },
  },
];

const mockScenarios = [
  {
    scenarioId: "scenario-1",
    title: "定投NISA提案场景",
    description: "面向初学者的资产运用提案",
    difficulty: "beginner",
    category: "finance",
  },
  {
    scenarioId: "scenario-2",
    title: "保险商品提案场景",
    description: "面向家庭的保险提案",
    difficulty: "intermediate",
    category: "insurance",
  },
  {
    scenarioId: "scenario-3",
    title: "房贷咨询场景",
    description: "面向购房者",
    difficulty: "advanced",
    category: "loan",
  },
];

describe("会话搜索与过滤功能", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 默认的 mock 响应
    const mockApiService = {
      getSessions: jest.fn().mockResolvedValue({
        sessions: mockSessions,
      }),
      getScenarios: jest.fn().mockResolvedValue({
        scenarios: mockScenarios,
      }),
    };

    (ApiService.getInstance as jest.Mock).mockReturnValue(mockApiService);
  });

  test("文本搜索按标题正确运作", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument();
      expect(screen.getByText("房贷咨询")).toBeInTheDocument();
    });

    // 获取搜索框
    const searchInput = screen.getByPlaceholderText("按标题或NPC名称搜索");

    // 用「NISA」搜索
    await userEvent.type(searchInput, "NISA");

    // 确认搜索结果
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.queryByText("终身保险提案")).not.toBeInTheDocument();
      expect(screen.queryByText("房贷咨询")).not.toBeInTheDocument();
    });
  });

  test("文本搜索按NPC名称正确运作", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument();
      expect(screen.getByText("房贷咨询")).toBeInTheDocument();
    });

    // 获取搜索框
    const searchInput = screen.getByPlaceholderText("按标题或NPC名称搜索");

    // 用「铃木」搜索
    await userEvent.type(searchInput, "铃木");

    // 确认搜索结果
    await waitFor(() => {
      expect(screen.queryByText("佐藤课长")).not.toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument(); // 确认铃木部长的会话显示
      expect(screen.queryByText("田中支行长")).not.toBeInTheDocument();
    });
  });

  test("空搜索字符串时显示全部结果", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
    });

    // 获取搜索框
    const searchInput = screen.getByPlaceholderText("按标题或NPC名称搜索");

    // 先用「保险」搜索以缩小结果范围
    await userEvent.type(searchInput, "保险");

    // 确认搜索结果
    await waitFor(() => {
      expect(screen.queryByText("定投NISA提案")).not.toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument();
      expect(screen.queryByText("房贷咨询")).not.toBeInTheDocument();
    });

    // 清除搜索
    await userEvent.clear(searchInput);

    // 确认全部结果重新显示
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument();
      expect(screen.getByText("房贷咨询")).toBeInTheDocument();
    });
  });

  test("场景过滤器正确运作", async () => {
    // mock API 行为
    const mockApiService = ApiService.getInstance() as jest.Mocked<ApiService>;

    // 场景过滤生效时的 mock
    mockApiService.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-1") {
          return Promise.resolve({
            sessions: [mockSessions[0]], // 仅定投NISA提案
          });
        } else if (scenarioId === "scenario-2") {
          return Promise.resolve({
            sessions: [mockSessions[1]], // 仅终身保险提案
          });
        } else {
          return Promise.resolve({
            sessions: mockSessions, // 全部会话
          });
        }
      },
    );

    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
    });

    // 打开场景过滤器
    const scenarioFilter = screen.getByRole("combobox", { name: /场景/ });
    fireEvent.mouseDown(scenarioFilter);

    // 等待下拉菜单显示
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    // 选择定投NISA场景
    const nisaOption = screen.getByText("定投NISA提案场景");
    fireEvent.click(nisaOption);

    // 确认 API 被正确调用
    await waitFor(() => {
      expect(mockApiService.getSessions).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        "scenario-1",
      );
    });

    // 确认过滤结果
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.queryByText("终身保险提案")).not.toBeInTheDocument();
      expect(screen.queryByText("房贷咨询")).not.toBeInTheDocument();
    });
  });

  test("选择「全部场景」时显示全部结果", async () => {
    // mock API 行为
    const mockApiService = ApiService.getInstance() as jest.Mocked<ApiService>;

    // 场景过滤生效时的 mock
    mockApiService.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-2") {
          return Promise.resolve({
            sessions: [mockSessions[1]], // 仅终身保险提案
          });
        } else {
          return Promise.resolve({
            sessions: mockSessions, // 全部会话
          });
        }
      },
    );

    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
    });

    // 打开场景过滤器
    const scenarioFilter = screen.getByRole("combobox", { name: /场景/ });
    fireEvent.mouseDown(scenarioFilter);
    await waitFor(() =>
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0),
    );

    // 选择保险场景进行过滤
    const insuranceOption = screen.getByText("保险商品提案场景");
    fireEvent.click(insuranceOption);

    // 确认过滤已生效
    await waitFor(() => {
      expect(screen.queryByText("定投NISA提案")).not.toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument();
      expect(screen.queryByText("房贷咨询")).not.toBeInTheDocument();
    });

    // 再次打开过滤器
    fireEvent.mouseDown(scenarioFilter);
    await waitFor(() =>
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0),
    );

    // 选择全部场景
    const allOption = screen.getByText("全部场景");
    fireEvent.click(allOption);

    // 确认 API 被正确调用
    await waitFor(() => {
      // 以空字符串或未定义的场景 ID 调用
      expect(mockApiService.getSessions).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        "",
      );
    });

    // 确认全部结果显示
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.getByText("终身保险提案")).toBeInTheDocument();
      expect(screen.getByText("房贷咨询")).toBeInTheDocument();
    });
  });

  test("可以组合使用搜索和过滤", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
    });

    // 更新 API 行为 mock（场景过滤生效后）
    const mockApiService = ApiService.getInstance() as jest.Mocked<ApiService>;
    mockApiService.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-1") {
          return Promise.resolve({
            sessions: [mockSessions[0]], // 仅定投NISA提案
          });
        } else {
          return Promise.resolve({
            sessions: mockSessions,
          });
        }
      },
    );

    // 应用场景过滤（NISA 场景）
    const scenarioFilter = screen.getByRole("combobox", { name: /场景/ });
    fireEvent.mouseDown(scenarioFilter);
    await waitFor(() =>
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0),
    );

    const nisaOption = screen.getByText("定投NISA提案场景");
    fireEvent.click(nisaOption);

    // 确认过滤结果
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument();
      expect(screen.queryByText("终身保险提案")).not.toBeInTheDocument();
    });

    // 追加搜索（用「课长」搜索）- 在已过滤的结果上进一步缩小
    const searchInput = screen.getByPlaceholderText("按标题或NPC名称搜索");
    await userEvent.type(searchInput, "课长");

    // 确认搜索结果
    await waitFor(() => {
      expect(screen.getByText("定投NISA提案")).toBeInTheDocument(); // 因包含佐藤课长而匹配
      // 其他结果已被过滤排除
    });

    // 用「部长」搜索（不匹配）
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "部长");

    // 确认结果变为 0 条
    await waitFor(() => {
      expect(screen.queryByText("定投NISA提案")).not.toBeInTheDocument();
      expect(screen.queryByText("终身保险提案")).not.toBeInTheDocument();
      expect(screen.queryByText("房贷咨询")).not.toBeInTheDocument();
    });
  });
});
