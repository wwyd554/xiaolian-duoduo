import { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Container, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import { Link, useSearchParams } from "react-router-dom";
import BusinessReviewPanel from "../components/review/BusinessReviewPanel";
import demoJson from "../data/productDemo.json";
import type { ProductDemo, ProductDemoExample } from "../types/productDemo";
import { designTokens as d } from "../theme/designTokens";

const defaultDemo = demoJson as ProductDemo;
const steps = [{ id: "context", label: "了解情境" }, { id: "review", label: "看对话与复盘" }, { id: "practice", label: "带着目标再练" }];
const card = { p: { xs: 2.5, md: 3 }, borderRadius: d.radius.card, borderColor: d.colors.border };
const criterionScore = (item: ProductDemoExample["review"]["criteria"][number] | undefined) => item?.status === "assessed" && item.score !== null ? `${item.score}/2` : "未评";

export default function ProductDemoPage({ demo = defaultDemo }: { demo?: ProductDemo }) {
  const [params, setParams] = useSearchParams();
  const step = steps.some((item) => item.id === params.get("step")) ? params.get("step")! : "context";
  const example = demo.examples.find((item) => item.id === params.get("example")) ?? demo.examples[0];
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const setStep = (id: string) => { const next = new URLSearchParams(params); next.set("step", id); setParams(next); };
  const setExample = (id: string) => { const next = new URLSearchParams(params); next.set("example", id); setParams(next, { replace: true }); setSelectedMessage(null); };
  const showEvidence = (id: string) => { setSelectedMessage(id); document.getElementById(`demo-message-${example.id}-${id}`)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); };
  const before = demo.examples.find((item) => item.id === "before");
  const after = demo.examples.find((item) => item.id === "after");
  const focusId = demo.focusCriterionId ?? before?.review.coaching.focusCriterionId;
  const focus = before?.review.criteria.find((item) => item.id === focusId);
  const currentFocus = example.review.criteria.find((item) => item.id === focusId);
  const focusQuote = currentFocus?.evidence.find((item) => item.speaker === "user") ?? currentFocus?.evidence[0];
  return <Container maxWidth={false} sx={{ maxWidth: 1280, py: { xs: 1, md: 1.5 }, px: { xs: 2, md: 4 } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1, flexWrap: "wrap", mb: 1 }}>
      <Button component={Link} to="/" color="inherit" startIcon={<ArrowBackRounded />}>返回首页</Button>
      <Chip label="模拟案例 · 示例报告" size="small" variant="outlined" sx={{ color: d.colors.muted }} />
    </Stack>
    <Typography component="h1" sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 700, lineHeight: 1.35, mt: .5, mb: .5 }}>从一句客户异议，到下一次更好的表达</Typography>
    <Accordion disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreRounded fontSize="small" />} aria-controls="demo-provenance-content" id="demo-provenance-summary" sx={{ px: 0, minHeight: "36px !important", "& .MuiAccordionSummary-content": { my: .5, gap: 1, flexWrap: "wrap" }, "& .MuiAccordionSummary-content.Mui-expanded": { my: .5 } }}>
        <Typography sx={{ color: d.colors.muted, fontSize: 13 }}>预写模拟对话 · AI 生成示例复盘</Typography>
        <Typography sx={{ color: d.colors.primary, fontSize: 13 }}>示例说明</Typography>
      </AccordionSummary>
      <AccordionDetails id="demo-provenance-content" sx={{ px: 0, pt: 0, pb: 1 }}><Typography sx={{ color: d.colors.muted, fontSize: 13, lineHeight: 1.7, maxWidth: 850 }}>{demo.provenance.notice}</Typography></AccordionDetails>
    </Accordion>
    <Tabs value={step} onChange={(_, value: string) => setStep(value)} variant="scrollable" scrollButtons="auto" aria-label="演示步骤" sx={{ mt: .5, mb: 1.5, borderBottom: "1px solid", borderColor: "divider", minHeight: 44 }}>
      {steps.map((item, index) => <Tab key={item.id} value={item.id} id={`demo-tab-${item.id}`} aria-controls={`demo-panel-${item.id}`} label={`${index + 1}. ${item.label}`} sx={{ minHeight: 44, minWidth: 140, fontWeight: 600 }} />)}
    </Tabs>
    <Box role="tabpanel" id={`demo-panel-${step}`} aria-labelledby={`demo-tab-${step}`}>
      {step === "context" && <Stack spacing={2.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" }, gap: 2.5 }}>
          <Paper variant="outlined" sx={card}>
            <Typography variant="overline" color="primary.main">你要面对的客户</Typography>
            <Typography component="h2" variant="h5" sx={{ mt: 1, mb: .5 }}>{demo.customer.name} · {demo.customer.role}</Typography>
            <Typography color="text.secondary" gutterBottom>{demo.customer.company}</Typography>
            <Typography sx={{ lineHeight: 1.9, mt: 2 }}>{demo.customer.context}</Typography>
            <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: d.colors.primarySoft }}>
              <Typography variant="subtitle2" color="primary.main" gutterBottom>这一轮的目标</Typography>
              <Typography sx={{ lineHeight: 1.8 }}>{demo.goal}</Typography>
            </Box>
          </Paper>
          <Paper variant="outlined" sx={card}>
            <Typography variant="overline" color="primary.main">案例内的产品资料</Typography>
            <Typography component="h2" variant="h5" sx={{ mt: 1, mb: .5 }}>{demo.product.name}</Typography>
            <Typography color="text.secondary">{demo.product.label}</Typography>
            <Box component="ul" sx={{ pl: 2.5, mb: 0, mt: 2, "& li": { lineHeight: 1.8, mb: 1.2 } }}>{demo.product.facts.map((fact) => <li key={fact}>{fact}</li>)}</Box>
          </Paper>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
          <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => setStep("review")} sx={{ minHeight: 46 }}>看两次表达与复盘</Button>
          <Button component={Link} to={`/conversation/${demo.scenarioId}`} variant="outlined" sx={{ minHeight: 46 }}>跳过示例，直接体验</Button>
        </Stack>
      </Stack>}
      {step === "review" && <Stack spacing={1.25}>
        {before && after && <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: .5, flexWrap: "wrap", justifyContent: "space-between" }}>
          {focus && before.review.rubricVersion === after.review.rubricVersion && <Typography sx={{ fontSize: 14, color: d.colors.ink }}>{focus.label}：常见说法 {criterionScore(focus)} → 调整后示范 {criterionScore(after.review.criteria.find((item) => item.id === focus.id))}</Typography>}
          <Typography variant="caption" color="text.secondary">两个模拟样例，不代表真实用户的成长数据。</Typography>
        </Stack>}
        <Tabs value={example.id} onChange={(_, value: string) => setExample(value)} aria-label="选择表达样例" sx={{ borderBottom: "1px solid", borderColor: "divider", minHeight: 42 }}>{demo.examples.map((item) => <Tab key={item.id} value={item.id} label={item.label} sx={{ minHeight: 42, py: 1 }} />)}</Tabs>
        <Typography sx={{ color: d.colors.muted, fontSize: 13, lineHeight: 1.6 }}>{example.description}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, .9fr) minmax(0, 1.2fr)" }, gap: 2, alignItems: "start" }}>
          <Paper variant="outlined" sx={{ ...card, order: { xs: 2, lg: 1 } }}>
            <Typography component="h2" variant="h6" gutterBottom>对话原文</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>这是一段预写模拟对话，复盘由现有评分模型生成。</Typography>
            <Stack spacing={1.5}>{example.messages.map((message) => <Box id={`demo-message-${example.id}-${message.id}`} key={`${example.id}-${message.id}`} tabIndex={-1} sx={{ p: 2, borderRadius: 2, bgcolor: message.role === "user" ? d.colors.primarySoft : d.colors.surfaceSoft, border: "1px solid", borderColor: selectedMessage === message.id ? d.colors.primary : "transparent", scrollMarginTop: 24 }}>
              <Typography variant="caption" sx={{ color: message.role === "user" ? d.colors.primary : d.colors.muted, fontWeight: 600 }}>{message.role === "user" ? "我（销售）" : demo.customer.name}</Typography>
              <Typography sx={{ lineHeight: 1.9, mt: .5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content}</Typography>
            </Box>)}</Stack>
          </Paper>
          <Stack spacing={1.5} sx={{ minWidth: 0, order: { xs: 1, lg: 2 } }}>
            {currentFocus && <Paper variant="outlined" sx={{ ...card, p: { xs: 2, md: 2.5 }, bgcolor: d.colors.primarySoft, borderColor: d.colors.primaryBorder }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 1.5 }}>
                <Typography component="h2" variant="h6">{currentFocus.label}</Typography>
                <Chip size="small" variant="outlined" label={`${criterionScore(currentFocus)} · ${example.label}`} />
              </Stack>
              {focusQuote && <Box component="blockquote" sx={{ m: 0, p: 1.5, borderRadius: 2, bgcolor: d.colors.surface }}>
                <Typography variant="caption" color="text.secondary">{focusQuote.speaker === "user" ? "销售原话" : "客户原话"}</Typography>
                <Typography sx={{ lineHeight: 1.8, mt: .5 }}>{focusQuote.quote}</Typography>
                <Button size="small" onClick={() => showEvidence(focusQuote.messageId)} sx={{ mt: 1 }}>定位这句原话</Button>
              </Box>}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: .5 }}>{currentFocus.score === 2 ? "这次做对了什么" : "问题在哪里"}</Typography>
              <Typography sx={{ lineHeight: 1.8 }}>{currentFocus.score === 2 ? currentFocus.reason : currentFocus.missingBehavior || currentFocus.reason}</Typography>
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: .5 }}>下一次怎么做</Typography>
              <Typography sx={{ lineHeight: 1.8 }}>{currentFocus.nextPractice || example.review.coaching.nextPractice}</Typography>
            </Paper>}
            <Accordion key={example.id} disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px !important", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreRounded />}><Typography fontWeight={600}>查看完整评分与全部依据</Typography></AccordionSummary>
              <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}><BusinessReviewPanel review={example.review} onEvidence={showEvidence} /></AccordionDetails>
            </Accordion>
          </Stack>
        </Box>
        <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => setStep("practice")} sx={{ minHeight: 46, alignSelf: { sm: "flex-start" } }}>带着目标，自己试一轮</Button>
      </Stack>}
      {step === "practice" && <Paper variant="outlined" sx={{ ...card, maxWidth: 860 }}>
        <Typography variant="overline" color="primary.main">把复盘，变成下一次行动</Typography>
        <Typography component="h2" variant="h5" sx={{ mt: 1, mb: 2 }}>{focus?.label || "先回应客户真正的顾虑"}</Typography>
        <Typography sx={{ lineHeight: 1.9 }}>{focus?.nextPractice || before?.review.coaching.nextPractice || demo.goal}</Typography>
        {focus?.missingBehavior && <Box sx={{ p: 2, borderRadius: 2, bgcolor: d.colors.primarySoft, my: 2.5 }}><Typography variant="subtitle2" gutterBottom>回到第一段对话，缺少的动作是</Typography><Typography sx={{ lineHeight: 1.8 }}>{focus.missingBehavior}</Typography></Box>}
        <Typography color="text.secondary" sx={{ lineHeight: 1.9, mt: 2 }}>接下来会新建你自己的练习，由 AI 根据你的表达继续对话。结束后查看你的报告，再从真实报告发起专项再练。</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
          <Button component={Link} to={`/conversation/${demo.scenarioId}`} variant="contained" startIcon={<PlayArrowRounded />} sx={{ minHeight: 46 }}>现在试一轮</Button>
          <Button onClick={() => setStep("review")} variant="outlined" sx={{ minHeight: 46 }}>再看看示例复盘</Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>示例报告用于展示复盘方式，不会计入你的练习记录。</Typography>
      </Paper>}
    </Box>
  </Container>;
}
