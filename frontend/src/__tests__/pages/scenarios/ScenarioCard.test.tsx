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

// react-i18next 的 mock
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

// ApiService 的 mock
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

// 测试用场景数据
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

// 包装组件的辅助函数
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("ScenarioCard Component", () => {
  it("renders scenario information correctly", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} />);
    });

    // 确认标题和说明是否显示
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    expect(
      screen.getByText("This is a test scenario description"),
    ).toBeInTheDocument();

    // 确认难度和类别是否显示
    expect(screen.getByText("general")).toBeInTheDocument();
  });

  it("shows start button", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} />);
    });

    // 确认开始按钮是否显示
    const startButton = screen.getByRole("button", {
      name: /scenarios.start/i,
    });
    expect(startButton).toBeInTheDocument();
  });

  it("shows menu when isOwner=true", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} isOwner={true} />);
    });

    // 确认菜单按钮是否显示
    const menuButton = screen.getByRole("button", { name: "" });
    expect(menuButton).toBeInTheDocument();

    // 打开菜单
    act(() => {
      fireEvent.click(menuButton);
    });

    // 确认菜单项是否显示
    expect(screen.getByText(/scenarios.actions.edit/i)).toBeInTheDocument();
    expect(screen.getByText(/scenarios.actions.delete/i)).toBeInTheDocument();
  });

  it("does not show menu when isOwner=false", () => {
    act(() => {
      renderWithRouter(
        <ScenarioCard scenario={mockScenario} isOwner={false} />,
      );
    });

    // 确认菜单按钮未显示
    const menuButton = screen.queryByLabelText("more");
    expect(menuButton).not.toBeInTheDocument();
  });

  it("opens delete confirmation dialog when delete option is clicked", () => {
    act(() => {
      renderWithRouter(<ScenarioCard scenario={mockScenario} isOwner={true} />);
    });

    // 点击菜单按钮
    const menuButton = screen.getByRole("button", { name: "" });
    act(() => {
      fireEvent.click(menuButton);
    });

    // 点击删除选项
    const deleteOption = screen.getByText(/scenarios.actions.delete/i);
    act(() => {
      fireEvent.click(deleteOption);
    });

    // 确认确认对话框是否显示
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

    // 点击菜单按钮
    const menuButton = screen.getByRole("button", { name: "" });
    act(() => {
      fireEvent.click(menuButton);
    });

    // 点击删除选项
    const deleteOption = screen.getByText(/scenarios.actions.delete/i);
    act(() => {
      fireEvent.click(deleteOption);
    });

    // 点击删除按钮
    const confirmDeleteButton = screen.getByRole("button", {
      name: /common.delete/i,
    });
    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // 确认 onDeleted 是否被调用
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

    // 点击开始按钮
    const startButton = screen.getByRole("button", {
      name: /scenarios.start/i,
    });
    act(() => {
      fireEvent.click(startButton);
    });

    // 确认 onScenarioStart 是否被调用
    expect(onScenarioStartMock).toHaveBeenCalledWith("test-scenario-1");
  });
});
