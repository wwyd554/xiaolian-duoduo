import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Pagination,
  Paper,
  Stack,
  Snackbar,
  Tab,
  Tabs,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiService } from "../../services/ApiService";
import type { ReviewItem, ReviewSource } from "../../types/reviews";
import ReviewImportDialog from "./ReviewImportDialog";
import ReviewRecordMenu from "./ReviewRecordMenu";

const sourceNames = { practice: "陪练", chat: "聊天", audio: "录音" };
const statusNames: Record<string, string> = {
  pending: "排队中",
  processing: "分析中",
  completed: "已完成",
  failed: "分析失败",
};

export default function SalesReviewPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const source = (
    ["practice", "chat", "audio"].includes(params.get("source") || "")
      ? params.get("source")
      : "all"
  ) as ReviewSource | "all";
  const state = (["all", "completed", "active"].includes(params.get("state") || "") ? params.get("state") : "completed") as "all" | "completed" | "active";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [importSource, setImportSource] = useState<"chat" | "audio" | null>(
    null,
  );

  useEffect(() => {
    document.title = "销售复盘 | 销练多多";
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    const load = async () => {
      try {
        const result = await ApiService.getInstance().getReviews(source, page, state);
        if (!alive) return;
        setItems(result.items);
        setTotal(result.total);
        setError("");
        if (
          result.items.some((item) =>
            ["pending", "processing"].includes(item.analysis_status || ""),
          )
        )
          timer = setTimeout(load, 4000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "记录加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [source, state, page, revision]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            销售复盘
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            从每一次练习和真实沟通中，找到下一步改进的方向。
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="contained" onClick={() => setImportSource("chat")}>
            导入聊天记录
          </Button>
          <Button variant="outlined" onClick={() => setImportSource("audio")}>
            导入录音
          </Button>
        </Stack>
      </Stack>
      <Tabs
        value={source}
        variant="scrollable"
        onChange={(_, value) => {
          setPage(1);
          setParams({ source: value, state });
        }}
        sx={{ mb: 3 }}
      >
        <Tab value="all" label="全部" />
        <Tab value="practice" label="陪练" />
        <Tab value="chat" label="聊天" />
        <Tab value="audio" label="录音" />
      </Tabs>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, gap: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup size="small" exclusive value={state} aria-label="复盘状态" onChange={(_, value) => { if (value) { setPage(1); setParams({ source, state: value }); } }}>
          <ToggleButton value="completed">已结束的练习与沟通</ToggleButton>
          <ToggleButton value="active">进行中的练习</ToggleButton>
          <ToggleButton value="all">全部记录</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">共 {total} 条记录</Typography>
      </Stack>
      {source === "audio" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          上传录音后可在本地转成文字，核对发言人与内容后生成复盘。
        </Alert>
      )}
      {error ? (
        <Alert
          severity="error"
          action={
            <Button onClick={() => setRevision((v) => v + 1)}>重试</Button>
          }
        >
          {error}
        </Alert>
      ) : loading ? (
        <CircularProgress aria-label="正在加载复盘记录" />
      ) : items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">
            当前筛选下暂无记录
          </Typography>
          <Typography color="text.secondary" sx={{ my: 2 }}>
            可以切换到全部记录，或完成一次陪练、导入销售沟通记录。
          </Typography>
          <Button onClick={() => navigate("/scenarios")}>开始练习</Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {items.map((item) => (
            <Paper
              key={item.id}
              variant="outlined"
              sx={{ p: 2.5, borderRadius: 3 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={sourceNames[item.source]} />
                    <Typography variant="h6">{item.scenario_title || item.title}</Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {new Date(item.created_at).toLocaleString()} ·{" "}
                    {item.status !== "completed"
                      ? "练习未结束"
                      : statusNames[item.analysis_status || ""] || "待生成"}
                  </Typography>
                  {item.overall_score != null && <Chip size="small" sx={{ mt: 1.5 }} label={`综合评分 ${item.overall_score} / 100`} />}
                  {item.key_finding && <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.8, maxWidth: 700 }}>本次发现：{item.key_finding}</Typography>}
                </Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
                  {item.status !== "completed" && (
                    <Button
                      onClick={async () => {
                        try {
                          await ApiService.getInstance().completeSession(
                            item.id,
                          );
                          setRevision((v) => v + 1);
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "结束练习失败",
                          );
                        }
                      }}
                    >
                      结束并复盘
                    </Button>
                  )}
                  {item.status === "completed" && <Button
                    variant="outlined"
                    onClick={() =>
                      navigate(
                        item.source === "practice"
                          ? `/history/session/${item.id}`
                          : `/history/import/${item.id}`,
                      )
                    }
                  >
                    查看复盘
                  </Button>}
                  {item.source === "practice" && (
                    <Button
                      onClick={() =>
                        navigate(`/conversation/${item.scenario_id}`)
                      }
                    >
                      {item.status === "completed" ? "再练一次" : "重新开始"}
                    </Button>
                  )}
                  <ReviewRecordMenu
                    item={item}
                    onDeleted={(id) => {
                      setItems((current) => current.filter((record) => record.id !== id));
                      setTotal((current) => Math.max(0, current - 1));
                      setDeletedNotice(true);
                      if (items.length === 1 && page > 1) setPage((current) => current - 1);
                      else setRevision((current) => current + 1);
                    }}
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      {!error && !loading && total > 12 && (
        <Pagination
          sx={{ mt: 3 }}
          count={Math.ceil(total / 12)}
          page={page}
          onChange={(_, v) => setPage(v)}
        />
      )}
      <Snackbar open={deletedNotice} autoHideDuration={3500} onClose={() => setDeletedNotice(false)}>
        <Alert severity="success" onClose={() => setDeletedNotice(false)}>已删除这条复盘</Alert>
      </Snackbar>
      {importSource && (
        <ReviewImportDialog
          source={importSource}
          onClose={() => setImportSource(null)}
          onImported={(id) => navigate(`/history/import/${id}`)}
        />
      )}
    </Container>
  );
}
