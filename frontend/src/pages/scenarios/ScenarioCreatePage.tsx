import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Box,
  CircularProgress,
  Alert,
  AlertTitle,
  TextField,
  MenuItem,
} from "@mui/material";
import { ApiService } from "../../services/ApiService";
import { AvatarService } from "../../services/AvatarService";
import { useTranslation } from "react-i18next";
import {
  validateBasicInfo,
  validateNpcInfo,
  validateGoals,
  validateSharing,
} from "../../utils/validation";

// ステップコンポーネントをインポート
import BasicInfoStep from "./creation/BasicInfoStep";
import NPCInfoStep from "./creation/NPCInfoStep";
import GoalsStep from "./creation/GoalsStep";
import PdfFilesStep from "./creation/PdfFilesStep";
import PresentationStep from "./creation/PresentationStep";
import SharingStep from "./creation/SharingStep";
import PreviewStep from "./creation/PreviewStep";
import { ScenarioInfo, DifficultyLevel } from "../../types/api";

/**
 * シナリオ作成ページ
 * ユーザーがカスタムシナリオを作成するためのマルチステップフォーム
 */
const ScenarioCreatePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiService = ApiService.getInstance();

  // ステップ管理
  const [activeStep, setActiveStep] = useState(0);
  // アップロード用の一時ID（シナリオ作成前のファイルアップロードに使用）
  const [tempUploadId] = useState(() => `temp-${Date.now()}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardrailsList, setGuardrailsList] = useState<
    Array<{
      arn: string;
      id: string;
      name: string;
      description: string;
    }>
  >([]);

  // バリデーションエラー管理
  const [validationErrors, setValidationErrors] = useState<{
    basicInfo: Record<string, string | null>;
    npcInfo: Record<string, string | null>;
    goals: Record<string, string | null>;
    sharing: Record<string, string | null>;
  }>({
    basicInfo: {},
    npcInfo: {},
    goals: {},
    sharing: {},
  });

  // AI 辅助生成（基于行业资料生成草稿，可选）
  const [genMaterial, setGenMaterial] = useState("");
  const [genIndustry, setGenIndustry] = useState("");
  const [genRole, setGenRole] = useState("");
  const [genTrainingGoals, setGenTrainingGoals] = useState("");
  const [genDifficulty, setGenDifficulty] = useState("中级");
  const [genCategory, setGenCategory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState(false);

  // 行业资料 → AI 草稿 → 填充表单
  const handleGenerateDraft = async () => {
    if (!genMaterial.trim()) {
      setGenError("请先粘贴行业/产品资料");
      return;
    }
    setIsGenerating(true);
    setGenError(null);
    try {
      const res = await apiService.generateScenario({
        material: genMaterial,
        industry: genIndustry || undefined,
        role: genRole || undefined,
        trainingGoals: genTrainingGoals || undefined,
        difficulty: genDifficulty || undefined,
        category: genCategory || undefined,
      });
      const draft = (res.draft || {}) as Record<string, any>;
      const diffMap: Record<string, DifficultyLevel> = {
        初级: "easy",
        中级: "normal",
        高级: "hard",
        专家级: "expert",
        资深: "expert",
      };
      const mappedDiff = diffMap[draft.difficulty as string] ?? "normal";
      const npc = (draft.npc || {}) as Record<string, any>;
      setFormData((prev) => ({
        ...prev,
        title: draft.title ?? prev.title,
        description: draft.description ?? prev.description,
        category: draft.category ?? prev.category,
        difficulty: mappedDiff,
        language: draft.language ?? prev.language,
        initialMessage: draft.initialMessage ?? prev.initialMessage,
        npc: {
          name: npc.name ?? "",
          role: npc.role ?? "",
          company: npc.company ?? "",
          personality: Array.isArray(npc.personality) ? npc.personality : [],
          description: npc.description ?? "",
        },
        objectives:
          typeof draft.objectives === "string" && draft.objectives
            ? [draft.objectives]
            : Array.isArray(draft.objectives)
              ? draft.objectives
              : prev.objectives,
        goals: Array.isArray(draft.goals)
          ? draft.goals.map((g: Record<string, any>, i: number) => ({
              id: g.id ?? `goal-${i + 1}`,
              description: g.description ?? "",
              isRequired: g.isRequired ?? false,
              priority: g.priority ?? i + 1,
              criteria: Array.isArray(g.criteria) ? g.criteria : [],
            }))
          : prev.goals,
        initialMetrics: draft.initialMetrics ?? prev.initialMetrics,
        maxTurns: draft.maxTurns ?? prev.maxTurns,
      }));
      if (npc.voiceId) setVoiceId(npc.voiceId);
      setGenDone(true);
    } catch (err) {
      console.error("AI 生成草稿失败:", err);
      setGenError(err instanceof Error ? err.message : "场景生成失败");
      setGenDone(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // アバター・音声モデル管理
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState<string>("");
  const [enableAvatar, setEnableAvatar] = useState<boolean>(true);

  // フォームデータ
  const [formData, setFormData] = useState({
    // 基本情報
    scenarioId: "",
    title: "",
    description: "",
    difficulty: "normal" as DifficultyLevel,
    category: "",
    language: "zh", // 默认中文
    maxTurns: undefined as number | undefined, // 最大ターン数（任意）

    // NPC情報
    npc: {
      name: "",
      role: "",
      company: "",
      personality: [] as string[],
      description: "",
    },

    // 目標・メトリクス
    objectives: [] as string[],
    initialMetrics: {
      angerLevel: 1,
      trustLevel: 3,
      progressLevel: 2,
    },
    goals: [] as {
      id: string;
      description: string;
      isRequired: boolean;
      priority: number;
      criteria: string[];
    }[],

    // PDF資料
    pdfFiles: [] as {
      key: string;
      fileName: string;
      contentType: string;
      size?: number;
    }[],

    // 共有設定
    visibility: "private" as "public" | "private" | "shared",
    sharedWithUsers: [] as string[],
    guardrail: "",
    initialMessage: "",

    // 提案資料
    presentationFile: undefined as
      | {
        key: string;
        fileName: string;
        contentType: string;
        size?: number;
        status?: 'uploading' | 'converting' | 'ready' | 'error';
      }
      | undefined,
  });

  // 初期化処理
  useEffect(() => {
    // ガードレールリストの取得
    const loadGuardrails = async () => {
      try {
        const guardrails = await apiService.getGuardrails();
        setGuardrailsList(guardrails);

        // デフォルト値として最初のガードレールを設定
        if (guardrails.length > 0) {
          setFormData((prev) => ({
            ...prev,
            guardrail: guardrails[0].name,
          }));
        }
      } catch (error) {
        console.error("护栏获取失败:", error);
        setError(t("scenarios.create.error.guardrailsLoad"));
      }
    };

    loadGuardrails();
  }, [t, apiService]);

  // ステップの定義
  const steps = [
    { label: t("scenarios.create.steps.basicInfo") },
    { label: t("scenarios.create.steps.npcInfo") },
    { label: t("scenarios.create.steps.goals") },
    { label: t("scenarios.create.steps.pdfs") },
    { label: t("scenarios.create.steps.presentation") },
    { label: t("scenarios.create.steps.sharing") },
    { label: t("scenarios.create.steps.preview") },
  ];

  // 次のステップへ
  const handleNext = () => {
    // 現在のステップのバリデーション
    let isValid = true;
    const currentErrors = { ...validationErrors };

    if (activeStep === 0) {
      // 基本情報のバリデーション
      const errors = validateBasicInfo(
        formData.title,
        formData.description,
        formData.category,
        formData.language,
        formData.scenarioId,
        formData.maxTurns,
      );
      isValid = Object.values(errors).every((error) => error === null);
      currentErrors.basicInfo = errors;
    } else if (activeStep === 1) {
      // NPC情報のバリデーション
      const errors = validateNpcInfo(
        formData.npc.name,
        formData.npc.role,
        formData.npc.company,
      );
      // voiceId必須チェック
      if (!voiceId) {
        (errors as Record<string, string | null>).voiceId = "scenarios.validation.voiceIdRequired";
      }
      isValid = Object.values(errors).every((error) => error === null);
      currentErrors.npcInfo = errors;
    } else if (activeStep === 2) {
      // 目標のバリデーション
      const errors = validateGoals(formData.objectives, formData.goals);
      isValid = Object.values(errors).every((error) => error === null);
      currentErrors.goals = errors;
    } else if (activeStep === 3) {
      // PDF資料ステップは特別なバリデーションは不要
      isValid = true;
    } else if (activeStep === 4) {
      // 提案資料ステップは特別なバリデーションは不要（任意項目）
      isValid = true;
    } else if (activeStep === 5) {
      // 共有設定のバリデーション
      const errors = validateSharing(
        formData.visibility,
        formData.sharedWithUsers,
        formData.guardrail,
      );
      isValid = Object.values(errors).every((error) => error === null);
      currentErrors.sharing = errors;
    }

    // バリデーションエラーを更新
    setValidationErrors(currentErrors);

    // バリデーションが成功した場合のみ次のステップへ
    if (isValid) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  // 前のステップへ
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // シナリオの保存
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // アバターアップロード処理
      let avatarId: string | undefined;
      if (avatarFile) {
        const avatarService = AvatarService.getInstance();
        const createResult = await avatarService.createAvatar(
          avatarFile.name,
          avatarFile.name.replace(/\.vrm$/i, ""),
          "application/octet-stream",
        );
        await avatarService.uploadVrmFile(
          createResult.uploadUrl,
          createResult.formData,
          avatarFile,
        );
        await avatarService.confirmUpload(createResult.avatarId);
        avatarId = createResult.avatarId;
      }

      // APIリクエスト用にデータを整形
      const scenarioData: Partial<ScenarioInfo> & { tempUploadId?: string } = {
        scenarioId: formData.scenarioId,
        title: formData.title,
        description: formData.description,
        difficulty: formData.difficulty,
        category: formData.category,
        npc: { ...formData.npc, voiceId },
        objectives: formData.objectives,
        initialMetrics: formData.initialMetrics,
        goals: formData.goals,
        pdfFiles: formData.pdfFiles.length > 0 ? formData.pdfFiles : undefined,
        presentationFile: formData.presentationFile || undefined,
        visibility: formData.visibility,
        guardrail: formData.guardrail,
        language: formData.language,
        initialMessage: formData.initialMessage,
        maxTurns: formData.maxTurns,
        enableAvatar,
        ...(avatarId ? { avatarId } : {}),
        ...(formData.visibility === "shared"
          ? { sharedWithUsers: formData.sharedWithUsers }
          : {}),
        tempUploadId,
      };

      // APIでシナリオを作成
      const response = await apiService.createScenario(scenarioData);

      // 成功した場合
      navigate("/scenarios", {
        state: {
          success: true,
          message: t("scenarios.create.success"),
          scenarioId: response.scenarioId,
        },
      });
    } catch (error) {
      console.error("场景创建错误:", error);
      setError(
        error instanceof Error
          ? error.message
          : t("scenarios.create.error.unknown"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    if (window.confirm(t("scenarios.create.confirmCancel"))) {
      navigate("/scenarios");
    }
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ mt: 3, mb: 3, p: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          sx={{ mb: 4 }}
        >
          {t("scenarios.create.title")}
        </Typography>

        {/* エラーメッセージ */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>{t("common.error")}</AlertTitle>
            {error}
          </Alert>
        )}

        {/* AI 辅助生成（基于行业资料一键生成草稿，可选） */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4, bgcolor: "action.hover" }}>
          <Typography variant="h6" gutterBottom>
            AI 辅助生成场景（可选）
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            粘贴行业/产品资料，AI 将生成一份可编辑的场景草稿并自动填充到下方表单；你也可以在生成后再手动调整。
          </Typography>

          <TextField
            label="行业/产品资料（必填）"
            value={genMaterial}
            onChange={(e) => setGenMaterial(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            placeholder="例如：公司简介、目标客户、典型痛点、销售要点、决策链与常见异议…"
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
            <TextField
              label="行业"
              value={genIndustry}
              onChange={(e) => setGenIndustry(e.target.value)}
              size="small"
              sx={{ flex: "1 1 140px" }}
            />
            <TextField
              label="客户角色"
              value={genRole}
              onChange={(e) => setGenRole(e.target.value)}
              size="small"
              sx={{ flex: "1 1 140px" }}
            />
            <TextField
              label="分类"
              value={genCategory}
              onChange={(e) => setGenCategory(e.target.value)}
              size="small"
              sx={{ flex: "1 1 140px" }}
            />
            <TextField
              label="难度"
              value={genDifficulty}
              onChange={(e) => setGenDifficulty(e.target.value)}
              select
              size="small"
              sx={{ flex: "1 1 140px" }}
            >
              <MenuItem value="初级">初级</MenuItem>
              <MenuItem value="中级">中级</MenuItem>
              <MenuItem value="高级">高级</MenuItem>
            </TextField>
          </Box>

          <TextField
            label="训练目标（可选）"
            value={genTrainingGoals}
            onChange={(e) => setGenTrainingGoals(e.target.value)}
            fullWidth
            size="small"
            placeholder="例如：练习用 ROI 切入并建立信任，应对集成复杂异议"
            sx={{ mb: 2 }}
          />

          {genError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {genError}
            </Alert>
          )}
          {genDone && (
            <Alert severity="success" sx={{ mb: 2 }}>
              草稿已生成并填充到下方表单，可继续按需编辑。
            </Alert>
          )}

          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateDraft}
            disabled={isGenerating}
            startIcon={isGenerating && <CircularProgress size={20} color="inherit" />}
          >
            {isGenerating ? "生成中…" : "AI 生成草稿"}
          </Button>
        </Paper>

        {/* ステッパー */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* 現在のステップのコンテンツ */}
        <Box sx={{ mt: 2, mb: 4 }}>
          {activeStep === 0 && (
            <BasicInfoStep
              formData={formData}
              updateFormData={(data) => setFormData({ ...formData, ...data })}
              validationErrors={validationErrors.basicInfo}
            />
          )}
          {activeStep === 1 && (
            <NPCInfoStep
              formData={{ ...formData, npc: formData.npc, language: formData.language }}
              updateFormData={(npcData) => {
                const { initialMessage, ...npcFields } = npcData;
                setFormData({
                  ...formData,
                  npc: { ...formData.npc, ...npcFields },
                  ...(initialMessage !== undefined && { initialMessage }),
                });
              }}
              validationErrors={validationErrors.npcInfo}
              avatarFile={avatarFile}
              avatarFileName={avatarFile?.name}
              onAvatarFileChange={setAvatarFile}
              voiceId={voiceId}
              onVoiceIdChange={setVoiceId}
              enableAvatar={enableAvatar}
              onEnableAvatarChange={setEnableAvatar}
            />
          )}
          {activeStep === 2 && (
            <GoalsStep
              formData={formData}
              updateFormData={(data) => setFormData({ ...formData, ...data })}
              validationErrors={validationErrors.goals}
            />
          )}
          {activeStep === 3 && (
            <PdfFilesStep
              formData={{
                scenarioId: tempUploadId,
                pdfFiles: formData.pdfFiles,
              }}
              updateFormData={(data) =>
                setFormData({
                  ...formData,
                  pdfFiles: data.pdfFiles || formData.pdfFiles,
                })
              }
            />
          )}
          {activeStep === 4 && (
            <PresentationStep
              formData={{
                scenarioId: tempUploadId,
                presentationFile: formData.presentationFile,
              }}
              updateFormData={(data) =>
                setFormData({
                  ...formData,
                  presentationFile: data.presentationFile,
                })
              }
            />
          )}
          {activeStep === 5 && (
            <SharingStep
              formData={{
                visibility: formData.visibility,
                sharedWithUsers: formData.sharedWithUsers,
                guardrail: formData.guardrail,
              }}
              guardrailsList={guardrailsList}
              updateFormData={(data) =>
                setFormData({
                  ...formData,
                  visibility: data.visibility || formData.visibility,
                  sharedWithUsers:
                    data.sharedWithUsers || formData.sharedWithUsers,
                  guardrail: data.guardrail || formData.guardrail,
                })
              }
              validationErrors={validationErrors.sharing}
            />
          )}
          {activeStep === 6 && <PreviewStep formData={formData} />}
        </Box>

        {/* ナビゲーションボタン */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
          <Button
            variant="outlined"
            onClick={activeStep === 0 ? handleCancel : handleBack}
            sx={{ mr: 1 }}
            disabled={isSubmitting}
            data-testid={activeStep === 0 ? "cancel-button" : "back-button"}
          >
            {activeStep === 0 ? t("common.cancel") : t("common.back")}
          </Button>

          <Box>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                startIcon={
                  isSubmitting && <CircularProgress size={24} color="inherit" />
                }
              >
                {isSubmitting ? t("common.saving") : t("scenarios.create.save")}
              </Button>
            ) : (
              <Button variant="contained" color="primary" onClick={handleNext}>
                {t("common.next")}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ScenarioCreatePage;
