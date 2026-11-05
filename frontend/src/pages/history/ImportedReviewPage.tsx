import BusinessReviewPanel from "../../components/review/BusinessReviewPanel";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { ApiService } from "../../services/ApiService";
import type { ImportedReviewDetail } from "../../types/reviews";

export default function ImportedReviewPage() {
  const { sessionId = "" } = useParams();
  const [data, setData] = useState<ImportedReviewDetail | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result =
          await ApiService.getInstance().getImportedReview(sessionId);
        if (!alive) return;
        setData(result);
        setError("");
        if (["pending", "processing"].includes(result.status))
          timer = setTimeout(load, 3000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sessionId, revision]);
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button component={Link} to="/history" sx={{ mb: 2 }}>
        ← 返回销售复盘
      </Button>
      {error && (
        <Alert
          severity="error"
          action={
            <Button onClick={() => setRevision((v) => v + 1)}>重试</Button>
          }
        >
          {error}
        </Alert>
      )}
      {!data && !error && <CircularProgress />}
      {data && (
        <Stack spacing={3}>
          <Box>
            <Chip
              size="small"
              label={data.source === "chat" ? "聊天复盘" : "录音复盘"}
            />
            <Typography variant="h4" component="h1" sx={{ my: 1 }}>
              {data.title}
            </Typography>
            <Typography color="text.secondary">{data.context}</Typography>
          </Box>
          {["pending", "processing"].includes(data.status) && (
            <Alert severity="info">
              记录已保存，正在生成复盘。你可以离开此页，稍后从销售复盘中查看。
            </Alert>
          )}
          {data.status === "failed" && (
            <Alert
              severity="error"
              action={
                <Button
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    try {
                      await ApiService.getInstance().retrySessionAnalysis(
                        sessionId,
                      );
                      setRevision((v) => v + 1);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "重试失败");
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  重新分析
                </Button>
              }
            >
              本次分析未完成，原始记录已保留。
            </Alert>
          )}
          {data.report?.businessReview && <BusinessReviewPanel review={data.report.businessReview} onEvidence={(messageId) => document.getElementById(`import-message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />}
          {data.report && !data.report.businessReview && (
            <>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6">沟通总结</Typography>
                <Typography sx={{ my: 1 }}>{data.report.summary}</Typography>
                <Typography color="text.secondary">
                  {data.report.stage}
                </Typography>
              </Paper>
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  有依据的发现
                </Typography>
                <Stack spacing={2}>
                  {data.report.findings.map((f, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 2.5 }}>
                      <Chip size="small" label={f.kind} />
                      <Typography sx={{ my: 1 }}>{f.analysis}</Typography>
                      {f.evidence.map((index) => (
                        <Typography
                          key={index}
                          component="blockquote"
                          sx={{
                            m: 0,
                            mt: 1,
                            pl: 2,
                            borderLeft: "3px solid",
                            borderColor: "primary.light",
                            color: "text.secondary",
                          }}
                        >
                          #{index}{" "}
                          {data.messages[index - 1]?.role === "user"
                            ? "我"
                            : "客户"}
                          ：{data.messages[index - 1]?.content}
                        </Typography>
                      ))}
                    </Paper>
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  下一句可以怎么说
                </Typography>
                <Stack spacing={2}>
                  {data.report.replies.map((r, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 2.5 }}>
                      <Typography>{r.text}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        适用情况：{r.when}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
              <Alert severity="info">{data.report.limitations}</Alert>
            </>
          )}
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              原始沟通记录 · {data.messages.length} 条
            </Typography>
            <Stack spacing={1}>
              {data.messages.map((m, i) => (
                <Paper
                  key={m.id || m.messageId || i}
                  id={`import-message-${m.id || m.messageId || i + 1}`}
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor:
                      m.role === "user"
                        ? "rgba(43,89,209,.04)"
                        : "background.paper",
                  }}
                >
                  <Typography variant="caption">
                    #{i + 1} · {m.role === "user" ? "我（销售）" : "客户"}
                  </Typography>
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}
    </Container>
  );
}
