import React, { StrictMode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ScenarioGeneratePage from "../../pages/scenarios/ScenarioGeneratePage";
import { ApiService } from "../../services/ApiService";
const navigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => navigate, useLocation: () => ({ state: { prompt: "练习合同续约" } }) }));
jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
const generate = jest.fn(); const create = jest.fn();
const draft = { title: "续约谈判", description: "客户希望降低预算", initialMessage: "能降价吗？", difficulty: "中级", npc: { name: "李经理", role: "采购经理", company: "测试公司" }, goals: [{ description: "了解预算", criteria: ["确认预算范围"] }] };
beforeEach(() => { jest.clearAllMocks(); (ApiService.getInstance as jest.Mock).mockReturnValue({ generateScenario: generate, createScenario: create }); });
test("generates once in strict mode and saves only after confirmation", async () => {
 generate.mockResolvedValue({ draft }); create.mockResolvedValue({ scenarioId: "new-scene" });
 render(<StrictMode><ScenarioGeneratePage /></StrictMode>);
 await screen.findByDisplayValue("续约谈判");
 expect(generate).toHaveBeenCalledTimes(1); expect(create).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText("场景名称"), { target: { value: "我的续约练习" } });
 fireEvent.click(screen.getByRole("button", { name: "确认场景，进入练习" }));
 await waitFor(() => expect(navigate).toHaveBeenCalledWith("/conversation/new-scene"));
 expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: "我的续约练习", visibility: "private", difficulty: "normal" }));
});
test("shows generation failure and retries without saving a broken draft", async () => {
 generate.mockRejectedValueOnce(new Error("生成服务暂不可用")).mockResolvedValueOnce({ draft });
 render(<ScenarioGeneratePage />);
 await screen.findByText("生成服务暂不可用");
 expect(create).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "生成场景" }));
 await screen.findByDisplayValue("续约谈判"); expect(generate).toHaveBeenCalledTimes(2);
});
