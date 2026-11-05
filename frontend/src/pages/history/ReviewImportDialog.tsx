import { useRef, useState } from "react";
import {
  Alert,
  Box,
  IconButton,
  CircularProgress,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ChatBubbleOutlineRounded,
  CloseRounded,
  UploadFileRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";
import { ApiService } from "../../services/ApiService";
import type { ReviewMessage } from "../../types/reviews";
import AudioReviewImportDialog from "./AudioReviewImportDialog";

function parseTranscript(raw: string): ReviewMessage[] {
  const messages: ReviewMessage[] = [];
  for (const line of raw.split(/\r?\n/).filter((line) => line.trim())) {
    const match = line.match(/^\s*(我|销售|客户)\s*[:：]\s*(.*)$/);
    if (!match)
      throw new Error(
        "每条消息请以“我：”或“客户：”开头，换行内容请合并到同一条。",
      );
    if (!match[2].trim()) throw new Error("消息内容不能为空。");
    messages.push({
      role: match[1] === "客户" ? "npc" : "user",
      content: match[2].trim(),
    });
  }
  if (messages.length < 2 || messages.length > 200)
    throw new Error("请导入 2–200 条消息。");
  return messages;
}

function TextReviewImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [raw, setRaw] = useState("");
  const [messages, setMessages] = useState<ReviewMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const submit = async () => {
    if (!messages) return;
    if (!title.trim() || !context.trim()) {
      setError("请填写复盘标题和沟通背景。");
      return;
    }
    if (
      messages.some((m) => !m.content.trim()) ||
      new Set(messages.map((m) => m.role)).size !== 2
    ) {
      setError("请确认包含销售和客户双方发言，且消息内容不为空。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await ApiService.getInstance().importReview({
        id: requestId.current,
        source: "chat",
        title,
        context,
        messages,
      });
      onImported(result.sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  const preview = () => {
    try {
      const parsed = parseTranscript(raw);
      if (new Set(parsed.map((m) => m.role)).size !== 2)
        throw new Error("请包含销售和客户双方的发言。");
      if (parsed.some((m) => m.content.length > 4000))
        throw new Error("单条消息最多 4000 字，请拆分后导入。");
      setMessages(parsed);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "内容解析失败");
    }
  };
  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      onClose={busy ? undefined : onClose}
      aria-labelledby="review-import-title"
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
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2.5,
                  bgcolor: "#edf0ff",
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <ChatBubbleOutlineRounded />
              </Box>
              <DialogTitle
                id="review-import-title"
                sx={{ p: 0, fontSize: 22, fontWeight: 750 }}
              >
                从一段对话，找到改进方向
              </DialogTitle>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              识别客户顾虑，回看关键表达，明确下一步怎么聊。
            </Typography>
          </Box>
          <IconButton
            aria-label="关闭导入窗口"
            disabled={busy}
            onClick={onClose}
            size="small"
          >
            <CloseRounded />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2.5 }}>
          {["导入对话", "确认并复盘"].map((label, i) => (
            <Stack
              key={label}
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                color:
                  Boolean(messages) === Boolean(i)
                    ? "primary.main"
                    : "text.secondary",
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  bgcolor:
                    Boolean(messages) === Boolean(i)
                      ? "primary.main"
                      : "action.hover",
                  color:
                    Boolean(messages) === Boolean(i)
                      ? "white"
                      : "text.secondary",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                }}
              >
                {i + 1}
              </Box>
              <Typography variant="body2" fontWeight={600}>
                {label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      <DialogContent sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: "#fcfcfd" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!messages ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 245px" },
              gap: 3,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <Typography
                  component="label"
                  htmlFor="review-transcript"
                  fontWeight={700}
                >
                  粘贴聊天记录
                </Typography>
                <Button
                  component="label"
                  size="small"
                  startIcon={<UploadFileRounded />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  导入 TXT
                  <input
                    hidden
                    type="file"
                    accept=".txt,text/plain"
                    aria-label="选择 TXT 文件"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        if (file.size > 120000)
                          throw new Error("文件过大，请拆分后导入。");
                        const text = await file.text();
                        if (text.length > 30000)
                          throw new Error("一次最多导入 30000 字。");
                        setRaw(text);
                        setError("");
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "文件读取失败",
                        );
                      }
                    }}
                  />
                </Button>
              </Stack>
              <TextField
                id="review-transcript"
                fullWidth
                multiline
                minRows={9}
                maxRows={14}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={
                  "我：目前团队用什么工具？\n客户：我们用表格，暂时不想换。\n我：主要担心哪方面的成本？"
                }
                inputProps={{
                  maxLength: 30000,
                  "aria-label": "聊天或转写文字",
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "white",
                    borderRadius: 3,
                    alignItems: "flex-start",
                    fontSize: 14,
                    lineHeight: 1.9,
                  },
                  "& textarea::placeholder": { opacity: 1, color: "#9096a3" },
                }}
              />
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ mt: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  每条发言一行 · 2–200 条
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {raw.length.toLocaleString()} / 30,000 字
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 2 }}
              >
                支持粘贴文字或 TXT 文件，暂不支持截图识别。
              </Typography>
            </Box>
            <Box
              sx={{
                p: 2.5,
                bgcolor: "#f0f2f9",
                borderRadius: 3,
                alignSelf: "start",
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                像这样整理，就可以开始
              </Typography>
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "white",
                    borderRadius: "12px 12px 12px 3px",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    客户
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    换系统太麻烦了。
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "#e0e6ff",
                    borderRadius: "12px 12px 3px 12px",
                    ml: 2,
                  }}
                >
                  <Typography variant="caption" color="primary.main">
                    我（销售）
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    您更担心数据迁移，还是团队重新学习？
                  </Typography>
                </Box>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2, lineHeight: 1.8 }}
              >
                每行以“我：”或“客户：”开头。下一步可以调整角色和内容。
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  mt: 2,
                  pt: 2,
                  borderTop: "1px solid #dfe3ed",
                  lineHeight: 1.7,
                }}
              >
                导入前，建议用化名替换姓名、电话等个人信息。
              </Typography>
            </Box>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                补充一点背景，让反馈更有针对性
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="复盘标题"
                  size="small"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：客户担心迁移成本"
                  inputProps={{ maxLength: 120 }}
                  required
                  disabled={busy}
                />
                <TextField
                  label="沟通背景与目标"
                  placeholder="你销售什么？这次沟通想达成什么？"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  multiline
                  minRows={2}
                  maxRows={4}
                  inputProps={{ maxLength: 3000 }}
                  required
                  disabled={busy}
                />
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2">
                已识别 {messages.length} 条发言
              </Typography>
              <Typography variant="caption" color="text.secondary">
                核对角色、顺序与内容。点击确认后才会保存并生成报告。
              </Typography>
            </Box>
            {messages.map((m, i) => (
              <Box
                key={i}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  bgcolor: m.role === "user" ? "#f3f5ff" : "white",
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flex: 1 }}
                  >
                    第 {i + 1} 条
                  </Typography>
                  <TextField
                    select
                    size="small"
                    label={`第 ${i + 1} 条角色`}
                    value={m.role}
                    disabled={busy}
                    sx={{ width: 130 }}
                    onChange={(e) =>
                      setMessages(
                        messages.map((v, j) =>
                          i === j
                            ? {
                                ...v,
                                role: e.target.value as ReviewMessage["role"],
                              }
                            : v,
                        ),
                      )
                    }
                  >
                    <MenuItem value="user">我（销售）</MenuItem>
                    <MenuItem value="npc">客户</MenuItem>
                  </TextField>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  variant="standard"
                  label={`第 ${i + 1} 条内容`}
                  value={m.content}
                  disabled={busy}
                  inputProps={{ maxLength: 4000 }}
                  onChange={(e) =>
                    setMessages(
                      messages.map((v, j) =>
                        i === j ? { ...v, content: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Box>
            ))}
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
          bgcolor: "white",
        }}
      >
        <Button
          disabled={busy}
          color="inherit"
          onClick={
            messages
              ? () => {
                  setRaw(
                    messages
                      .map(
                        (m) =>
                          `${m.role === "user" ? "我" : "客户"}：${m.content.replace(/\r?\n/g, " ")}`,
                      )
                      .join("\n"),
                  );
                  setMessages(null);
                  setError("");
                }
              : onClose
          }
        >
          {messages ? "返回编辑" : "取消"}
        </Button>
        <Button
          variant="contained"
          disabled={busy || (!messages && !raw.trim())}
          onClick={messages ? submit : preview}
          endIcon={
            busy ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <ArrowForwardRounded />
            )
          }
          sx={{ borderRadius: 2.5, px: 2.5, boxShadow: "none" }}
        >
          {busy ? "正在保存…" : messages ? "确认并生成复盘" : "预览并确认"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ReviewImportDialog(props: {
  source: "chat" | "audio";
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  return props.source === "audio" ? (
    <AudioReviewImportDialog
      onClose={props.onClose}
      onImported={props.onImported}
    />
  ) : (
    <TextReviewImportDialog
      onClose={props.onClose}
      onImported={props.onImported}
    />
  );
}
