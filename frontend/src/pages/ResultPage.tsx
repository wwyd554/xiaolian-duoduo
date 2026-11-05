import BusinessReviewPanel from "../components/review/BusinessReviewPanel";
import type { BusinessReview, CriterionId, PracticeComparison } from "../types/businessReview";
import { customerAvatar } from "../utils/customerAvatar";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  LinearProgress,
  Chip,
  Paper,
  Avatar,
  Tab,
  Tabs,
  Alert,
  AlertTitle,
  Divider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GoalResultsSection from "../components/conversation/GoalResultsSection";
import {
  Home as HomeIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ChatBubble as ChatBubbleIcon,
  Assessment as AssessmentIcon,
  Lightbulb as LightbulbIcon,
  Gavel as GavelIcon,

  Description as DescriptionIcon,
  FaceRounded as FaceIcon,
} from "@mui/icons-material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  ArcElement,
} from "chart.js";
import { Line, Radar } from "react-chartjs-2";
import type { Session, Metrics, GoalStatus, Goal } from "../types/index";
import type { RealtimeMetric, ReferenceCheckResult } from "../types/api";
import { addMetricsChangesToMessages } from "../utils/dialogueEngine";

import ReferenceCheck from "../components/referenceCheck/ReferenceCheck";
import type { ScenarioInfo } from "../types/api";
import type { SlideImageInfo } from "../types/api";
import SlideZoomModal from "../components/conversation/SlideZoomModal";
import ComplianceViolationsList from "../components/compliance/ComplianceViolationsList";

// 服务的导入
import { ApiService } from "../services/ApiService";
import type { FeedbackAnalysisResult, SessionCompleteDataResponse } from "../types/api";

