import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import SessionHistoryPage from "../../pages/history/SessionHistoryPage";
import { ApiService } from "../../services/ApiService";

// APIサービスのモック
jest.mock("../../services/ApiService", () => ({
  ApiService: {
    getInstance: jest.fn(),
  },
}));

// AuthServiceのモック
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

// i18nのモック
jest.mock("react-i18next", () => ({
  useTranslation: () => {
    return {
      t: (key: string) => {
        const translations: { [key: string]: string } = {
          "history.title": "会話履歴",
          "history.search": "検索",
          "history.searchPlaceholder": "タイトルかNPC名で検索",
          "history.scenarioFilter": "シナリオ",
          "history.allScenarios": "すべてのシナリオ",
          "history.completed": "完了",
          "history.active": "進行中",
        };
        return translations[key] || key;
      },
    };
  },
}));

// useNavigateのモック
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

// テストデータ
const mockSessions = [
  {
    sessionId: "session-1",
    userId: "user-1",
    title: "つみたてNISA提案",
    status: "completed" as const,
    createdAt: "2025-06-28T10:00:00Z",
    updatedAt: "2025-06-28T10:30:00Z",
    scenarioId: "scenario-1",
    npcInfo: {
      name: "佐藤課長",
      role: "資産運用アドバイザー",
      company: "ABC証券",
    },
  },
  {
    sessionId: "session-2",
    userId: "user-1",
    title: "終身保険の提案",
    status: "completed" as const,
    createdAt: "2025-06-27T09:00:00Z",
    updatedAt: "2025-06-27T09:45:00Z",
    scenarioId: "scenario-2",
    npcInfo: {
      name: "鈴木部長",
      role: "保険営業マネージャー",
      company: "DEF保険",
    },
  },
  {
    sessionId: "session-3",
    userId: "user-1",
    title: "住宅ローン相談",
    status: "active" as const,
    createdAt: "2025-06-29T11:00:00Z",
    updatedAt: "2025-06-29T11:20:00Z",
    scenarioId: "scenario-3",
    npcInfo: {
      name: "田中支店長",
      role: "住宅ローン担当",
      company: "GHI銀行",
    },
  },
];

const mockScenarios = [
  {
    scenarioId: "scenario-1",
    title: "つみたてNISA提案シナリオ",
    description: "初心者向け資産運用提案",
    difficulty: "beginner",
    category: "finance",
  },
  {
    scenarioId: "scenario-2",
    title: "保険商品提案シナリオ",
    description: "家族向け保険提案",
    difficulty: "intermediate",
    category: "insurance",
  },
  {
    scenarioId: "scenario-3",
    title: "住宅ローン相談シナリオ",
    description: "住宅購入者向け",
    difficulty: "advanced",
    category: "loan",
  },
];

