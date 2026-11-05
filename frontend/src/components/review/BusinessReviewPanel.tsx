import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { BusinessCriterion, BusinessReview, CriterionId, PracticeComparison, ReviewEvidence } from "../../types/businessReview";

interface Props {
  review: BusinessReview;
  comparison?: PracticeComparison | null;
  onPractice?: (criterionId: CriterionId) => void;
  onEvidence?: (messageId: string) => void;
  practicing?: boolean;
  practiceError?: string;
}

const statusLabel = (item: BusinessCriterion) => {
  if (item.status === "assessed" && item.score !== null) return ["未做到", "部分做到", "完整做到"][item.score];
  return { not_applicable: "本次不适用", insufficient_evidence: "证据不足", evaluation_error: "评估未完成", assessed: "评估未完成" }[item.status];
};

function Evidence({ evidence, onEvidence }: { evidence: ReviewEvidence[]; onEvidence?: Props["onEvidence"] }) {
  return <Stack spacing={1.5}>{evidence.map((entry, index) => (
    <Box key={`${entry.messageId}-${index}`} component="blockquote" sx={{ m: 0, pl: 2, borderLeft: "3px solid", borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary">{entry.speaker === "user" ? "我（销售）" : "客户"}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{entry.quote}</Typography>
      {onEvidence && <Button size="small" onClick={() => onEvidence(entry.messageId)} sx={{ mt: .5 }}>定位这句原话</Button>}
    </Box>
  ))}</Stack>;
}

/** Shared rubric report for practice, chat imports and recording transcripts. */
export default function BusinessReviewPanel({ review, comparison, onPractice, onEvidence, practicing, practiceError }: Props) {
  const focus = review.criteria.find((item) => item.id === review.coaching.focusCriterionId && item.status === "assessed" && item.score !== null && item.score < 2)
    ?? review.criteria.find((item) => item.status === "assessed" && item.score !== null && item.score < 2);
  return <Stack spacing={3}>
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 4 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="overline" color="primary.main">本次能力表现</Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, my: 1 }}>
            {review.totalScore === null ? "待补全" : <>{review.totalScore}<Typography component="span" color="text.secondary" sx={{ ml: 1 }}>/ 100</Typography></>}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {review.totalScore === null ? "有考点尚未完成评估，暂不计算完整总分。" : "根据本场适用考点及固定权重计算，不代表上岗认证。"}
          </Typography>
        </Box>
        <Stack spacing={1} alignItems={{ sm: "flex-end" }}>
          <Chip size="small" label={`评分标准 v${review.rubricVersion}`} variant="outlined" />
          <Typography variant="caption" color="text.secondary">已评 {review.coverage.assessed} / {review.coverage.applicable} 个适用考点</Typography>
        </Stack>
      </Stack>
      {comparison && <Alert severity="info" sx={{ mt: 2.5 }}>
        {comparison.comparable && comparison.currentScore !== null && comparison.previousScore !== null
          ? `本次专项 ${comparison.currentScore}/2，上次 ${comparison.previousScore}/2${comparison.delta === null ? "" : `，变化 ${comparison.delta > 0 ? "+" : ""}${comparison.delta}`}。`
          : (comparison.reason || "两次评估条件不同，暂不比较分数。")}
      </Alert>}
    </Paper>

    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 4 }}>
      <Typography variant="h6" gutterBottom>下一次，先练好这一点</Typography>
      <Typography sx={{ lineHeight: 1.9 }}>{review.coaching.fix || "本次尚未形成有证据的改进结论。"}</Typography>
      {review.coaching.keep && <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>值得保留</Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.8 }}>{review.coaching.keep}</Typography>
      </Box>}
      {review.coaching.nextPractice && <Typography sx={{ mt: 2, lineHeight: 1.8 }}>{review.coaching.nextPractice}</Typography>}
      {focus && onPractice && <Button variant="contained" endIcon={practicing ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardRounded />} disabled={practicing} onClick={() => onPractice(focus.id)} sx={{ mt: 2.5 }}>专项再练 · {focus.label}</Button>}
      {practiceError && <Alert severity="error" sx={{ mt: 2 }}>{practiceError}</Alert>}
    </Paper>

    <Box>
      <Typography variant="h6" sx={{ mb: 1.5 }}>逐项看表现与依据</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>0 未做到 · 1 部分做到 · 2 完整做到。展开查看判分原因和原话。</Typography>
      <Stack spacing={1.5}>{review.criteria.map((item) => <Accordion key={item.id} disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px !important", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ width: "100%", mr: 1 }}>
            <Box><Typography fontWeight={600}>{item.label}</Typography><Typography variant="caption" color="text.secondary">{item.status === "not_applicable" ? "本次不计入总分" : `配置权重 ${item.weight}`}</Typography></Box>
            <Chip size="small" variant="outlined" label={`${item.status === "assessed" && item.score !== null ? `${item.score}/2 · ` : ""}${statusLabel(item)}`} />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Typography sx={{ mb: 2, lineHeight: 1.8 }}>{item.reason}</Typography>
          <Evidence evidence={item.evidence} onEvidence={onEvidence} />
          {item.evidence.length === 0 && <Typography variant="body2" color="text.secondary">{item.status === "assessed" && item.score === 0 ? "完整核查后未发现该行为；没有生成不存在的原话。" : "本项没有可引用的原话。"}</Typography>}
          {item.missingBehavior && <Typography variant="body2" sx={{ mt: 2 }}>还差的动作：{item.missingBehavior}</Typography>}
          {item.nextPractice && <Typography variant="body2" sx={{ mt: 1 }}>练习建议：{item.nextPractice}</Typography>}
          {onPractice && item.status === "assessed" && item.score !== null && item.score < 2 && <Button disabled={practicing} onClick={() => onPractice(item.id)} sx={{ mt: 1.5 }}>练习这一项</Button>}
        </AccordionDetails>
      </Accordion>)}</Stack>
    </Box>

    <Box>
      <Typography variant="h6" sx={{ mb: 1.5 }}>事实与沟通边界</Typography>
      <Alert severity={review.riskChecks.status === "review_required" ? "warning" : "info"}>{review.riskChecks.limitations || "本次未完成产品事实与行业规则核对，不能据此判断没有风险。"}</Alert>
      {review.riskChecks.findings.map((finding) => <Paper key={finding.id} variant="outlined" sx={{ p: 2.5, mt: 1.5, borderRadius: 3 }}>
        <Chip label="待核实" size="small" color="warning" variant="outlined" />
        <Typography sx={{ my: 1.5 }}>{finding.reason}</Typography>
        <Evidence evidence={finding.evidence} onEvidence={onEvidence} />
      </Paper>)}
    </Box>
  </Stack>;
}