// Chart.js 的注册
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`result-tabpanel-${index}`}
      aria-labelledby={`result-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

// Rubric reports have their own contract; they do not require legacy sub-scores.
function sessionFromBusinessReport(data: SessionCompleteDataResponse): Session {
  const info = data.sessionInfo;
  return {
    id: data.sessionId,
    scenarioId: info.scenarioId,
    startTime: new Date(info.startTime || info.createdAt),
    endTime: info.endTime ? new Date(info.endTime) : undefined,
    messages: data.messages.filter((message) => message.sender === "user" || message.sender === "npc").map((message) => ({
      id: message.messageId,
      sender: message.sender as "user" | "npc",
      content: message.content,
      timestamp: new Date(message.timestamp),
    })),
    finalMetrics: { angerLevel: Number(data.finalMetrics?.angerLevel ?? 0), trustLevel: Number(data.finalMetrics?.trustLevel ?? 0), progressLevel: Number(data.finalMetrics?.progressLevel ?? 0) },
    finalScore: data.businessReview?.totalScore ?? null,
    feedback: [], goalStatuses: [], goalScore: 0,
  };
}

const ResultPage: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [reportTitle, setReportTitle] = useState("");
  const [businessReview, setBusinessReview] = useState<BusinessReview | null>(null);
  const [practiceComparison, setPracticeComparison] = useState<PracticeComparison | undefined>();
  const [practicing, setPracticing] = useState(false);
  const [practiceError, setPracticeError] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [tabValue, setTabValue] = useState(0);

  // 会话类型的状态管理（是否为语音分析）
  const [, setIsAudioAnalysis] = useState(false);

  // 场景信息的状态管理
  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);
  // 幻灯片图片的状态管理
  const [slideImages, setSlideImages] = useState<SlideImageInfo[]>([]);
  const [slideZoomOpen, setSlideZoomOpen] = useState(false);
  const [slideZoomIndex, setSlideZoomIndex] = useState(0);

  // 获取场景信息和幻灯片图片的 effect
  useEffect(() => {
    const fetchScenario = async () => {
      if (session?.scenarioId) {
        try {
          const apiService = ApiService.getInstance();
          const scenarioInfo = await apiService.getScenarioDetail(
            session.scenarioId,
          );
          setScenario(scenarioInfo);

          // 获取幻灯片图片
          if (scenarioInfo.presentationFile) {
            try {
              const slidesResp = await apiService.getSlideImages(session.scenarioId);
              if (slidesResp.status === 'ready' && slidesResp.slides.length > 0) {
                setSlideImages(slidesResp.slides.map(s => ({
                  pageNumber: s.pageNumber,
                  imageKey: s.imageKey,
                  imageUrl: s.imageUrl,
                  thumbnailUrl: s.thumbnailUrl,
                })));
              }
            } catch {
              // 幻灯片获取失败时忽略
            }
          }
        } catch (error) {
          console.error(t("results.scenarioInfoFetchFailed") + ":", error);
        }
      }
    };

    if (session) {
      fetchScenario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.scenarioId, t]);

  // 状態管理
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedFeedback, setDetailedFeedback] =
    useState<FeedbackAnalysisResult | null>(null);
  const [realtimeMetricsHistory, setRealtimeMetricsHistory] = useState<
    RealtimeMetric[]
  >([]);
  const [scenarioGoals, setScenarioGoals] = useState<Goal[]>([]);

  // 参考检查结果（Step Functions 中已获取的数据）
  const [referenceCheckData, setReferenceCheckData] = useState<ReferenceCheckResult | null>(null);

  // 视频分析结果（Step Functions 中已获取的数据）


  // 分析状态管理
  const [analysisStatus, setAnalysisStatus] = useState<string>("not_started");
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState<boolean>(false);

  // 获取 API 服务实例
  const apiService = ApiService.getInstance();

  // 分析状态的轮询
  useEffect(() => {
    if (!sessionId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await apiService.getSessionAnalysisStatus(sessionId);

        setAnalysisStatus(statusResponse.status);

        if (statusResponse.status === "completed") {
          // Fetch the completed payload before ending polling.
          // 重新获取完整的会话数据
          const completeData = await apiService.getSessionCompleteData(sessionId);
          setBusinessReview(completeData.businessReview ?? null);
          setPracticeComparison(completeData.practiceComparison);
          setIsPolling(false);
          clearInterval(pollInterval);
          setError(null);
          if (completeData.businessReview) {
            setSession(sessionFromBusinessReport(completeData));
            setReportTitle(completeData.sessionInfo.scenarioName || completeData.sessionInfo.title || "练习复盘");
            setDetailedFeedback(null);
            setAnalysisProgress(t("results.analysisCompleted"));
            return;
          }

          // 设置详细反馈
          if (!completeData.businessReview && completeData.feedback && "communication" in completeData.feedback.scores) {
            setDetailedFeedback(completeData.feedback as FeedbackAnalysisResult);
          }

          // 设置参考检查结果
          if (completeData.referenceCheck) {
            setReferenceCheckData(completeData.referenceCheck);
          }



          // 设置目标结果（反映首次获取时未完成的情况）
          if (completeData.goalResults) {
            const updatedGoalStatuses = completeData.goalResults.goalStatuses.map(
              (status) => ({
                goalId: status.goalId,
                achieved: status.achieved,
                achievedAt: status.achievedAt && status.achievedAt !== "null"
                  ? (() => {
                    try {
                      const date = new Date(status.achievedAt);
                      return isNaN(date.getTime()) ? undefined : date;
                    } catch {
                      return undefined;
                    }
                  })()
                  : undefined,
                progress: Number(status.progress),
              }),
            );
            const updatedGoalScore = Number(completeData.goalResults.goalScore);
            const updatedScenarioGoals = completeData.goalResults.scenarioGoals.map(
              (goal) => ({
                id: goal.id,
                description: goal.description,
                isRequired: goal.isRequired,
                priority: Number(goal.priority),
                criteria: goal.criteria,
              }),
            );

            setScenarioGoals(updatedScenarioGoals);

            // 同时更新会话的目标信息
            setSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                goalStatuses: updatedGoalStatuses,
                goalScore: updatedGoalScore,
              };
            });
          }

          // 更新最终分数（反馈的 overall 分数）
          if (completeData.feedback?.scores?.overall !== undefined) {
            setSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                finalScore: completeData.feedback!.scores.overall,
              };
            });
          }

          setAnalysisProgress(t("results.analysisCompleted"));
        } else if (statusResponse.status === "failed" || statusResponse.status === "timeout") {
          // 分析失败 - 停止轮询
          setIsPolling(false);
          clearInterval(pollInterval);
          setError(statusResponse.errorMessage || t("results.analysisError"));
        } else if (statusResponse.status === "processing") {
          setAnalysisProgress(t("results.analysisInProgress"));
        }
      } catch (err) {
        console.error("状态轮询错误:", err);
        setIsPolling(false);
        clearInterval(pollInterval);
        setError("复盘结果暂时加载失败，请重新加载页面。已保存的对话不会丢失。");
      }
    }, 3000); // 以 3 秒间隔轮询

    return () => clearInterval(pollInterval);
  }, [sessionId, isPolling, apiService, t]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRetryAnalysis = async () => {
    if (!sessionId || isRetryingAnalysis) return;
    setIsRetryingAnalysis(true);
    setError(null);
    try {
      await apiService.retrySessionAnalysis(sessionId);
      setAnalysisStatus("processing");
      setAnalysisProgress(t("results.analysisInProgress"));
      setIsPolling(true);
    } catch (err) {
      console.error("重新生成复盘失败:", err);
      setAnalysisStatus("failed");
      setError(t("results.retryAnalysisFailed"));
    } finally {
      setIsRetryingAnalysis(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAudioAnalysisSession = (completeData: any, sessionId: string) => {
    try {
      // 语音分析数据中已构建了消息，直接使用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = (completeData.messages || []).map((msg: any) => ({
        id: (msg.messageId as string) || crypto.randomUUID(),
        sender: msg.sender as "user" | "npc",
        content: msg.content as string,
        timestamp: new Date(msg.timestamp as string),
        metrics: undefined, // 语音分析中没有单独的指标
      }));

      // 构建用于语音分析的 Session 对象
      const constructedSession: Session = {
        id: sessionId,
        scenarioId: (completeData.sessionInfo?.scenarioId as string) || "default",
        startTime: new Date((completeData.sessionInfo?.createdAt as string) || new Date().toISOString()),
        endTime: new Date((completeData.sessionInfo?.createdAt as string) || new Date().toISOString()),
        messages: messages,
        finalMetrics: completeData.finalMetrics as Metrics,
        finalScore: completeData.feedback?.scores?.overall ?? null,
        feedback: [],
        goalStatuses: (completeData.goalResults?.goalStatuses as GoalStatus[]) || [],
        goalScore: (completeData.goalResults?.goalScore as number) || 0,
        endReason: "音声分析完了",
        complianceViolations: [],
      };

      setSession(constructedSession);
      setDetailedFeedback(completeData.feedback as FeedbackAnalysisResult);
      setRealtimeMetricsHistory([]); // 语音分析中没有实时指标历史
      setScenarioGoals((completeData.goalResults?.scenarioGoals as Goal[]) || []);

      // 设置参考检查结果（语音分析会话）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((completeData as any).referenceCheck) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setReferenceCheckData((completeData as any).referenceCheck as ReferenceCheckResult);
      }


    } catch (err) {
      console.error("音频分析会话处理错误:", err);
      setError("加载语音分析结果时发生错误");
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    const loadSessionData = async () => {
      try {
        setLoading(true);
        setError(null);
        setDetailedFeedback(null);

        // 先确认分析状态
        try {
          const statusResponse = await apiService.getSessionAnalysisStatus(sessionId);
          setAnalysisStatus(statusResponse.status);

          if (statusResponse.status === "processing") {
            // 分析中则开始轮询
            setIsPolling(true);
            setAnalysisProgress(t("results.analysisInProgress"));
          }
        } catch {
          // 跳过获取分析状态（可能是新会话）
        }

        // 从 API 获取会话分析结果
        const completeData = await apiService.getSessionCompleteData(sessionId);
        setBusinessReview(completeData.businessReview ?? null);
        setPracticeComparison(completeData.practiceComparison);
        if (completeData.businessReview) {
          setSession(sessionFromBusinessReport(completeData));
          setReportTitle(completeData.sessionInfo.scenarioName || completeData.sessionInfo.title || "练习复盘");
          setIsPolling(false);
          setAnalysisStatus("completed");
          return;
        }

        // 判断是否为语音分析会话
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionType = (completeData as any).sessionType;
        if (sessionType === "audio-analysis") {
          // 设置语音分析会话标志
          setIsAudioAnalysis(true);
          // 语音分析会话的处理
          handleAudioAnalysisSession(completeData, sessionId);
          setLoading(false); // 解除加载状态
          return;
        }

        // 普通会话的情况
        setIsAudioAnalysis(false);

        // 从会话基本信息构建 Session 对象
        const sessionInfo = completeData.sessionInfo;
        const messages = completeData.messages
          .filter((msg) => msg.sender === "user" || msg.sender === "npc") // 排除 system 消息
          .map((msg) => ({
            id: msg.messageId || crypto.randomUUID(),
            sender: msg.sender as "user" | "npc",
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            metrics: undefined, // 指标信息另行处理
            presentedSlides: msg.presentedSlides,
          }));

        // 向消息添加指标变化信息
        const messagesWithMetrics = addMetricsChangesToMessages(messages);

        // AgentCore 迁移后：即使 realtimeMetrics 为空，只要有 finalMetrics 就使用
        let finalMetrics: Metrics;

        if (completeData.realtimeMetrics && completeData.realtimeMetrics.length > 0) {
          // 使用实时指标的最新值
          const latestMetrics =
            completeData.realtimeMetrics[completeData.realtimeMetrics.length - 1];

          finalMetrics = {
            angerLevel: Number(latestMetrics.angerLevel),
            trustLevel: Number(latestMetrics.trustLevel),
            progressLevel: Number(latestMetrics.progressLevel),
            analysis: latestMetrics.analysis,
          };
        } else if (completeData.finalMetrics) {
          // 有 finalMetrics 时使用它（经由 AgentCore 的会话）
          finalMetrics = {
            angerLevel: Number(completeData.finalMetrics.angerLevel) || 1,
            trustLevel: Number(completeData.finalMetrics.trustLevel) || 1,
            progressLevel: Number(completeData.finalMetrics.progressLevel) || 1,
            analysis: completeData.finalMetrics.analysis || "",
          };
        } else {
          // 两者都没有时使用默认值
          finalMetrics = {
            angerLevel: 1,
            trustLevel: 1,
            progressLevel: 1,
            analysis: "",
          };
        }

        // 设置目标信息（将数字字符串转换为数字）
        let goalStatuses: GoalStatus[] = [];
        let goalScore = 0;
        let scenarioGoals: Goal[] = [];

        if (completeData.goalResults) {
          // goalStatuses 的类型转换
          goalStatuses = completeData.goalResults.goalStatuses.map(
            (status) => ({
              goalId: status.goalId,
              achieved: status.achieved,
              achievedAt: status.achievedAt && status.achievedAt !== "null"
                ? (() => {
                  try {
                    const date = new Date(status.achievedAt);
                    return isNaN(date.getTime()) ? undefined : date;
                  } catch {
                    return undefined;
                  }
                })()
                : undefined,
              progress: Number(status.progress),
            }),
          );
          goalScore = Number(completeData.goalResults.goalScore);

          // scenarioGoals 的类型转换
          scenarioGoals = completeData.goalResults.scenarioGoals.map(
            (goal) => ({
              id: goal.id,
              description: goal.description,
              isRequired: goal.isRequired,
              priority: Number(goal.priority),
              criteria: goal.criteria,
            }),
          );
        }
        // 注：已删除从实时指标获取 goalStatuses 的回退
        // 因为后端的 formatted_realtime_metrics 不包含 goalStatuses，该回退无法工作
        // goalResults 从 final-feedback 记录中获取

        // scenarioGoals 为空时，尝试从场景信息获取
        if (scenarioGoals.length === 0 && sessionInfo.scenarioId) {
          try {
            const scenarioDetail = await apiService.getScenarioDetail(sessionInfo.scenarioId);
            if (scenarioDetail.goals && scenarioDetail.goals.length > 0) {
              scenarioGoals = scenarioDetail.goals.map((goal) => ({
                id: goal.id,
                description: goal.description,
                isRequired: goal.isRequired ?? false,
                priority: Number(goal.priority ?? 1),
                criteria: goal.criteria ?? [],
              }));
            }
          } catch (scenarioError) {
            console.error("从场景信息获取目标失败:", scenarioError);
          }
        }

        // 决定最终分数（仅使用 Bedrock 的 overall 分数）
        let finalScore: number | null = null;

        // 已获取详细反馈时使用其 overall 分数
        if (
          completeData.feedback &&
          completeData.feedback.scores &&
          completeData.feedback.scores.overall !== undefined
        ) {
          finalScore = completeData.feedback.scores.overall;
        }

        // 最终指标的处理（有 finalMetrics 则使用，否则从实时指标获取）
        let processedFinalMetrics: Metrics;
        if (completeData.finalMetrics) {
          processedFinalMetrics = {
            angerLevel: Number(completeData.finalMetrics.angerLevel),
            trustLevel: Number(completeData.finalMetrics.trustLevel),
            progressLevel: Number(completeData.finalMetrics.progressLevel),
            analysis: completeData.finalMetrics.analysis,
          };
        } else {
          processedFinalMetrics = finalMetrics;
        }

        // 构建 Session 对象
        const constructedSession: Session = {
          id: sessionId,
          scenarioId: sessionInfo.scenarioId || "default",
          startTime: new Date(
            sessionInfo.createdAt || new Date().toISOString(),
          ),
          endTime: new Date(
            sessionInfo.updatedAt ||
            sessionInfo.createdAt ||
            new Date().toISOString(),
          ),
          messages: messagesWithMetrics,
          finalMetrics: processedFinalMetrics,
          finalScore: finalScore,
          feedback: [],
          goalStatuses: goalStatuses,
          goalScore: goalScore,
          endReason:
            sessionInfo.status === "completed" ? "会话完成" : undefined,
          // 添加合规违规数据
          complianceViolations: completeData.complianceViolations || [],
        };

        // 设置会话信息
        setSession(constructedSession);

        // 保存实时指标历史（类型转换）
        // AgentCore 迁移后：realtimeMetrics 为空时设置为空数组
        const processedRealtimeMetrics: RealtimeMetric[] =
          (completeData.realtimeMetrics || []).map((metric) => ({
            angerLevel: Number(metric.angerLevel),
            trustLevel: Number(metric.trustLevel),
            progressLevel: Number(metric.progressLevel),
            analysis: metric.analysis,
            goalStatuses: metric.goalStatuses?.map((status) => ({
              goalId: status.goalId,
              achieved: status.achieved,
              achievedAt: status.achievedAt,
              progress: Number(status.progress),
            })),
            goalScore: Number(metric.goalScore),
            messageNumber: Number(metric.messageNumber),
            timestamp: metric.createdAt,
            userMessage: metric.userMessage,
          }));
        setRealtimeMetricsHistory(processedRealtimeMetrics);

        // 保存场景目标
        setScenarioGoals(scenarioGoals);

        // 删除旧版反馈（因由 Bedrock 生成而不需要）
        setFeedback([]);

        // 设置详细反馈（已从 API 获取 - 已通过 complete-data 整合）
        if (!completeData.businessReview && completeData.feedback && "communication" in completeData.feedback.scores) {
          setDetailedFeedback(completeData.feedback as FeedbackAnalysisResult);
        }

        // 设置参考检查结果（已通过 Step Functions 获取）
        if (completeData.referenceCheck) {
          setReferenceCheckData(completeData.referenceCheck);
        }


      } catch (err) {
        console.error("会话数据加载错误:", err);
        setError(t("errors.sessionLoadFailed"));
      } finally {
        setLoading(false);
      }
    };

    loadSessionData();
  }, [sessionId, navigate, apiService, t]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "success.main";
    if (score >= 60) return "warning.main";
    return "error.main";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircleIcon color="success" />;
    if (score >= 60) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 80) return t("results.performanceLevels.excellent");
    if (score >= 60) return t("results.performanceLevels.good");
    if (score >= 40) return t("results.performanceLevels.needsImprovement");
    return t("results.performanceLevels.needsPractice");
  };

  if (loading) {
    return (
      <Container
        maxWidth="lg"
        sx={{ minHeight: "calc(100dvh - 108px)", display: "grid", placeItems: "center", py: 4 }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 620,
            p: { xs: 3, sm: 5 },
            textAlign: "center",
            borderRadius: 5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 24px 70px rgba(30,36,48,.08)",
          }}
          role="status"
          aria-live="polite"
        >
          <Avatar sx={{ width: 64, height: 64, mx: "auto", mb: 2.5, bgcolor: "rgba(43,89,209,.10)", color: "primary.main" }}>
            <AssessmentIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 30 }, mb: 1 }}>
            {t("results.loadingAnalysis")}
          </Typography>
          <LinearProgress
            sx={{ width: "100%", mt: 3, mb: 2, height: 8, borderRadius: 999 }}
            aria-label={t("results.loadingAnalysis")}
          />
          <Typography variant="body2" color="text.secondary">
            {t("results.loadingSessionData")}
          </Typography>
        </Paper>
      </Container>
    );
  }

  // 分析中的 UI
  if (isPolling && analysisStatus === "processing") {
    return (
      <Container
        maxWidth="lg"
        sx={{ minHeight: "calc(100dvh - 108px)", display: "grid", placeItems: "center", py: 4 }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 660,
            p: { xs: 3, sm: 5 },
            textAlign: "center",
            borderRadius: 5,
            border: "1px solid",
            borderColor: "divider",
            background:
              "radial-gradient(circle at 88% 8%, rgba(43,89,209,.11), transparent 30%), #ffffff",
            boxShadow: "0 24px 70px rgba(30,36,48,.09)",
          }}
          role="status"
          aria-live="polite"
        >
          <Avatar sx={{ width: 72, height: 72, mx: "auto", mb: 2.5, bgcolor: "rgba(43,89,209,.10)", color: "primary.main" }}>
            <AssessmentIcon sx={{ fontSize: 36 }} />
          </Avatar>
          <Typography variant="h4" sx={{ fontSize: { xs: 25, sm: 32 }, mb: 1 }}>
            {t("results.analysisInProgressTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {t("results.analysisInProgressDescription")}
          </Typography>
          <LinearProgress
            sx={{ width: "100%", mt: 3.5, mb: 2.5, height: 8, borderRadius: 999 }}
            aria-label={t("results.analysisInProgress")}
          />
          <Stack direction="row" useFlexGap flexWrap="wrap" justifyContent="center" gap={1} sx={{ mb: 2.5 }}>
            <Chip label="对话反馈" size="small" variant="outlined" />
            <Chip label="目标完成度" size="small" variant="outlined" />
            <Chip label="改进建议" size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {analysisProgress}
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (error) {
    const canRetryAnalysis =
      analysisStatus === "failed" || analysisStatus === "timeout";
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
        <Box display="flex" justifyContent="center" gap={2}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={isRetryingAnalysis}
            onClick={
              canRetryAnalysis
                ? handleRetryAnalysis
                : () => window.location.reload()
            }
          >
            {canRetryAnalysis
              ? t("results.retryAnalysis")
              : t("results.reloadPage")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
          >
            {t("results.backToHome")}
          </Button>
        </Box>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 4 }}>
          {t("results.sessionNotFound")}
        </Alert>
        <Box display="flex" justifyContent="center" gap={2}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            {t("results.reloadPage")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
          >
            {t("results.backToHome")}
          </Button>
        </Box>
      </Container>
    );
  }

  const startFocusedPractice = async (criterionId: CriterionId) => {
    if (!sessionId || practicing) return;
    setPracticing(true);
    setPracticeError("");
    try {
      const plan = await apiService.getPracticePlan(sessionId, criterionId);
      const query = new URLSearchParams({ sourceSessionId: plan.sourceSessionId, criterionId: plan.criterionId });
      navigate(`/conversation/${encodeURIComponent(plan.scenarioId)}?${query}`);
    } catch (err) {
      setPracticeError(err instanceof Error ? err.message : "暂时无法准备专项练习，请重试。");
    } finally {
      setPracticing(false);
    }
  };

  if (businessReview) {
    const showEvidence = (messageId: string) => {
      setSelectedEvidenceId(messageId);
      document.getElementById(`review-message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    return <Container maxWidth="md" sx={{ py: 4 }}>
      <Button onClick={() => navigate("/history")} sx={{ mb: 2 }}>← 返回陪练复盘</Button>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>{reportTitle || "练习复盘"}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>从原话看表现，带着一个明确的目标再练。</Typography>
      <BusinessReviewPanel review={businessReview} comparison={practiceComparison} onPractice={startFocusedPractice} onEvidence={showEvidence} practicing={practicing} practiceError={practiceError} />
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>原始对话 · {session.messages.length} 条</Typography>
        <Stack spacing={1.5}>{session.messages.map((message) => <Paper id={`review-message-${message.id}`} key={message.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: selectedEvidenceId === message.id ? "primary.main" : "divider", bgcolor: message.sender === "user" ? "rgba(43,89,209,.035)" : "background.paper", scrollMarginTop: 24 }}>
          <Typography variant="caption" color="text.secondary">{message.sender === "user" ? "我（销售）" : "客户"}</Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{message.content}</Typography>
        </Paper>)}</Stack>
      </Box>
    </Container>;
  }

  const duration =
    session.endTime && session.startTime
      ? Math.round(
        (new Date(session.endTime).getTime() -
          new Date(session.startTime).getTime()) /
        60000,
      )
      : 0;

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* 标签页导航 */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="result tabs"
            centered
          >
            <Tab
              icon={<AssessmentIcon />}
              label={t("results.evaluationSummary")}
              id="result-tab-0"
              aria-controls="result-tabpanel-0"
            />
            <Tab
              icon={<ChatBubbleIcon />}
              label={t("results.conversationHistory")}
              id="result-tab-1"
              aria-controls="result-tabpanel-1"
            />
            <Tab
              icon={<GavelIcon />}
              label={t("compliance.title")}
              id="result-tab-2"
              aria-controls="result-tabpanel-2"
            />

            {referenceCheckData && <Tab
              value={3}
              icon={<DescriptionIcon />}
              label={t("referenceCheck.title")}
              id="result-tab-3"
              aria-controls="result-tabpanel-3"
            />}
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="primary.main">练习复盘</Typography>
            <Typography variant="h4" component="h1">{scenario?.title || "把这次对话，变成下次的进步"}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>先看关键反馈，再回到原话核对，最后带着一个目标重新练习。</Typography>
          </Box>
          {detailedFeedback && (
            <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, mb: 3, borderRadius: 4 }}>
              <Typography variant="h6" gutterBottom>这次最值得改进的一点</Typography>
              <Typography sx={{ lineHeight: 1.9, mb: 2 }}>{detailedFeedback.improvements?.[0] || "本次报告没有提供具体改进建议，请结合对话记录核对。"}</Typography>
              {detailedFeedback.strengths?.[0] && <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>值得保留的做法</Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.8 }}>{detailedFeedback.strengths[0]}</Typography>
              </Box>}
              {detailedFeedback.nextSteps && <Box sx={{ borderLeft: "3px solid", borderColor: "primary.main", pl: 2, my: 2 }}>
                <Typography variant="subtitle2" gutterBottom>下一次怎么练</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, "& li": { mb: 1, lineHeight: 1.8 } }}>
                  {detailedFeedback.nextSteps.split(/(?<=[。！？])\s*|\n+/).filter((part) => part.trim()).map((part, index) => <li key={index}>{part}</li>)}
                </Box>
              </Box>}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => navigate(`/conversation/${session.scenarioId}`)}>带着目标再练一次</Button>
                <Button variant="outlined" onClick={() => setTabValue(1)}>查看原始对话，核对反馈</Button>
                <Button onClick={() => navigate("/history")}>返回复盘列表</Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>以下是 AI 基于本次对话的反馈，请结合原文判断。技能评分采用百分制，客户实时状态采用十分制。</Typography>
            </Paper>
          )}
          {/* 综合分数 */}
          <Card sx={{ mb: 4, textAlign: "center", p: 3 }}>
            <CardContent>
              {detailedFeedback ? (
                <>
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    gap={2}
                    mb={2}
                  >
                    {getScoreIcon(detailedFeedback.scores.overall)}
                    <Typography
                      variant="h2"
                      sx={{
                        color: getScoreColor(detailedFeedback.scores.overall),
                        fontWeight: "bold",
                      }}
                    >
                      {detailedFeedback.scores.overall}
                    </Typography>
                    <Typography variant="h4" color="text.secondary">
                      / 100
                    </Typography>
                  </Box>
                  <Chip
                    label={getPerformanceLevel(detailedFeedback.scores.overall)}
                    color={
                      detailedFeedback.scores.overall >= 80
                        ? "success"
                        : detailedFeedback.scores.overall >= 60
                          ? "warning"
                          : "error"
                    }
                    sx={{ fontSize: "1rem", py: 1 }}
                  />
                </>
              ) : (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {t("results.generatingScoreAnalysis")}
                  </Alert>
                  <Typography variant="h6" color="text.secondary">
                    {t("results.preparingDetailedAnalysis")}
                  </Typography>
                </>
              )}
              {session.endReason && (
                <Typography
                  variant="body1"
                  sx={{ mt: 2, fontWeight: "medium", color: "text.primary" }}
                >
                  {session.endReason}
                </Typography>
              )}
              <Typography variant="body1" color="text.secondary" mt={2}>
                {t("results.sessionStats", {
                  duration: duration,
                  count: session.messages.length,
                })}
              </Typography>
            </CardContent>
          </Card>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}

          {/* 加载提示 */}
          {loading ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                my: 4,
              }}
            >
              <Typography variant="h6" color="text.secondary" mb={2}>
                {t("results.loadingAnalysis")}
              </Typography>
              <LinearProgress sx={{ width: "50%", mb: 2 }} />
            </Box>
          ) : (
            <Box
              display="flex"
              gap={3}
              sx={{ flexDirection: { xs: "column", md: "row" } }}
            >
              {/* 详细评价栏 */}
              <Box flexGrow={1} sx={{ minWidth: { xs: "100%", md: "300px" } }}>
                {/* 图表显示 - 绩效分析（仅在有详细反馈时显示） */}
                {detailedFeedback && (
                  <Card sx={{ mb: 3, p: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {t("results.performanceAnalysis")}
                      </Typography>
                      <Box
                        sx={{
                          height: 300,
                          mt: 2,
                          mx: "auto",
                          width: "100%",
                          maxWidth: "500px",
                        }}
                      >
                        <Radar
                          data={{
                            labels: [
                              t("results.skillLabels.communication"),
                              t("results.skillLabels.needsAnalysis"),
                              t("results.skillLabels.proposalQuality"),
                              t("results.skillLabels.flexibility"),
                              t("results.skillLabels.trustBuilding"),
                            ],
                            datasets: [
                              {
                                label: t("results.currentScore"),
                                data: [
                                  detailedFeedback.scores.communication || 0,
                                  detailedFeedback.scores.needsAnalysis || 0,
                                  detailedFeedback.scores.proposalQuality || 0,
                                  detailedFeedback.scores.flexibility || 0,
                                  detailedFeedback.scores.trustBuilding || 0,
                                ],
                                backgroundColor: "rgba(54, 162, 235, 0.2)",
                                borderColor: "rgba(54, 162, 235, 1)",
                                borderWidth: 1,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              r: {
                                beginAtZero: true,
                                max: 100,
                                min: 0,
                                ticks: {
                                  stepSize: 20,
                                },
                                pointLabels: {
                                  font: {
                                    size: 12,
                                  },
                                },
                              },
                            },
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* 指标变化图表（仅在有实时指标历史时显示） */}
                {realtimeMetricsHistory.length > 0 && (
                  <Card sx={{ mb: 3, p: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {t("results.metricsChange")}
                      </Typography>
                      <Box
                        sx={{
                          height: 300,
                          mt: 2,
                          mx: "auto",
                          width: "100%",
                          maxWidth: "500px",
                        }}
                      >
                        <Line
                          data={{
                            labels: realtimeMetricsHistory.map((_, index) =>
                              t("results.round", { count: index + 1 }),
                            ),
                            datasets: [
                              {
                                label: t("metrics.angerMeter"),
                                data: realtimeMetricsHistory.map((m) =>
                                  Number(m.angerLevel),
                                ),
                                borderColor: "rgba(255, 99, 132, 1)",
                                backgroundColor: "rgba(255, 99, 132, 0.2)",
                              },
                              {
                                label: t("metrics.trustLevel"),
                                data: realtimeMetricsHistory.map((m) =>
                                  Number(m.trustLevel),
                                ),
                                borderColor: "rgba(54, 162, 235, 1)",
                                backgroundColor: "rgba(54, 162, 235, 0.2)",
                              },
                              {
                                label: t("metrics.progressLevel"),
                                data: realtimeMetricsHistory.map((m) =>
                                  Number(m.progressLevel),
                                ),
                                borderColor: "rgba(75, 192, 192, 1)",
                                backgroundColor: "rgba(75, 192, 192, 0.2)",
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: {
                                min: 0,
                                max: 10,
                                ticks: {
                                  stepSize: 2,
                                },
                              },
                            },
                            plugins: {
                              legend: {
                                position: "top",
                                labels: {
                                  boxWidth: 15,
                                  padding: 10,
                                },
                              },
                            },
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* 关键点分析 */}
                <Accordion sx={{ mb: 3 }}><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">完整反馈与分析</Typography></AccordionSummary><AccordionDetails>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <LightbulbIcon color="warning" sx={{ mr: 1 }} />
                      <Typography variant="h6">
                        {t("results.keyPointAnalysis")}
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />

                    {detailedFeedback ? (
                      <>
                        {/* 优势 */}
                        {detailedFeedback.strengths.map(
                          (strength: string, index: number) => (
                            <Alert
                              key={`strength-${index}`}
                              severity="success"
                              sx={{ mb: 2 }}
                            >
                              {strength}
                            </Alert>
                          ),
                        )}

                        {/* 改善点 */}
                        {detailedFeedback.improvements.map(
                          (improvement: string, index: number) => (
                            <Alert
                              key={`improvement-${index}`}
                              severity="warning"
                              sx={{ mb: 2 }}
                            >
                              {improvement}
                            </Alert>
                          ),
                        )}

                        {/* 重要的洞察 */}
                        {detailedFeedback.keyInsights?.map(
                          (insight: string, index: number) => (
                            <Alert
                              key={`insight-${index}`}
                              severity="info"
                              sx={{ mb: 2 }}
                            >
                              {insight}
                            </Alert>
                          ),
                        )}

                        {/* 下一步 */}
                        {detailedFeedback.nextSteps && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {t("results.nextSteps")}
                            </Typography>
                            {detailedFeedback.nextSteps}
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {t("results.detailedFeedbackNotAvailable")}
                      </Alert>
                    )}
                  </CardContent>
                </AccordionDetails></Accordion>

                {/* 詳細評価 */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {t("results.detailedEvaluation")}
                    </Typography>

                    {/* 愤怒表 */}
                    <Box mb={3}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={1}
                      >
                        <Typography variant="subtitle2">
                          {t("metrics.angerMeter")}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {session.finalMetrics.angerLevel}/10
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(session.finalMetrics.angerLevel / 10) * 100}
                        color={
                          session.finalMetrics.angerLevel >= 7
                            ? "error"
                            : session.finalMetrics.angerLevel >= 4
                              ? "warning"
                              : "success"
                        }
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>

                    {/* 信頼度 */}
                    <Box mb={3}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={1}
                      >
                        <Typography variant="subtitle2">
                          {t("metrics.trustLevel")}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {session.finalMetrics.trustLevel}/10
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(session.finalMetrics.trustLevel / 10) * 100}
                        color={
                          session.finalMetrics.trustLevel >= 7
                            ? "success"
                            : session.finalMetrics.trustLevel >= 4
                              ? "info"
                              : "error"
                        }
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>

                    {/* 商談進捗度 */}
                    <Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={1}
                      >
                        <Typography variant="subtitle2">
                          {t("metrics.progressLevel")}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {session.finalMetrics.progressLevel}/10
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(session.finalMetrics.progressLevel / 10) * 100}
                        color={
                          session.finalMetrics.progressLevel >= 7
                            ? "success"
                            : session.finalMetrics.progressLevel >= 4
                              ? "info"
                              : "error"
                        }
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  </CardContent>
                </Card>

                {/* 技能详细分数（仅在有详细反馈时显示） */}
                {detailedFeedback && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        💯 {t("results.skillDetailedScore")}
                      </Typography>

                      {/* 沟通能力 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.communication")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.communication}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.communication
                          }
                          color="primary"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 需求把握 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.needsAnalysis")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.needsAnalysis}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.needsAnalysis
                          }
                          color="info"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 提案品質 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.proposalQuality")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.proposalQuality}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.proposalQuality
                          }
                          color="success"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 应对灵活性 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.flexibility")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.flexibility}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={detailedFeedback.scores.flexibility}
                          color="warning"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 信頼構築 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.trustBuilding")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.trustBuilding}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.trustBuilding
                          }
                          color="secondary"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 異議対応力 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.objectionHandling")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.objectionHandling}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.objectionHandling
                          }
                          color="error"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 成交技能 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.closingSkill")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.closingSkill}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.closingSkill
                          }
                          color="info"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 倾听技能 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.listeningSkill")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.listeningSkill}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.listeningSkill
                          }
                          color="success"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 製品知識 */}
                      <Box mb={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.productKnowledge")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.productKnowledge}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.productKnowledge
                          }
                          color="primary"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      {/* 顧客中心思考 */}
                      <Box>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="subtitle2">
                            {t("results.skillLabels.customerFocus")}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {detailedFeedback.scores.customerFocus}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            detailedFeedback.scores.customerFocus
                          }
                          color="warning"
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* 旧版反馈 - 无 UI 显示 */}
                {!detailedFeedback && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        📝 {t("results.feedback")}
                      </Typography>
                      {feedback.map((item, index) => (
                        <Paper
                          key={index}
                          sx={{ p: 2, mb: 2, backgroundColor: "#f5f5f5" }}
                        >
                          <Typography variant="body2">{item}</Typography>
                        </Paper>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </Box>

              {/* 侧边栏 */}
              <Box sx={{ width: { xs: "100%", md: "300px" }, flexShrink: 0 }}>
                {/* NPC情報 */}
                {scenario && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {t("results.conversationPartner")}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <Avatar
                          src={customerAvatar(scenario.npc?.name || scenario.npcInfo?.name, scenario.npc?.avatar || scenario.npcInfo?.avatar)}
                          alt={scenario.npc?.name || scenario.npcInfo?.name}
                          sx={{ width: 40, height: 40, fontSize: "1.2rem", bgcolor: "#edf2ff", color: "primary.main" }}
                        >
                          <FaceIcon sx={{ fontSize: 26 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {scenario.npc?.name ||
                              scenario.npcInfo?.name ||
                              "Unknown"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {scenario.npc?.role || scenario.npcInfo?.role || ""}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {scenario.npc?.description ||
                          scenario.npcInfo?.description ||
                          ""}
                      </Typography>
                    </CardContent>
                  </Card>
                )}

                {/* 統計情報 */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📊 {t("results.sessionStatistics")}
                    </Typography>
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        {t("results.conversationTime")}
                      </Typography>
                      <Typography variant="h6">
                        {duration} {t("results.minutes")}
                      </Typography>
                    </Box>
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        {t("results.messageCount")}
                      </Typography>
                      <Typography variant="h6">
                        {session.messages.length} {t("results.times")}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t("results.userMessages")}
                      </Typography>
                      <Typography variant="h6">
                        {
                          session.messages.filter((m) => m.sender === "user")
                            .length
                        }{" "}
                        {t("results.times")}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {/* 操作按钮 */}
                <Box display="flex" flexDirection="column" gap={2}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<RefreshIcon />}
                    onClick={() => navigate("/scenarios")}
                  >
                    {t("results.tryAnotherScenario")}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<HomeIcon />}
                    onClick={() => navigate("/")}
                  >
                    {t("results.backToHome")}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
          {/* 目标达成情况区域 - 全宽显示 */}
          {scenarioGoals && scenarioGoals.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <GoalResultsSection
                goals={scenarioGoals}
                goalStatuses={session?.goalStatuses || []}
              />
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t("results.conversationLog")}
              </Typography>
              <Box sx={{ maxHeight: "500px", overflow: "auto", mt: 2 }}>
                {session.messages.map((msg, index) => (
                  <Paper
                    key={index}
                    sx={{
                      p: 2,
                      mb: 2,
                      backgroundColor:
                        msg.sender === "user" ? "#e3f2fd" : "#f5f5f5",
                      ml: msg.sender === "user" ? "auto" : 0,
                      mr: msg.sender === "user" ? 0 : "auto",
                      maxWidth: "80%",
                      position: "relative",
                    }}
                  >
                    <Typography
                      variant="caption"
                      display="block"
                      color="text.secondary"
                      gutterBottom
                    >
                      {msg.sender === "user"
                        ? t("results.you")
                        : scenario?.npc?.name ||
                        scenario?.npcInfo?.name ||
                        "NPC"}{" "}
                      - {new Date(msg.timestamp).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="body1">{msg.content}</Typography>

                    {/* 幻灯片选择缩略图显示 */}
                    {msg.presentedSlides && msg.presentedSlides.length > 0 && slideImages.length > 0 && (
                      <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {msg.presentedSlides.map((page: number) => {
                          const slide = slideImages.find(s => s.pageNumber === page);
                          if (!slide) return null;
                          const idx = slideImages.indexOf(slide);
                          return (
                            <Box
                              key={page}
                              onClick={() => { setSlideZoomIndex(idx); setSlideZoomOpen(true); }}
                              sx={{
                                width: 60,
                                height: 42,
                                borderRadius: 0.5,
                                overflow: "hidden",
                                cursor: "pointer",
                                border: 1,
                                borderColor: "info.main",
                                "&:hover": { opacity: 0.8 },
                              }}
                            >
                              {slide.thumbnailUrl ? (
                                <Box
                                  component="img"
                                  src={slide.thumbnailUrl}
                                  alt={`${t("conversation.slideTray.slide")} ${page}`}
                                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <Box sx={{ width: "100%", height: "100%", bgcolor: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: "0.5rem" }}>
                                  {page}
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {msg.metrics && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: "1px dashed #ddd" }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {t("results.metricsChangeLabel")}
                        </Typography>
                        <Box display="flex" gap={2} mt={0.5}>
                          <Chip
                            label={t("results.angerMeter", {
                              value: msg.metrics.angerLevel,
                            })}
                            size="small"
                            variant="outlined"
                            color={
                              msg.metrics.angerChange &&
                                msg.metrics.angerChange > 0
                                ? "error"
                                : "default"
                            }
                          />
                          <Chip
                            label={t("results.trustLevel", {
                              value: msg.metrics.trustLevel,
                            })}
                            size="small"
                            variant="outlined"
                            color={
                              msg.metrics.trustChange &&
                                msg.metrics.trustChange > 0
                                ? "success"
                                : "default"
                            }
                          />
                          <Chip
                            label={t("results.progressLevel", {
                              value: msg.metrics.progressLevel,
                            })}
                            size="small"
                            variant="outlined"
                            color={
                              msg.metrics.progressChange &&
                                msg.metrics.progressChange > 0
                                ? "info"
                                : "default"
                            }
                          />
                        </Box>
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </TabPanel>

        {/* 合规违规列表标签页 */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ maxWidth: 900, mx: "auto" }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              {t("compliance.report", "合规违规报告")}
            </Typography>

            {!session?.complianceViolations ||
              session.complianceViolations.length === 0 ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>
                  {t("compliance.noDataTitle", "无数据")}
                </AlertTitle>
                {t(
                  "compliance.noData",
                  "该会话中没有合规违规数据。",
                )}
              </Alert>
            ) : (
              <ComplianceViolationsList
                violations={session.complianceViolations}
              />
            )}

            <Box
              sx={{ mt: 4, p: 3, bgcolor: "background.default", borderRadius: 2 }}
            >
              <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                {t("compliance.explanationTitle", "关于合规违规")}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t(
                  "compliance.explanation1",
                  "合规违规是指销售活动中违反法律法规或伦理规范的表达或行为。避免违规有助于建立客户信任并将风险降到最低。",
                )}
              </Typography>
              <Typography variant="body2">
                {t(
                  "compliance.explanation2",
                  "请参考以上报告，在今后的商谈中改进表达。特别是「高」严重度违规，法律风险较高，需要格外注意。",
                )}
              </Typography>
            </Box>
          </Box>
        </TabPanel>



        {/* 参考检查标签页 */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ maxWidth: 900, mx: "auto" }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                {sessionId && (
                  <ReferenceCheck
                    sessionId={sessionId}
                    language={scenario?.language || "zh"}
                    isVisible={true}
                    initialData={referenceCheckData}
                  />
                )}
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
      </Container>

      {/* 幻灯片放大模态框 */}
      {
        slideImages.length > 0 && (
          <SlideZoomModal
            open={slideZoomOpen}
            slides={slideImages}
            currentIndex={slideZoomIndex}
            presentedPages={[]}
            onSlideChange={setSlideZoomIndex}
            onPresent={() => { }}
            onUnpresent={() => { }}
            onClose={() => setSlideZoomOpen(false)}
          />
        )
      }
    </>
  );
};

export default ResultPage;
