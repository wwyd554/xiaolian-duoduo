/**
 * シナリオ管理ページの権限チェックロジックのテスト
 *
 * システムシナリオの編集は管理者のみ、削除は不可、
 * カスタムシナリオは作成者のみ編集・削除可能であることを検証する
 */
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// テスト用i18n設定
i18n.use(initReactI18next).init({
  lng: "ja",
  fallbackLng: "ja",
  debug: false,
  interpolation: { escapeValue: false },
  resources: {
    ja: {
      translation: {
        "scenarios.management.title": "シナリオ管理",
        "scenarios.management.subtitle": "シナリオの管理",
        "scenarios.management.importButton": "インポート",
        "scenarios.management.scenarioTitle": "タイトル",
        "scenarios.management.difficulty": "難易度",
        "scenarios.management.category": "カテゴリ",
        "scenarios.management.language": "言語",
        "scenarios.management.actions": "アクション",
        "scenarios.management.edit": "編集",
        "scenarios.management.delete": "削除",
        "scenarios.management.export": "エクスポート",
        "scenarios.beginner": "初級",
        "scenarios.intermediate": "中級",
        "scenarios.advanced": "上級",
        "common.processing": "処理中...",
        "scenarios.noScenarios": "シナリオがありません",
      },
    },
  },
});

// モック用の変数（テストケースごとに変更可能）
let mockIsAdmin = false;

// AWS Amplifyのモック
jest.mock("aws-amplify/auth", () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    userId: "test-user-id",
    username: "testuser",
  }),
}));

// AuthServiceのモック
jest.mock("../../../../services/AuthService", () => ({
  AuthService: {
    getInstance: jest.fn().mockReturnValue({
      isAdmin: jest.fn().mockImplementation(() => Promise.resolve(mockIsAdmin)),
    }),
  },
}));

// ApiServiceのモック（テストケースごとにシナリオデータを変更）
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

// テスト用ヘルパー: コンポーネントをレンダリング
const renderPage = () => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <ScenarioManagementPage />
      </I18nextProvider>
    </BrowserRouter>,
  );
};

describe("シナリオ権限チェック", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = false;
    mockScenarios = [];
  });

  describe("システムシナリオ（createdBy: system）", () => {
    beforeEach(() => {
      mockScenarios = [
        {
          scenarioId: "system-scenario-1",
          title: "システムシナリオ",
          difficulty: "normal",
          category: "IT",
          language: "ja",
          createdBy: "system",
        },
      ];
    });

    it("一般ユーザーには編集ボタンが表示されない", async () => {
      mockIsAdmin = false;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("システムシナリオ")).toBeInTheDocument();
      });

      // 編集ボタンが存在しないことを確認
      const editButtons = screen.queryAllByLabelText(/編集/);
      expect(editButtons).toHaveLength(0);
    });

    it("管理者には編集ボタンが表示される", async () => {
      mockIsAdmin = true;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("システムシナリオ")).toBeInTheDocument();
      });

      // 編集ボタンが存在することを確認
      const editButton = screen.getByLabelText("編集 システムシナリオ");
      expect(editButton).toBeInTheDocument();
    });

    it("管理者でも削除ボタンは表示されない", async () => {
      mockIsAdmin = true;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("システムシナリオ")).toBeInTheDocument();
      });

      // 削除ボタンが存在しないことを確認
      const deleteButtons = screen.queryAllByLabelText(/削除/);
      expect(deleteButtons).toHaveLength(0);
    });
  });

  describe("カスタムシナリオ（自分が作成）", () => {
    beforeEach(() => {
      mockScenarios = [
        {
          scenarioId: "my-scenario-1",
          title: "自分のシナリオ",
          difficulty: "beginner",
          category: "一般",
          language: "ja",
          createdBy: "test-user-id", // 現在のユーザーID
        },
      ];
    });

    it("作成者には編集ボタンと削除ボタンが表示される", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("自分のシナリオ")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("編集 自分のシナリオ")).toBeInTheDocument();
      expect(screen.getByLabelText("削除 自分のシナリオ")).toBeInTheDocument();
    });
  });

  describe("カスタムシナリオ（他人が作成）", () => {
    beforeEach(() => {
      mockScenarios = [
        {
          scenarioId: "other-scenario-1",
          title: "他人のシナリオ",
          difficulty: "advanced",
          category: "金融",
          language: "ja",
          createdBy: "other-user-id", // 別のユーザーID
        },
      ];
    });

    it("他人のシナリオには編集・削除ボタンが表示されない", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("他人のシナリオ")).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByLabelText(/編集/);
      const deleteButtons = screen.queryAllByLabelText(/削除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });

    it("管理者でも他人のカスタムシナリオは編集・削除できない", async () => {
      mockIsAdmin = true;
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("他人のシナリオ")).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByLabelText(/編集/);
      const deleteButtons = screen.queryAllByLabelText(/削除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });
  });

  describe("混合シナリオ一覧", () => {
    it("管理者はシステムシナリオの編集と自分のシナリオの編集・削除ができる", async () => {
      mockIsAdmin = true;
      mockScenarios = [
        {
          scenarioId: "system-1",
          title: "システムA",
          difficulty: "normal",
          category: "IT",
          language: "ja",
          createdBy: "system",
        },
        {
          scenarioId: "my-1",
          title: "自分のB",
          difficulty: "beginner",
          category: "一般",
          language: "ja",
          createdBy: "test-user-id",
        },
        {
          scenarioId: "other-1",
          title: "他人のC",
          difficulty: "advanced",
          category: "金融",
          language: "ja",
          createdBy: "other-user-id",
        },
      ];

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("システムA")).toBeInTheDocument();
        expect(screen.getByText("自分のB")).toBeInTheDocument();
        expect(screen.getByText("他人のC")).toBeInTheDocument();
      });

      // システムシナリオ: 編集○、削除×
      expect(screen.getByLabelText("編集 システムA")).toBeInTheDocument();
      expect(screen.queryByLabelText("削除 システムA")).not.toBeInTheDocument();

      // 自分のシナリオ: 編集○、削除○
      expect(screen.getByLabelText("編集 自分のB")).toBeInTheDocument();
      expect(screen.getByLabelText("削除 自分のB")).toBeInTheDocument();

      // 他人のシナリオ: 編集×、削除×
      expect(screen.queryByLabelText("編集 他人のC")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("削除 他人のC")).not.toBeInTheDocument();
    });
  });

  describe("レガシーシナリオ（createdBy 未設定）", () => {
    it("createdByが未設定のシナリオは編集・削除ボタンが表示されない", async () => {
      mockScenarios = [
        {
          scenarioId: "legacy-scenario-1",
          title: "レガシーシナリオ",
          difficulty: "normal",
          category: "一般",
          language: "ja",
          // createdBy なし（旧データ）
        },
      ];

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("レガシーシナリオ")).toBeInTheDocument();
      });

      // createdByが未設定の場合、誰も編集・削除できない
      const editButtons = screen.queryAllByLabelText(/編集/);
      const deleteButtons = screen.queryAllByLabelText(/削除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });

    it("管理者でもcreatedByが未設定のシナリオは編集・削除できない", async () => {
      mockIsAdmin = true;
      mockScenarios = [
        {
          scenarioId: "legacy-scenario-2",
          title: "レガシーシナリオ2",
          difficulty: "normal",
          category: "一般",
          language: "ja",
          // createdBy なし
        },
      ];

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("レガシーシナリオ2")).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByLabelText(/編集/);
      const deleteButtons = screen.queryAllByLabelText(/削除/);
      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });
  });
});
