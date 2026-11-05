import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { ApiService } from "../../services/ApiService";
import type { ScenarioInfo, DifficultyLevel } from "../../types/api";

export function normalizeScenarioDraft(raw: Record<string, unknown>): Partial<ScenarioInfo> {
  const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const npc = raw.npc && typeof raw.npc === "object" ? raw.npc as Record<string, unknown> : {};
  const goals = Array.isArray(raw.goals) ? raw.goals.filter((g) => g && typeof g === "object" && text(g.description)).map((g, i) => ({
    id: `goal-${i + 1}`, description: text(g.description), isRequired: g.isRequired !== false,
    priority: typeof g.priority === "number" ? Math.max(1, Math.min(5, g.priority)) : 3,
    criteria: Array.isArray(g.criteria) ? g.criteria.filter((c: unknown) => typeof c === "string" && c.trim()) : [],
  })) : [];
  if (!text(raw.title) || !text(raw.description) || !text(raw.initialMessage) || !text(npc.name) || !text(npc.role) || !goals.length) {
    throw new Error("这次生成的场景不完整，请重新生成。");
  }
  const difficulties: Record<string, DifficultyLevel> = { 初级: "easy", 中级: "normal", 高级: "hard", 专家级: "expert", easy: "easy", normal: "normal", hard: "hard", expert: "expert" };
  const metrics = raw.initialMetrics && typeof raw.initialMetrics === "object" ? raw.initialMetrics as Record<string, unknown> : {};
  const metric = (key: string) => typeof metrics[key] === "number" && Number.isFinite(metrics[key]) ? Math.max(0, Math.min(10, metrics[key] as number)) : 1;
  return {
    title: text(raw.title), description: text(raw.description), category: text(raw.category) || "通用",
    difficulty: difficulties[text(raw.difficulty)] || "normal", language: ["zh", "en", "ja"].includes(text(raw.language)) ? text(raw.language) : "zh",
    initialMessage: text(raw.initialMessage), visibility: "private", goals,
    npc: { name: text(npc.name), role: text(npc.role), company: text(npc.company), description: text(npc.description), personality: Array.isArray(npc.personality) ? npc.personality.filter((v): v is string => typeof v === "string") : [] },
    initialMetrics: { angerLevel: metric("angerLevel"), trustLevel: metric("trustLevel"), progressLevel: metric("progressLevel") },
    maxTurns: typeof raw.maxTurns === "number" && Number.isFinite(raw.maxTurns) ? Math.max(3, Math.min(30, Math.round(raw.maxTurns))) : 10,
    objectives: Array.isArray(raw.objectives) ? raw.objectives.filter((v): v is string => typeof v === "string") : text(raw.objectives) ? [text(raw.objectives)] : [],
  };
}

export default function ScenarioGeneratePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPrompt = typeof location.state?.prompt === "string" ? location.state.prompt : "";
  const [prompt, setPrompt] = useState(initialPrompt);
  const [draft, setDraft] = useState<Partial<ScenarioInfo> | null>(null);
  const [loading, setLoading] = useState(Boolean(initialPrompt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const request = useRef<Promise<Partial<ScenarioInfo>> | null>(null);
  const requestPrompt = useRef(initialPrompt);
  const saveLock = useRef(false);
  const scenarioId = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!requestPrompt.current.trim()) return;
    let active = true;
    // Reuse the same request during React StrictMode effect replays.
    if (!request.current) request.current = ApiService.getInstance().generateScenario({ material: requestPrompt.current }).then((result) => normalizeScenarioDraft(result.draft));
    request.current.then((value) => { if (active) setDraft(value); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "生成失败，请重试"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const generate = () => {
    if (!prompt.trim() || loading || saving) return;
    requestPrompt.current = prompt.trim(); request.current = null;
    setDraft(null); setError(""); setLoading(true); setRevision((value) => value + 1);
  };
  const confirm = async () => {
    if (!draft || saveLock.current) return;
    if (!draft.title?.trim() || !draft.description?.trim() || !draft.initialMessage?.trim()) { setError("请填写场景名称、背景和客户开场白。"); return; }
    saveLock.current = true; setSaving(true); setError("");
    try {
      const result = await ApiService.getInstance().createScenario({ ...draft, scenarioId: scenarioId.current, visibility: "private" });
      navigate(`/conversation/${result.scenarioId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试。如果场景已保存，可从场景列表进入。"); }
    finally { saveLock.current = false; setSaving(false); }
  };

  return <Box sx={{ minHeight: "100dvh", background: "linear-gradient(145deg,#f9faff,#edf2ff 65%,#f5f0fa)", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="md">
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/")} sx={{ mb: 2 }}>返回首页</Button>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 750, mb: 1 }}>为你定制这一次陪练</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>AI 根据你的描述设计客户与练习目标。确认后保存为你的私有场景，再进入练习。</Typography>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, mb: 3 }}>
        <TextField label="你想练习什么" fullWidth multiline minRows={2} maxRows={5} value={prompt} disabled={loading || saving} onChange={(e) => setPrompt(e.target.value)} inputProps={{ maxLength: 2000 }} />
        {!loading && <Button sx={{ mt: 2 }} onClick={generate} disabled={saving || !prompt.trim()} startIcon={<AutoAwesomeRounded />}>{draft ? "按描述重新生成" : "生成场景"}</Button>}
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <Paper role="status" sx={{ p: 6, textAlign: "center", borderRadius: 4 }}><CircularProgress size={32} /><Typography variant="h6" sx={{ mt: 2 }}>正在设计你的陪练场景</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>准备客户角色、沟通背景和训练目标，请稍候…</Typography></Paper>}
      {draft && !loading && <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}><Chip size="small" label="AI 场景草稿" color="primary" /><Chip size="small" label="仅自己可见" /></Stack>
        <Stack spacing={2.5}>
          <TextField label="场景名称" value={draft.title} disabled={saving} onChange={(e) => setDraft({ ...draft, title: e.target.value })} inputProps={{ maxLength: 120 }} />
          <TextField label="沟通背景" multiline minRows={2} value={draft.description} disabled={saving} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <Box sx={{ p: 2.5, bgcolor: "#f4f6fd", borderRadius: 3 }}><Typography variant="subtitle2" color="text.secondary" gutterBottom>你的模拟客户</Typography><Typography fontWeight={700}>{draft.npc?.name} · {draft.npc?.role}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{draft.npc?.company} · {draft.npc?.personality?.join("、")}</Typography><Typography sx={{ mt: 1, lineHeight: 1.8 }}>{draft.npc?.description}</Typography></Box>
          <Box><Typography variant="h6" sx={{ mb: 1.5 }}>这次练什么</Typography>{draft.goals?.map((goal, index) => <Box key={goal.id} sx={{ mb: 2 }}><Typography fontWeight={600}>{index + 1}. {goal.description}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>{goal.criteria.join("；")}</Typography></Box>)}</Box>
          <TextField label="客户开场白" multiline minRows={2} value={draft.initialMessage} disabled={saving} onChange={(e) => setDraft({ ...draft, initialMessage: e.target.value })} />
          <Button variant="contained" size="large" onClick={confirm} disabled={saving} sx={{ alignSelf: { xs: "stretch", sm: "flex-end" }, borderRadius: 3 }}>{saving ? "正在保存…" : "确认场景，进入练习"}</Button>
        </Stack>
      </Paper>}
    </Container>
  </Box>;
}
