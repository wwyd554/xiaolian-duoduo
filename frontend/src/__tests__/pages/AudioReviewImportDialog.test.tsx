import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ReviewImportDialog from "../../pages/history/ReviewImportDialog";
import { ApiService } from "../../services/ApiService";
import type { RecordingTranscription } from "../../types/reviews";

jest.mock("../../services/ApiService", () => ({
  ApiService: { getInstance: jest.fn() },
}));

const transcribe = jest.fn();
const save = jest.fn();
const createObjectURL = jest.fn(() => "blob:recording-preview");
const revokeObjectURL = jest.fn();
const transcript: RecordingTranscription = {
  text: "方便了解一下需求吗？主要担心迁移成本。",
  segments: [
    { start: 0, end: 2, text: "方便了解一下需求吗？" },
    { start: 2, end: 5, text: "主要担心迁移成本。" },
  ],
  durationSeconds: 5,
  language: "zh",
};

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

beforeEach(() => {
  jest.resetAllMocks();
  createObjectURL.mockReturnValue("blob:recording-preview");
  (ApiService.getInstance as jest.Mock).mockReturnValue({
    transcribeRecording: transcribe,
    importReview: save,
  });
});

function selectAudio(
  file = new File(["audio"], "客户沟通.wav", { type: "audio/wav" }),
) {
  fireEvent.change(screen.getByLabelText("选择录音文件"), {
    target: { files: [file] },
  });
  return file;
}

async function openTranscript() {
  transcribe.mockResolvedValueOnce(transcript);
  selectAudio();
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  await screen.findByLabelText("第 1 条内容");
}

async function selectRole(index: number, label: "我（销售）" | "客户") {
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: `第 ${index} 条角色` }),
  );
  fireEvent.click(screen.getByRole("option", { name: label }));
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
}

