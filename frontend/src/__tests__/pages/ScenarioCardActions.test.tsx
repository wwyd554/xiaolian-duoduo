import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import ScenarioSelectPage from "../../pages/ScenarioSelectPage";
import { ApiService } from "../../services/ApiService";
import { AuthService } from "../../services/AuthService";
import zh from "../../i18n/locales/zh.json";

const navigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
jest.mock("../../services/AuthService", () => ({ AuthService: { getInstance: jest.fn() } }));

const i18n = createInstance();
const remove = jest.fn();
const admin = jest.fn();
const scenes = [
  { scenarioId: "system", title: "系统练习", createdBy: "system" },
  { scenarioId: "mine", title: "我的练习", createdBy: "me" },
  { scenarioId: "other", title: "其他人的练习", createdBy: "someone-else", isCustom: true },
].map((scene) => ({ ...scene, description: "练习客户沟通", difficulty: "normal", category: "通用", goals: [] }));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh", resources: { zh: { translation: zh } }, interpolation: { escapeValue: false } });
});
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  remove.mockReset();
  admin.mockResolvedValue(false);
  (ApiService.getInstance as jest.Mock).mockReturnValue({ getScenarios: jest.fn().mockResolvedValue({ scenarios: scenes }), deleteScenario: remove });
  (AuthService.getInstance as jest.Mock).mockReturnValue({ getCurrentUser: jest.fn().mockResolvedValue({ userId: "me" }), isAdmin: admin });
});

async function renderPage() {
  render(<I18nextProvider i18n={i18n}><ScenarioSelectPage workspaceHome /></I18nextProvider>);
  await screen.findByRole("button", { name: "场景操作：我的练习" });
}
async function openMenu(title = "我的练习") {
  fireEvent.click(screen.getByRole("button", { name: `场景操作：${title}` }));
  return screen.findByRole("menu");
}
async function openDelete() {
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "删除场景" }));
  return screen.findByRole("dialog", { name: "删除这个场景？" });
}

test("every card has a menu; read-only scenarios cannot be edited or deleted", async () => {
  await renderPage();
  expect(screen.queryByRole("button", { name: "场景管理" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "创建场景" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "刷新" })).not.toBeInTheDocument();
  const system = await openMenu("系统练习");
  expect(within(system).getByRole("menuitem", { name: "修改场景" })).toHaveAttribute("aria-disabled", "true");
  expect(within(system).getByRole("menuitem", { name: "删除场景" })).toHaveAttribute("aria-disabled", "true");
  fireEvent.keyDown(system, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  const other = await openMenu("其他人的练习");
  expect(within(other).getByRole("menuitem", { name: "修改场景" })).toHaveAttribute("aria-disabled", "true");
  expect(within(other).getByRole("menuitem", { name: "删除场景" })).toHaveAttribute("aria-disabled", "true");
  expect(remove).not.toHaveBeenCalled();
});

test("owner can navigate straight to the existing edit page", async () => {
  await renderPage();
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "修改场景" }));
  expect(navigate).toHaveBeenCalledWith("/scenarios/edit/mine");
});

test("deletion requires confirmation, sends once, then removes only that card and its favorite", async () => {
  localStorage.setItem("favoriteScenarios", JSON.stringify(["mine", "other"]));
  let complete!: (value: unknown) => void;
  remove.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  await renderPage();
  let dialog = await openDelete();
  expect(within(dialog).getByText("我的练习")).toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(remove).not.toHaveBeenCalled();
  dialog = await openDelete();
  const confirm = within(dialog).getByRole("button", { name: "确认删除" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith("mine");
  expect(within(dialog).getByRole("button", { name: "删除中..." })).toBeDisabled();
  await act(async () => { complete({ scenarioId: "mine" }); });
  await waitFor(() => expect(screen.queryByRole("button", { name: "场景操作：我的练习" })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "场景操作：其他人的练习" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("favoriteScenarios")!)).toEqual(["other"]);
  expect(screen.getByText("已删除场景")).toBeInTheDocument();
});

test("failure keeps the card and confirmation open for retry", async () => {
  remove.mockRejectedValueOnce(new Error("服务暂不可用")).mockResolvedValueOnce({ scenarioId: "mine" });
  await renderPage();
  const dialog = await openDelete();
  fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));
  expect(await within(dialog).findByText("服务暂不可用")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "场景操作：我的练习", hidden: true })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(remove).toHaveBeenCalledTimes(2);
});

test("admin keeps the existing permission to edit system scenarios, without deleting them", async () => {
  admin.mockResolvedValue(true);
  await renderPage();
  const menu = await openMenu("系统练习");
  expect(within(menu).getByRole("menuitem", { name: "修改场景" })).not.toHaveAttribute("aria-disabled", "true");
  expect(within(menu).getByRole("menuitem", { name: "删除场景" })).toHaveAttribute("aria-disabled", "true");
});


test("card opens practice while its separate menu does not trigger navigation", async () => {
  await renderPage();
  const menu = await openMenu();
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.keyDown(menu, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "开始练习：我的练习" }));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith("/conversation/mine");
});
