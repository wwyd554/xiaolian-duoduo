import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SalesReviewPage from "../../pages/history/SalesReviewPage";
import { ApiService } from "../../services/ApiService";
import type { ReviewItem } from "../../types/reviews";

jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
jest.mock("../../pages/history/ReviewImportDialog", () => () => null);
const load = jest.fn();
const remove = jest.fn();
const makeItem = (id: string, source: ReviewItem["source"] = "practice"): ReviewItem => ({ id, title: `记录${id}`, scenario_id: "demo", status: "completed", created_at: "2026-11-05T00:00:00Z", source, analysis_status: "completed" });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ApiService.getInstance).mockReturnValue({ getReviews: load, deleteReview: remove } as unknown as ApiService);
});
const mount = () => render(<MemoryRouter initialEntries={["/history?source=all&state=completed"]}><SalesReviewPage /></MemoryRouter>);
const deleteRecord = async (title: string) => {
  fireEvent.click(await screen.findByRole("button", { name: `复盘操作：${title}` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "删除复盘" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));
};

test("deleting a chat review refreshes the total while preserving other source records", async () => {
  const items = [makeItem("1"), makeItem("2", "chat"), makeItem("3", "audio")];
  load.mockResolvedValueOnce({ items, total: 3 }).mockResolvedValue({ items: [items[0], items[2]], total: 2 });
  remove.mockResolvedValue({ success: true });
  mount();
  await deleteRecord("记录2");
  expect(await screen.findByText("共 2 条记录")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("记录2")).not.toBeInTheDocument());
  expect(screen.getByText("记录1")).toBeInTheDocument();
  expect(screen.getByText("记录3")).toBeInTheDocument();
  expect(remove).toHaveBeenCalledWith("2");
  expect(load).toHaveBeenLastCalledWith("all", 1, "completed");
});

test("deleting the last record on page two returns to the previous valid page", async () => {
  let removed = false;
  load.mockImplementation(async (_source, page) => ({ items: [makeItem(page === 2 ? "last" : "kept")], total: removed ? 12 : 13 }));
  remove.mockImplementation(async () => { removed = true; return { success: true }; });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Go to page 2" }));
  await deleteRecord("记录last");
  expect(await screen.findByText("共 12 条记录")).toBeInTheDocument();
  expect(await screen.findByText("记录kept")).toBeInTheDocument();
  expect(load).toHaveBeenLastCalledWith("all", 1, "completed");
});