describe("セッション検索とフィルタリング機能", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモックレスポンス
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

  test("テキスト検索がタイトルで正しく動作する", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // データが読み込まれるのを待機
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument();
      expect(screen.getByText("住宅ローン相談")).toBeInTheDocument();
    });

    // 検索ボックスを取得
    const searchInput = screen.getByPlaceholderText("タイトルかNPC名で検索");

    // 「NISA」で検索
    await userEvent.type(searchInput, "NISA");

    // 検索結果を確認
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.queryByText("終身保険の提案")).not.toBeInTheDocument();
      expect(screen.queryByText("住宅ローン相談")).not.toBeInTheDocument();
    });
  });

  test("テキスト検索がNPC名で正しく動作する", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // データが読み込まれるのを待機
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument();
      expect(screen.getByText("住宅ローン相談")).toBeInTheDocument();
    });

    // 検索ボックスを取得
    const searchInput = screen.getByPlaceholderText("タイトルかNPC名で検索");

    // 「鈴木」で検索
    await userEvent.type(searchInput, "鈴木");

    // 検索結果を確認
    await waitFor(() => {
      expect(screen.queryByText("佐藤課長")).not.toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument(); // 鈴木部長のセッションが表示されていることを確認
      expect(screen.queryByText("田中支店長")).not.toBeInTheDocument();
    });
  });

  test("空の検索文字列ですべての結果が表示される", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // データが読み込まれるのを待機
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
    });

    // 検索ボックスを取得
    const searchInput = screen.getByPlaceholderText("タイトルかNPC名で検索");

    // まず「保険」で検索して結果を絞り込む
    await userEvent.type(searchInput, "保険");

    // 検索結果を確認
    await waitFor(() => {
      expect(screen.queryByText("つみたてNISA提案")).not.toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument();
      expect(screen.queryByText("住宅ローン相談")).not.toBeInTheDocument();
    });

    // 検索をクリア
    await userEvent.clear(searchInput);

    // すべての結果が再表示されるか確認
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument();
      expect(screen.getByText("住宅ローン相談")).toBeInTheDocument();
    });
  });

  test("シナリオフィルタが正しく動作する", async () => {
    // APIの挙動をモック
    const mockApiService = ApiService.getInstance() as jest.Mocked<ApiService>;

    // シナリオフィルタ適用時のモック
    mockApiService.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-1") {
          return Promise.resolve({
            sessions: [mockSessions[0]], // つみたてNISA提案のみ
          });
        } else if (scenarioId === "scenario-2") {
          return Promise.resolve({
            sessions: [mockSessions[1]], // 終身保険の提案のみ
          });
        } else {
          return Promise.resolve({
            sessions: mockSessions, // すべてのセッション
          });
        }
      },
    );

    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // データが読み込まれるのを待機
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
    });

    // シナリオフィルタを開く
    const scenarioFilter = screen.getByRole("combobox", { name: /シナリオ/ });
    fireEvent.mouseDown(scenarioFilter);

    // ドロップダウンメニューが表示されるまで待機
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    // つみたてNISAシナリオを選択
    const nisaOption = screen.getByText("つみたてNISA提案シナリオ");
    fireEvent.click(nisaOption);

    // APIが正しく呼ばれることを確認
    await waitFor(() => {
      expect(mockApiService.getSessions).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        "scenario-1",
      );
    });

    // フィルタリング結果を確認
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.queryByText("終身保険の提案")).not.toBeInTheDocument();
      expect(screen.queryByText("住宅ローン相談")).not.toBeInTheDocument();
    });
  });

  test("「すべてのシナリオ」選択で全結果が表示される", async () => {
    // APIの挙動をモック
    const mockApiService = ApiService.getInstance() as jest.Mocked<ApiService>;

    // シナリオフィルタ適用時のモック
    mockApiService.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-2") {
          return Promise.resolve({
            sessions: [mockSessions[1]], // 終身保険の提案のみ
          });
        } else {
          return Promise.resolve({
            sessions: mockSessions, // すべてのセッション
          });
        }
      },
    );

    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // データが読み込まれるのを待機
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
    });

    // シナリオフィルタを開く
    const scenarioFilter = screen.getByRole("combobox", { name: /シナリオ/ });
    fireEvent.mouseDown(scenarioFilter);
    await waitFor(() =>
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0),
    );

    // 保険シナリオを選択してフィルタリング
    const insuranceOption = screen.getByText("保険商品提案シナリオ");
    fireEvent.click(insuranceOption);

    // フィルタリングが適用されたことを確認
    await waitFor(() => {
      expect(screen.queryByText("つみたてNISA提案")).not.toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument();
      expect(screen.queryByText("住宅ローン相談")).not.toBeInTheDocument();
    });

    // 再度フィルタを開く
    fireEvent.mouseDown(scenarioFilter);
    await waitFor(() =>
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0),
    );

    // すべてのシナリオを選択
    const allOption = screen.getByText("すべてのシナリオ");
    fireEvent.click(allOption);

    // APIが正しく呼ばれることを確認
    await waitFor(() => {
      // 空文字列または未定義のシナリオIDで呼ばれる
      expect(mockApiService.getSessions).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        "",
      );
    });

    // 全結果が表示されることを確認
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.getByText("終身保険の提案")).toBeInTheDocument();
      expect(screen.getByText("住宅ローン相談")).toBeInTheDocument();
    });
  });

  test("検索とフィルタを組み合わせて使用できる", async () => {
    render(
      <MemoryRouter>
        <SessionHistoryPage />
      </MemoryRouter>,
    );

    // データが読み込まれるのを待機
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
    });

    // API挙動のモック更新（シナリオフィルタ適用後）
    const mockApiService = ApiService.getInstance() as jest.Mocked<ApiService>;
    mockApiService.getSessions.mockImplementation(
      (limit, nextToken, scenarioId) => {
        if (scenarioId === "scenario-1") {
          return Promise.resolve({
            sessions: [mockSessions[0]], // つみたてNISA提案のみ
          });
        } else {
          return Promise.resolve({
            sessions: mockSessions,
          });
        }
      },
    );

    // シナリオフィルタを適用（NISAシナリオ）
    const scenarioFilter = screen.getByRole("combobox", { name: /シナリオ/ });
    fireEvent.mouseDown(scenarioFilter);
    await waitFor(() =>
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0),
    );

    const nisaOption = screen.getByText("つみたてNISA提案シナリオ");
    fireEvent.click(nisaOption);

    // フィルタリング結果を確認
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument();
      expect(screen.queryByText("終身保険の提案")).not.toBeInTheDocument();
    });

    // 検索を追加（「支店」で検索）- フィルタリング済みの結果からさらに絞り込む
    const searchInput = screen.getByPlaceholderText("タイトルかNPC名で検索");
    await userEvent.type(searchInput, "課長");

    // 検索結果を確認
    await waitFor(() => {
      expect(screen.getByText("つみたてNISA提案")).toBeInTheDocument(); // 佐藤課長を含むためマッチ
      // 他の結果は既にフィルタリングで除外されている
    });

    // 「部長」で検索（マッチしない）
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "部長");

    // 結果が0件になることを確認
    await waitFor(() => {
      expect(screen.queryByText("つみたてNISA提案")).not.toBeInTheDocument();
      expect(screen.queryByText("終身保険の提案")).not.toBeInTheDocument();
      expect(screen.queryByText("住宅ローン相談")).not.toBeInTheDocument();
    });
  });
});
