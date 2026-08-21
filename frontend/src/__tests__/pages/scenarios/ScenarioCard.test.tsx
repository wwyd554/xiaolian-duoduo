import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import ScenarioCard from "../../../pages/scenarios/ScenarioCard";
import { ScenarioInfo } from "../../../types/api";

// react-i18nextのモック
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "ja",
      changeLanguage: jest.fn(),
    },
  }),
  initReactI18next: {
    type: "3rdParty",
    init: jest.fn(),
  },
}));

// APIサービスのモック
jest.mock("../../../services/ApiService", () => {
  const mockApiService = {
    deleteScenario: jest
      .fn()
      .mockResolvedValue({ message: "Deleted successfully" }),
  };

  return {
    ApiService: {
      getInstance: jest.fn(() => mockApiService),
    },
  };
});

// テスト用のシナリオデータ
const mockScenario: ScenarioInfo = {
  scenarioId: "test-scenario-1",
  title: "Test Scenario",
  description: "This is a test scenario description",
  difficulty: "normal",
  category: "general",
  npc: {
    name: "John Doe",
    role: "CEO",
    company: "Test Corp",
    personality: ["Friendly", "Professional"],
  },
};

// コンポーネントをラップするヘルパー関数
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("ScenarioCard Component", () => {
  it("renders scenario information correctly", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} />);
    });

    // タイトルと説明が表示されているか確認
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    expect(
      screen.getByText("This is a test scenario description"),
    ).toBeInTheDocument();

    // 難易度とカテゴリが表示されているか確認
    expect(screen.getByText("general")).toBeInTheDocument();
  });

  it("shows start button", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} />);
    });

    // 開始ボタンが表示されているか確認
    const startButton = screen.getByRole("button", {
      name: /scenarios.start/i,
    });
    expect(startButton).toBeInTheDocument();
  });

  it("shows menu when isOwner=true", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} isOwner={true} />);
    });

    // メニューボタンが表示されているか確認
    const menuButton = screen.getByRole("button", { name: "" });
    expect(menuButton).toBeInTheDocument();

    // メニューを開く
    act(() => {
      fireEvent.click(menuButton);
    });

    // メニュー項目が表示されるか確認
    expect(screen.getByText(/scenarios.actions.edit/i)).toBeInTheDocument();
    expect(screen.getByText(/scenarios.actions.delete/i)).toBeInTheDocument();
  });

  it("does not show menu when isOwner=false", () => {
    act(() => {
      renderWithRouter(
        <ScenarioCard scenario={mockScenario} isOwner={false} />,
      );
    });

    // メニューボタンが表示されていないか確認
    const menuButton = screen.queryByLabelText("more");
    expect(menuButton).not.toBeInTheDocument();
  });

  it("opens delete confirmation dialog when delete option is clicked", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} isOwner={true} />);
    });

    // メニューボタンをクリック
    const menuButton = screen.getByRole("button", { name: "" });
    act(() => {
      fireEvent.click(menuButton);
    });

    // 削除オプションをクリック
    const deleteOption = screen.getByText(/scenarios.actions.delete/i);
    act(() => {
      fireEvent.click(deleteOption);
    });

    // 確認ダイアログが表示されるか確認
    expect(
      screen.getByText(/scenarios.delete.confirmTitle/i),
    ).toBeInTheDocument();
  });

  it("calls onDeleted when deletion is confirmed", async () => {
    const onDeletedMock = jest.fn();

    act(() => {
      renderWithRouter(
        <ScenarioCard
          scenario={mockScenario}
          isOwner={true}
          onDeleted={onDeletedMock}
        />,
      );
    });

    // メニューボタンをクリック
    const menuButton = screen.getByRole("button", { name: "" });
    act(() => {
      fireEvent.click(menuButton);
    });

    // 削除オプションをクリック
    const deleteOption = screen.getByText(/scenarios.actions.delete/i);
    act(() => {
      fireEvent.click(deleteOption);
    });

    // 削除ボタンをクリック
    const confirmDeleteButton = screen.getByRole("button", {
      name: /common.delete/i,
    });
    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // onDeletedが呼び出されるか確認
    await waitFor(() => {
      expect(onDeletedMock).toHaveBeenCalledWith("test-scenario-1");
    });
  });

  it("calls onScenarioStart when start button is clicked", () => {
    const onScenarioStartMock = jest.fn();

    act(() => {
      renderWithRouter(
        <ScenarioCard
          scenario={mockScenario}
          onScenarioStart={onScenarioStartMock}
        />,
      );
    });

    // スタートボタンをクリック
    const startButton = screen.getByRole("button", {
      name: /scenarios.start/i,
    });
    act(() => {
      fireEvent.click(startButton);
    });

    // onScenarioStartが呼び出されるか確認
    expect(onScenarioStartMock).toHaveBeenCalledWith("test-scenario-1");
  });
});
