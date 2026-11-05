import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  ArrowForwardRounded,
  AudioFileRounded,
  CloseRounded,
  DeleteOutlineRounded,
  FileUploadOutlined,
  PlayArrowRounded,
} from "@mui/icons-material";
import { ApiService } from "../../services/ApiService";
import type { ReviewMessage } from "../../types/reviews";
import { designTokens as d } from "../../theme/designTokens";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i;
const AUDIO_ACCEPT = ".mp3,.wav,.m4a,.aac,.ogg,.flac,.webm";

type DraftMessage = {
  id: string;
  role: ReviewMessage["role"] | "";
  content: string;
  start?: number;
  end?: number;
};

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

export default function AudioReviewImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const saveLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const unconfirmed = messages.filter((message) => !message.role).length;
  const totalCharacters = messages.reduce(
    (count, message) => count + message.content.length,
    0,
  );

  useEffect(() => {
    if (!file) {
      setAudioUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(
    () => () => {
      generation.current += 1;
      activeRequest.current?.abort();
    },
    [],
  );

  const showError = (message: string) => {
    setError(message);
    contentRef.current?.scrollTo?.({ top: 0 });
  };

  const cancelTranscription = () => {
    generation.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setTranscribing(false);
  };

  const close = () => {
    if (saveLock.current) return;
    cancelTranscription();
    onClose();
  };

  const selectFile = (selected?: File) => {
    if (!selected || activeRequest.current || saveLock.current) return;
    if (!AUDIO_EXTENSIONS.test(selected.name)) {
      showError("请选择 MP3、WAV、M4A、AAC、OGG、FLAC 或 WebM 录音文件。");
      return;
    }
    if (selected.size === 0 || selected.size > MAX_AUDIO_BYTES) {
      showError(
        selected.size === 0
          ? "录音文件为空，请重新选择。"
          : "录音不能超过 50 MB，请分段后上传。",
      );
      return;
    }
    generation.current += 1;
    setFile(selected);
    setMessages([]);
    setDuration(0);
    setTitle(selected.name.replace(/\.[^.]+$/, "").slice(0, 120));
    setStep("upload");
    setError("");
    requestId.current = crypto.randomUUID();
  };

  const transcribe = async () => {
    if (!file || activeRequest.current) return;
    if (messages.length) {
      setStep("review");
      setError("");
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    const current = ++generation.current;
    setTranscribing(true);
    setError("");
    try {
      const result = await ApiService.getInstance().transcribeRecording(
        file,
        controller.signal,
      );
      if (controller.signal.aborted || current !== generation.current) return;
      const segments = result.segments.filter((segment) => segment.text.trim());
      if (!segments.length)
        throw new Error("没有识别到清晰的人声，请检查录音后重试。");
      if (
        segments.length > 200 ||
        segments.reduce(
          (length, segment) => length + segment.text.trim().length,
          0,
        ) > 30000
      ) {
        throw new Error("转写内容超过单次复盘限制，请将录音分段后上传。");
      }
      setMessages(
        segments.map((segment) => ({
          id: crypto.randomUUID(),
          role: "",
          content: segment.text.trim(),
          start: segment.start,
          end: segment.end,
        })),
      );
      setDuration(result.durationSeconds);
      setStep("review");
      contentRef.current?.scrollTo?.({ top: 0 });
    } catch (e) {
      if (controller.signal.aborted || current !== generation.current) return;
      showError(e instanceof Error ? e.message : "转写失败，请重试。");
    } finally {
      if (current === generation.current) {
        activeRequest.current = null;
        setTranscribing(false);
      }
    }
  };

  const submit = async () => {
    if (saveLock.current) return;
    if (!title.trim() || !context.trim()) {
      showError("请填写复盘标题和沟通背景。");
      return;
    }
    if (messages.length < 2 || messages.length > 200) {
      showError("请整理为 2–200 条发言。");
      return;
    }
    if (unconfirmed) {
      showError("请为每条发言选择“我（销售）”或“客户”，再生成复盘。");
      return;
    }
    if (new Set(messages.map((message) => message.role)).size !== 2) {
      showError("请确认包含销售和客户双方的发言。");
      return;
    }
    if (
      messages.some(
        (message) => !message.content.trim() || message.content.length > 4000,
      ) ||
      totalCharacters > 30000
    ) {
      showError("发言不能为空，单条最多 4000 字，总计最多 30000 字。");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await ApiService.getInstance().importReview({
        id: requestId.current,
        source: "audio",
        title: title.trim(),
        context: context.trim(),
        messages: messages.map((message) => ({
          role: message.role as ReviewMessage["role"],
          content: message.content.trim(),
        })),
      });
      onImported(result.sessionId);
    } catch (e) {
      showError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const changeMessage = (id: string, patch: Partial<DraftMessage>) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    );
  };

  const splitMessage = (id: string) => {
    const message = messages.find((item) => item.id === id);
    if (!message) return;
    const lines = message.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      showError("请先在不同发言之间换行，再点击“按换行拆分”。");
      return;
    }
    if (messages.length + lines.length - 1 > 200) {
      showError("一次最多保留 200 条发言。");
      return;
    }
    setMessages((current) =>
      current.flatMap((item) =>
        item.id === id
          ? lines.map((content, index) => ({
              id: crypto.randomUUID(),
              role: "" as const,
              content,
              ...(index === 0 ? { start: item.start, end: item.end } : {}),
            }))
          : [item],
      ),
    );
    setError("");
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      onClose={saving ? undefined : close}
      aria-labelledby="audio-review-title"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            m: { xs: 1.5, sm: 3 },
            width: { xs: "calc(100% - 24px)", sm: "100%" },
            maxHeight: "calc(100dvh - 32px)",
            boxShadow: "0 28px 100px rgba(20,30,55,.2)",
          },
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 2.5, sm: 4 },
          pt: 3,
          pb: 2.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  borderRadius: 2.5,
                  bgcolor: d.colors.primarySoft,
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <AudioFileRounded />
              </Box>
              <DialogTitle
                id="audio-review-title"
                sx={{
                  p: 0,
                  minWidth: 0,
                  flexShrink: 1,
                  fontSize: { xs: 20, sm: 23 },
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                把一段录音，变成沟通复盘
              </DialogTitle>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              上传录音，用本地模型转成文字，核对后生成复盘。
            </Typography>
          </Box>
          <IconButton
            aria-label="关闭录音导入窗口"
            onClick={close}
            disabled={saving}
          >
            <CloseRounded />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={2.5} sx={{ mt: 2.5 }}>
          {["上传并转写", "核对并复盘"].map((label, index) => {
            const active = (step === "upload" ? 0 : 1) === index;
            return (
              <Stack
                key={label}
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{ color: active ? "primary.main" : "text.secondary" }}
              >
                <Box
                  sx={{
                    width: 23,
                    height: 23,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: active ? "primary.main" : "action.hover",
                    color: active ? "white" : "text.secondary",
                    fontSize: 12,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {label}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      </Box>
      <DialogContent
        ref={contentRef}
        sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: d.colors.canvas }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <input
          ref={inputRef}
          hidden
          type="file"
          accept={AUDIO_ACCEPT}
          aria-label="选择录音文件"
          disabled={transcribing || saving}
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {step === "upload" ? (
          <Stack spacing={2.5}>
            {!file ? (
              <Paper
                variant="outlined"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (event.dataTransfer.files.length !== 1) {
                    showError("一次请选择一个录音文件。");
                    return;
                  }
                  selectFile(event.dataTransfer.files[0]);
                }}
                sx={{
                  px: 3,
                  py: { xs: 4, sm: 5 },
                  textAlign: "center",
                  borderStyle: "dashed",
                  borderWidth: 1.5,
                  borderRadius: 3,
                  borderColor: dragging
                    ? "primary.main"
                    : d.colors.controlBorder,
                  bgcolor: dragging ? d.colors.primarySoft : "white",
                }}
              >
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 3,
                    mx: "auto",
                    mb: 2,
                    bgcolor: d.colors.primarySoft,
                    color: "primary.main",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <FileUploadOutlined sx={{ fontSize: 30 }} />
                </Box>
                <Typography fontSize={18} fontWeight={650}>
                  将录音拖到这里
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1, mb: 2.5 }}
                >
                  支持 MP3、WAV、M4A、AAC、OGG、FLAC、WebM
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => inputRef.current?.click()}
                  sx={{ px: 3 }}
                >
                  选择录音文件
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1.5 }}
                >
                  单个文件不超过 50 MB，时长不超过 15 分钟
                </Typography>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <AudioFileRounded color="primary" sx={{ fontSize: 32 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      fontWeight={600}
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                      {messages.length
                        ? ` · 已转写 ${messages.length} 段`
                        : " · 已准备好"}
                    </Typography>
                  </Box>
                  <Button
                    disabled={transcribing}
                    size="small"
                    onClick={() => inputRef.current?.click()}
                    sx={{ flexShrink: 0 }}
                  >
                    更换录音
                  </Button>
                </Stack>
                {audioUrl && (
                  <Box
                    component="audio"
                    aria-label="录音试听"
                    controls
                    preload="metadata"
                    src={audioUrl}
                    sx={{ width: "100%", mt: 2 }}
                  />
                )}
              </Paper>
            )}
            {transcribing ? (
              <Box
                role="status"
                aria-live="polite"
                sx={{ p: 2.5, bgcolor: d.colors.primarySoft, borderRadius: 3 }}
              >
                <Typography fontWeight={600} color="primary.main">
                  正在上传并进行本地转写…
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75, mb: 2 }}
                >
                  模型加载和较长录音需要一些时间，转写完成后会进入核对页面。
                </Typography>
                <LinearProgress aria-label="正在转写录音" />
              </Box>
            ) : (
              <Stack spacing={1} sx={{ px: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  转写使用本地语音模型，不经过云端转写服务。
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  下一步可边听边修改文字，并确认哪些话来自销售、哪些来自客户。
                </Typography>
              </Stack>
            )}
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                {file?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                已完成本地转写 · {clock(duration)}
              </Typography>
              {audioUrl && (
                <Box
                  component="audio"
                  ref={audioRef}
                  aria-label="核对录音"
                  controls
                  preload="metadata"
                  src={audioUrl}
                  sx={{ width: "100%", mt: 1.5 }}
                />
              )}
            </Paper>
            <Stack spacing={2}>
              <TextField
                label="复盘标题"
                size="small"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                inputProps={{ maxLength: 120 }}
                required
                disabled={saving}
              />
              <TextField
                label="沟通背景与目标"
                placeholder="你销售什么？这次沟通想达成什么？"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                multiline
                minRows={2}
                maxRows={4}
                inputProps={{ maxLength: 3000 }}
                required
                disabled={saving}
              />
            </Stack>
            <Box>
              <Typography fontWeight={600}>
                核对 {messages.length} 条发言
                {unconfirmed > 0 ? ` · ${unconfirmed} 条待确认发言人` : ""}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                自动转写未区分发言人，请为每条选择销售或客户。若一段包含双方对话，可换行后拆分。
              </Typography>
            </Box>
            {messages.map((message, index) => (
              <Paper
                key={message.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor:
                    message.role === "user" ? d.colors.primarySoft : "white",
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1.5, flexWrap: "wrap", rowGap: 1.5 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    第 {index + 1} 条
                  </Typography>
                  {message.start != null && (
                    <Button
                      size="small"
                      disabled={saving}
                      startIcon={<PlayArrowRounded />}
                      aria-label={`播放第 ${index + 1} 段录音`}
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = message.start ?? 0;
                          void audioRef.current.play().catch(() => {});
                        }
                      }}
                    >
                      {clock(message.start)}
                      {message.end != null ? `–${clock(message.end)}` : ""}
                    </Button>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <TextField
                    select
                    size="small"
                    label={`第 ${index + 1} 条角色`}
                    value={message.role}
                    disabled={saving}
                    sx={{ width: 145 }}
                    SelectProps={{ displayEmpty: true }}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) =>
                      changeMessage(message.id, {
                        role: event.target.value as DraftMessage["role"],
                      })
                    }
                  >
                    <MenuItem value="">选择发言人</MenuItem>
                    <MenuItem value="user">我（销售）</MenuItem>
                    <MenuItem value="npc">客户</MenuItem>
                  </TextField>
                  <IconButton
                    aria-label={`删除第 ${index + 1} 条发言`}
                    disabled={saving}
                    onClick={() =>
                      setMessages((current) =>
                        current.filter((item) => item.id !== message.id),
                      )
                    }
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  label={`第 ${index + 1} 条内容`}
                  value={message.content}
                  disabled={saving}
                  inputProps={{ maxLength: 4000 }}
                  onChange={(event) =>
                    changeMessage(message.id, { content: event.target.value })
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "white",
                      fontSize: 14,
                      lineHeight: 1.8,
                    },
                  }}
                />
                {message.content.includes("\n") && (
                  <Button
                    size="small"
                    disabled={saving}
                    onClick={() => splitMessage(message.id)}
                    sx={{ mt: 1 }}
                  >
                    按换行拆分
                  </Button>
                )}
              </Paper>
            ))}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
            >
              <Button
                disabled={saving || messages.length >= 200}
                startIcon={<AddRounded />}
                onClick={() =>
                  setMessages((current) => [
                    ...current,
                    { id: crypto.randomUUID(), role: "", content: "" },
                  ])
                }
              >
                新增发言
              </Button>
              <Typography
                variant="caption"
                color={
                  totalCharacters > 30000 ? "error.main" : "text.secondary"
                }
              >
                {totalCharacters.toLocaleString()} / 30,000 字
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              确认后才会保存文字并生成复盘，原始录音不会作为复盘附件保存。
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 4 },
          py: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Button
          disabled={saving}
          color="inherit"
          onClick={
            transcribing
              ? cancelTranscription
              : step === "review"
                ? () => {
                    setStep("upload");
                    setError("");
                  }
                : close
          }
        >
          {transcribing ? "取消等待" : step === "review" ? "返回上传" : "取消"}
        </Button>
        <Button
          variant="contained"
          disabled={saving || transcribing || (step === "upload" && !file)}
          onClick={step === "review" ? submit : transcribe}
          endIcon={
            saving || transcribing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <ArrowForwardRounded />
            )
          }
          sx={{ px: 2.5, boxShadow: "none" }}
        >
          {saving
            ? "正在保存…"
            : transcribing
              ? "正在转写…"
              : step === "review"
                ? "确认并生成复盘"
                : messages.length
                  ? "继续核对"
                  : "开始转写"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
