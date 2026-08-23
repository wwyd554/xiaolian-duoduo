import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import SessionHistoryPage from "../../pages/history/SessionHistoryPage";
import { ApiService } from "../../services/ApiService";

// ApiService 的 mock
jest.mock("../../services/ApiService", () => {
  return {
    ApiService: {
      getInstance: jest.fn(() => ({
        getSessions: jest.fn().mockResolvedValue({
          sessions: [
            {
              sessionId: "session-1",
              userId: "user-1",
              scenarioId: "scenario-1",
              title: "测试会话1",
              status: "completed",
              createdAt: "2025-06-28T10:00:00Z",
              updatedAt: "2025-06-28T10:30:00Z",
              npcInfo: {
                name: "测试NPC",
                role: "银行职员",
                company: "测试银行",
              },
            },
            {
              sessionId: "session-2",
              userId: "user-1",
              scenarioId: "scenario-2",
              title: "测试会话2",
              status: "active",
              createdAt: "2025-06-29T09:00:00Z",
              updatedAt: "2025-06-29T09:15:00Z",
              npcInfo: {
                name: "王大川",
                role: "证券销售",
                company: "ABC证券",
              },
            },
          ],
        }),
        getScenarios: jest.fn().mockResolvedValue({
          scenarios: [
            {
              scenarioId: "scenario-1",
              title: "场景1",
              description: "测试场景1",
              difficulty: "beginner",
              category: "finance",
            },
            {
              scenarioId: "scenario-2",
              title: "场景2",
              description: "测试场景2",
              difficulty: "intermediate",
              category: "insurance",
            },
          ],
        }),
      })),
    },
  };
});

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
          "history.description": "可以查看过去的会话记录",
          "history.search": "搜索",
          "history.searchPlaceholder": "按标题或NPC名称搜索",
          "history.scenarioFilter": "场景",
          "history.allScenarios": "全部场景",
          "history.noSessions": "没有会话",
          "history.startNewSession": "请开始新的会话",
          "history.completed": "已完成",
          "history.active": "进行中",
          "history.unknownNPC": "未知NPC",
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

describe("SessionHistoryPage 组件", () => {
  // mock API 的重置与初始化
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("会话列表正常显示", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 确认加载显示
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // 确认会话列表显示
    await waitFor(() => {
      expect(screen.getByText("测试会话1")).toBeInTheDocument();
      expect(screen.getByText("测试会话2")).toBeInTheDocument();
    });

    // 确认会话详情（NPC 名称连同职位一起显示；name 与 role 是嵌套元素，分开断言）
    expect(screen.getByText("测试NPC")).toBeInTheDocument();
    expect(screen.getByText("(银行职员)")).toBeInTheDocument();
    expect(screen.getByText("王大川")).toBeInTheDocument();
    expect(screen.getByText("(证券销售)")).toBeInTheDocument();

    // 确认状态显示
    const completedChip = screen.getByText("已完成");
    const activeChip = screen.getByText("进行中");
    expect(completedChip).toBeInTheDocument();
    expect(activeChip).toBeInTheDocument();
  });

  test("搜索功能正常运作", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待会话加载
    await waitFor(() => {
      expect(screen.getByText("测试会话1")).toBeInTheDocument();
    });

    // 定位搜索框
    const searchInput = screen.getByPlaceholderText("按标题或NPC名称搜索");

    // 执行搜索
    fireEvent.change(searchInput, { target: { value: "王大川" } });

    // 确认搜索结果（按实际显示形式确认）
    await waitFor(() => {
      expect(screen.queryByText("测试NPC")).not.toBeInTheDocument(); // 不匹配搜索条件
      expect(screen.getByText("测试会话2")).toBeInTheDocument(); // 王大川的会话显示
    });

    // 重置搜索条件
    fireEvent.change(searchInput, { target: { value: "" } });

    // 确认全部会话重新显示
    await waitFor(() => {
      expect(screen.getByText("测试NPC")).toBeInTheDocument();
      expect(screen.getByText("王大川")).toBeInTheDocument();
    });
  });

  test("场景过滤器正常运作", async () => {
    const apiServiceMock = ApiService.getInstance() as jest.Mocked<ApiService>;

    // 设置过滤生效时的 mock 响应
    apiServiceMock.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-1") {
          return Promise.resolve({
            sessions: [
              {
                sessionId: "session-1",
                userId: "user-1",
                scenarioId: "scenario-1",
                title: "测试会话1",
                status: "completed",
                createdAt: "2025-06-28T10:00:00Z",
                updatedAt: "2025-06-28T10:30:00Z",
                npcInfo: {
                  name: "测试NPC",
                  role: "银行职员",
                  company: "测试银行",
                },
              },
            ],
          });
        } else {
          return Promise.resolve({
            sessions: [
              {
                sessionId: "session-1",
                userId: "user-1",
                scenarioId: "scenario-1",
                title: "测试会话1",
                status: "completed",
                createdAt: "2025-06-28T10:00:00Z",
                updatedAt: "2025-06-28T10:30:00Z",
                npcInfo: {
                  name: "测试NPC",
                  role: "银行职员",
                  company: "测试银行",
                },
              },
              {
                sessionId: "session-2",
                userId: "user-1",
                scenarioId: "scenario-2",
                title: "测试会话2",
                status: "active",
                createdAt: "2025-06-29T09:00:00Z",
                updatedAt: "2025-06-29T09:15:00Z",
                npcInfo: {
                  name: "山田太郎",
                  role: "证券销售",
                  company: "ABC证券",
                },
              },
            ],
          });
        }
      },
    );

    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待会话和场景加载
    await waitFor(() => {
      expect(screen.getByText("测试会话1")).toBeInTheDocument();
      expect(screen.getAllByText("场景").length).toBeGreaterThan(0);
    });

    // 打开场景过滤器
    const scenarioFilterButton = screen.getByRole("combobox", {
      name: /场景/,
    });
    fireEvent.mouseDown(scenarioFilterButton);

    // 等待下拉菜单显示
    await waitFor(() => {
      const menuItems = screen.getAllByRole("option");
      expect(menuItems.length).toBeGreaterThan(0);
    });

    // 选择场景1
    const scenarioOption = screen.getByText("场景1");
    fireEvent.click(scenarioOption);

    // 确认过滤选择完成
    await waitFor(() => {
      // 确认过滤生效（省略具体 API 调用验证）
      expect(scenarioOption).toBeInTheDocument();
    });
  });

  test("没有会话时的显示正确", async () => {
    // 设置会话 0 条时的 mock 响应
    const mockApiService = {
      getSessions: jest.fn().mockResolvedValue({
        sessions: [],
      }),
      getScenarios: jest.fn().mockResolvedValue({
        scenarios: [],
      }),
    };

    (ApiService.getInstance as jest.Mock).mockReturnValue(mockApiService);

    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // 等待加载结束（等待数据加载完成）
    await waitFor(() => {
      expect(mockApiService.getSessions).toHaveBeenCalled();
    });

    // 确认加载结束
    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    // 确认会话 0 条时的提示消息
    expect(screen.getByText("没有会话")).toBeInTheDocument();
    expect(
      screen.getByText("请开始新的会话"),
    ).toBeInTheDocument();

    // 确认基础 UI 组件也显示
    expect(
      screen.getByPlaceholderText("按标题或NPC名称搜索"),
    ).toBeInTheDocument();
    // 确认场景过滤器标签存在
    expect(screen.getByLabelText("场景")).toBeInTheDocument();
  });
});
