import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewRecordMenu from "../../pages/history/ReviewRecordMenu";
import { ApiService } from "../../services/ApiService";
import type { ReviewItem } from "../../types/reviews";

jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
const remove = jest.fn();
const deleted = jest.fn();
const item: ReviewItem = { id: "review-1", title: "微信续约沟通", source: "chat", scenario_id: "__import__", status: "completed", analysis_status: "completed", created_at: "2026-11-05T00:00:00Z" };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ApiService.getInstance).mockReturnValue({ deleteReview: remove } as unknown as ApiService);
});
const openDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: "复盘操作：微信续约沟通" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "删除复盘" }));
  return screen.findByRole("dialog");
};

test("opening and cancelling the confirmation does not delete the record", async () => {
  render(<ReviewRecordMenu item={item} onDeleted={deleted} />);
  expect(await openDialog()).toHaveTextContent("微信续约沟通");
  expect(screen.getByRole("dialog")).toHaveTextContent("永久删除，无法恢复");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(remove).not.toHaveBeenCalled();
  expect(deleted).not.toHaveBeenCalled();
});

test("only confirmed success removes the selected record and duplicate clicks are locked", async () => {
  let resolve!: (result: unknown) => void;
  remove.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  render(<ReviewRecordMenu item={item} onDeleted={deleted} />);
  await openDialog();
  const confirm = screen.getByRole("button", { name: "确认删除" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith("review-1");
  expect(deleted).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
  resolve({ success: true, sessionId: "review-1" });
  await waitFor(() => expect(deleted).toHaveBeenCalledWith("review-1"));
});

test("a failed delete preserves the record and confirmation supports retry", async () => {
  remove.mockRejectedValueOnce(new Error("连接中断，请重试")).mockResolvedValueOnce({ success: true });
  render(<ReviewRecordMenu item={{ ...item, status: "active", analysis_status: "processing" }} onDeleted={deleted} />);
  await openDialog();
  expect(screen.getByRole("dialog")).toHaveTextContent("进行中的练习也会一并结束");
  fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("连接中断，请重试");
  expect(deleted).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
  await waitFor(() => expect(deleted).toHaveBeenCalledWith("review-1"));
});
