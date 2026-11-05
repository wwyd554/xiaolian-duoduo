import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewImportDialog from "../../pages/history/ReviewImportDialog";
import { ApiService } from "../../services/ApiService";

jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
const save = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (ApiService.getInstance as jest.Mock).mockReturnValue({ importReview: save });
});

test("requires explicit speaker labels before saving", () => {
  render(<ReviewImportDialog source="chat" onClose={jest.fn()} onImported={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("聊天或转写文字"), { target: { value: "无法区分发言人的内容" } });
  fireEvent.click(screen.getByRole("button", { name: "预览并确认" }));
  expect(screen.getByText(/每条消息请以/)).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("previews roles and submits confirmed transcript", async () => {
  save.mockResolvedValue({ sessionId: "saved" });
  const done = jest.fn();
  render(<ReviewImportDialog source="chat" onClose={jest.fn()} onImported={done} />);
  fireEvent.change(screen.getByLabelText("聊天或转写文字"), { target: { value: "我：可以演示吗？\n客户：担心迁移成本" } });
  fireEvent.click(screen.getByRole("button", { name: "预览并确认" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/复盘标题/), { target: { value: "续费" } });
  fireEvent.change(screen.getByLabelText(/沟通背景与目标/), { target: { value: "预约演示" } });
  fireEvent.change(screen.getByLabelText("第 2 条内容"), { target: { value: "主要担心数据迁移成本" } });
  fireEvent.click(screen.getByRole("button", { name: "确认并生成复盘" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith("saved"));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    source: "chat", messages: [{ role: "user", content: "可以演示吗？" }, { role: "npc", content: "主要担心数据迁移成本" }],
  }));
});

 test("returning to import preserves corrected transcript and requires background", () => {
  render(<ReviewImportDialog source="chat" onClose={jest.fn()} onImported={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("聊天或转写文字"), { target: { value: "我：方便聊吗？\n客户：可以" } });
  fireEvent.click(screen.getByRole("button", { name: "预览并确认" }));
  fireEvent.click(screen.getByRole("button", { name: "确认并生成复盘" }));
  expect(screen.getByText("请填写复盘标题和沟通背景。")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("第 2 条内容"), { target: { value: "担心费用" } });
  fireEvent.click(screen.getByRole("button", { name: "返回编辑" }));
  expect(screen.getByLabelText("聊天或转写文字")).toHaveValue("我：方便聊吗？\n客户：担心费用");
});