test("audio entry uploads a file and saves only after explicit speaker and transcript confirmation", async () => {
  const imported = jest.fn();
  save.mockResolvedValue({ sessionId: "audio-review-id" });
  render(
    <ReviewImportDialog
      source="audio"
      onClose={jest.fn()}
      onImported={imported}
    />,
  );
  expect(screen.getByRole("button", { name: "开始转写" })).toBeDisabled();
  expect(screen.queryByLabelText("聊天或转写文字")).not.toBeInTheDocument();

  await openTranscript();
  expect(transcribe).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  expect(
    screen.getByRole("combobox", { name: "第 1 条角色" }),
  ).toHaveTextContent("选择发言人");
  expect(
    screen.getByRole("combobox", { name: "第 2 条角色" }),
  ).toHaveTextContent("选择发言人");
  expect(screen.getByLabelText(/复盘标题/)).toHaveValue("客户沟通");

  fireEvent.click(screen.getByRole("button", { name: "确认并生成复盘" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "请填写复盘标题和沟通背景",
  );
  fireEvent.change(screen.getByLabelText(/沟通背景与目标/), {
    target: { value: "预约软件演示" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认并生成复盘" }));
  expect(screen.getByRole("alert")).toHaveTextContent("请为每条发言选择");
  expect(save).not.toHaveBeenCalled();

  await selectRole(1, "我（销售）");
  await selectRole(2, "我（销售）");
  fireEvent.click(screen.getByRole("button", { name: "确认并生成复盘" }));
  expect(screen.getByRole("alert")).toHaveTextContent("销售和客户双方");
  expect(save).not.toHaveBeenCalled();

  await selectRole(2, "客户");
  fireEvent.change(screen.getByLabelText("第 2 条内容"), {
    target: { value: "主要担心数据迁移的成本。" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认并生成复盘" }));
  await waitFor(() => expect(imported).toHaveBeenCalledWith("audio-review-id"));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      source: "audio",
      title: "客户沟通",
      context: "预约软件演示",
      messages: [
        { role: "user", content: "方便了解一下需求吗？" },
        { role: "npc", content: "主要担心数据迁移的成本。" },
      ],
    }),
  );
});

test.each([
  [
    "unsupported",
    () => new File(["text"], "记录.txt", { type: "text/plain" }),
    "请选择 MP3",
  ],
  [
    "empty",
    () => new File([], "空白.wav", { type: "audio/wav" }),
    "录音文件为空",
  ],
  [
    "oversized",
    () => {
      const file = new File(["audio"], "太长.mp3", { type: "audio/mpeg" });
      Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
      return file;
    },
    "录音不能超过 50 MB",
  ],
] as const)(
  "rejects %s files before making a transcription request",
  (_name, makeFile, message) => {
    render(
      <ReviewImportDialog
        source="audio"
        onClose={jest.fn()}
        onImported={jest.fn()}
      />,
    );
    selectAudio(makeFile());
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "开始转写" })).toBeDisabled();
    expect(transcribe).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  },
);

test("a failed transcription can retry the same file without saving or pretending it succeeded", async () => {
  transcribe.mockRejectedValueOnce(new Error("录音无法解码"));
  transcribe.mockResolvedValueOnce(transcript);
  render(
    <ReviewImportDialog
      source="audio"
      onClose={jest.fn()}
      onImported={jest.fn()}
    />,
  );
  const file = selectAudio();
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("录音无法解码");
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "开始转写" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  await screen.findByLabelText("第 1 条内容");
  expect(transcribe.mock.calls.map(([selected]) => selected)).toEqual([
    file,
    file,
  ]);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("cancel aborts the request and a late response cannot overwrite a newer recording", async () => {
  let resolveOld!: (value: RecordingTranscription) => void;
  transcribe.mockReturnValueOnce(
    new Promise<RecordingTranscription>((resolve) => {
      resolveOld = resolve;
    }),
  );
  transcribe.mockResolvedValueOnce({
    ...transcript,
    segments: [{ start: 0, end: 3, text: "这是新录音的内容" }],
  });
  render(
    <ReviewImportDialog
      source="audio"
      onClose={jest.fn()}
      onImported={jest.fn()}
    />,
  );
  selectAudio();
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  const oldSignal = transcribe.mock.calls[0][1] as AbortSignal;
  expect(oldSignal.aborted).toBe(false);
  expect(screen.getByRole("button", { name: "正在转写…" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "取消等待" }));
  expect(oldSignal.aborted).toBe(true);

  selectAudio(new File(["new audio"], "新录音.mp3", { type: "audio/mpeg" }));
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  expect(await screen.findByLabelText("第 1 条内容")).toHaveValue(
    "这是新录音的内容",
  );
  await act(async () => {
    resolveOld(transcript);
  });
  expect(screen.getByLabelText("第 1 条内容")).toHaveValue("这是新录音的内容");
  expect(screen.getByLabelText(/复盘标题/)).toHaveValue("新录音");
  expect(screen.queryByLabelText("第 2 条内容")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("closing during transcription aborts work and releases the local audio preview", () => {
  transcribe.mockReturnValue(new Promise(() => {}));
  const close = jest.fn();
  const { unmount } = render(
    <ReviewImportDialog
      source="audio"
      onClose={close}
      onImported={jest.fn()}
    />,
  );
  selectAudio();
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  const signal = transcribe.mock.calls[0][1] as AbortSignal;
  fireEvent.click(screen.getByRole("button", { name: "关闭录音导入窗口" }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(true);
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:recording-preview");
});

test("mixed-speaker text can be split, corrected, and revisited without another transcription", async () => {
  transcribe.mockResolvedValueOnce({
    ...transcript,
    segments: [{ start: 0, end: 5, text: "您好。可以聊聊。" }],
  });
  render(
    <ReviewImportDialog
      source="audio"
      onClose={jest.fn()}
      onImported={jest.fn()}
    />,
  );
  selectAudio();
  fireEvent.click(screen.getByRole("button", { name: "开始转写" }));
  await screen.findByLabelText("第 1 条内容");
  fireEvent.change(screen.getByLabelText("第 1 条内容"), {
    target: { value: "您好。\n可以聊聊。" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按换行拆分" }));
  expect(screen.getByLabelText("第 1 条内容")).toHaveValue("您好。");
  expect(screen.getByLabelText("第 2 条内容")).toHaveValue("可以聊聊。");
  await selectRole(1, "我（销售）");
  await selectRole(2, "客户");
  fireEvent.click(screen.getByRole("button", { name: "新增发言" }));
  expect(screen.getByLabelText("第 3 条内容")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "删除第 3 条发言" }));
  fireEvent.click(screen.getByRole("button", { name: "返回上传" }));
  fireEvent.click(screen.getByRole("button", { name: "继续核对" }));
  expect(screen.getByLabelText("第 2 条内容")).toHaveValue("可以聊聊。");
  expect(
    screen.getByRole("combobox", { name: "第 2 条角色" }),
  ).toHaveTextContent("客户");
  expect(transcribe).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});
