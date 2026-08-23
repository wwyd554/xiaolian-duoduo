import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
} from "@mui/material";
import { ApiService } from "../../services/ApiService";
import { AvatarService } from "../../services/AvatarService";
import { useTranslation } from "react-i18next";

// 导入步骤组件
import BasicInfoStep from "./creation/BasicInfoStep";
import NPCInfoStep from "./creation/NPCInfoStep";
import GoalsStep from "./creation/GoalsStep";
import PdfFilesStep from "./creation/PdfFilesStep";
import PresentationStep from "./creation/PresentationStep";
import SharingStep from "./creation/SharingStep";
import PreviewStep from "./creation/PreviewStep";
import { DifficultyLevel, PresentationFileInfo } from "../../types/api";

// 场景编辑页面
const ScenarioEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const apiService = ApiService.getInstance();

  // 步骤管理
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardrailsList, setGuardrailsList] = useState<
    Array<{
      arn: string;
      id: string;
      name: string;
      description: string;
    }>
  >([]);

  // 头像、语音模型管理
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState<string>("");
  const [enableAvatar, setEnableAvatar] = useState<boolean>(false);
  const [existingAvatarId, setExistingAvatarId] = useState<string | undefined>(undefined);
  const [existingAvatarFileName, setExistingAvatarFileName] = useState<string | undefined>(undefined);
  // CR-010: 字段级校验错误
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({});

  // 表单数据
  const [formData, setFormData] = useState({
    // 基本信息
    scenarioId: "",
    title: "",
    description: "",
    difficulty: "normal" as DifficultyLevel,
    category: "",
    language: "zh", // 默认中文
    maxTurns: 10, // 设置默认值

    // NPC情報
    npc: {
      name: "",
      role: "",
      company: "",
      personality: [] as string[],
      description: "",
    },

    // 指标
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

    // 設定
    visibility: "private" as "public" | "private" | "shared",
    sharedWithUsers: [] as string[],
    guardrail: "",
    initialMessage: "",

    // 提案資料
    presentationFile: undefined as PresentationFileInfo | undefined,
  });

  // 初期化処理
  useEffect(() => {
    if (!scenarioId) {
      setError(t("scenarios.edit.error.noScenarioId"));
      setIsLoading(false);
      return;
    }

    // 加载场景数据和护栏
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 加载护栏
        const guardrails = await apiService.getGuardrails();
        setGuardrailsList(guardrails);

        // 加载场景数据
        const scenarioData = await apiService.getScenarioDetail(scenarioId);

        // 设置表单数据
        setFormData({
          scenarioId: scenarioData.scenarioId,
          title: scenarioData.title || "",
          description: scenarioData.description || "",
          difficulty: scenarioData.difficulty,
          category: scenarioData.category || scenarioData.industry || "",
          language: scenarioData.language || "zh",
          maxTurns: scenarioData.maxTurns || 10,

          npc: {
            name: scenarioData.npc?.name || scenarioData.npcInfo?.name || "",
            role: scenarioData.npc?.role || scenarioData.npcInfo?.role || "",
            company:
              scenarioData.npc?.company || scenarioData.npcInfo?.company || "",
            personality:
              scenarioData.npc?.personality ||
              scenarioData.npcInfo?.personality ||
              [],
            description:
              scenarioData.npc?.description ||
              scenarioData.npcInfo?.description ||
              "",
          },

          initialMetrics: {
            angerLevel: Number(scenarioData.initialMetrics?.angerLevel) || 1,
            trustLevel: Number(scenarioData.initialMetrics?.trustLevel) || 3,
            progressLevel:
              Number(scenarioData.initialMetrics?.progressLevel) || 2,
          },

          // PDF資料情報
          pdfFiles: scenarioData.pdfFiles || [],

          // 提案資料情報
          presentationFile: scenarioData.presentationFile || undefined,

          goals: (scenarioData.goals || []).map((goal) => ({
            id: goal.id,
            description: goal.description,
            isRequired: goal.isRequired ?? true,
            priority: Number(goal.priority) || 3,
            criteria: goal.criteria || [],
          })),
          visibility: scenarioData.visibility || "private",
          sharedWithUsers: scenarioData.sharedWithUsers || [],
          guardrail: scenarioData.guardrail || "",
          initialMessage: scenarioData.initialMessage || "",
        });

        // 恢复 voiceId 和 avatarId
        const loadedVoiceId = scenarioData.npc?.voiceId || scenarioData.npcInfo?.voiceId || "";
        setVoiceId(loadedVoiceId);
        // 恢复 enableAvatar 值（未设置时默认为 false）
        setEnableAvatar(scenarioData.enableAvatar ?? false);
        if (scenarioData.avatarId) {
          setExistingAvatarId(scenarioData.avatarId);
          // 文件名从头像 ID 推断（用于显示）
          setExistingAvatarFileName(scenarioData.avatarId);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("数据加载错误:", error);
        setError(
          error instanceof Error
            ? error.message
            : t("scenarios.edit.error.loadFailed"),
        );
        setIsLoading(false);
      }
    };

    loadData();
  }, [scenarioId, t, apiService]);

  // 步骤的定义
  const steps = [
    {
      label: t("scenarios.create.steps.basicInfo"),
      component: (
        <BasicInfoStep
          formData={formData}
          updateFormData={(data) => setFormData({ ...formData, ...data })}
          isEditMode={true}
        />
      ),
    },
    {
      label: t("scenarios.create.steps.npcInfo"),
      component: (
        <NPCInfoStep
          formData={{ ...formData, npc: formData.npc, language: formData.language }}
          updateFormData={(npcData) => {
            // 分别处理 initialMessage 单独更新和 NPC 字段更新的情况
            if ('initialMessage' in npcData && Object.keys(npcData).length === 1) {
              // 仅更新 initialMessage 时
              setFormData({
                ...formData,
                initialMessage: npcData.initialMessage || "",
              });
            } else {
              // 包含 NPC 字段时（原有处理）
              const { initialMessage, ...npcFields } = npcData;
              setFormData({
                ...formData,
                npc: { ...formData.npc, ...npcFields },
                ...(initialMessage !== undefined && { initialMessage }),
              });
            }
          }}
          validationErrors={validationErrors}
          avatarFile={avatarFile}
          avatarFileName={avatarFile?.name || existingAvatarFileName}
          onAvatarFileChange={(file) => {
            setAvatarFile(file);
            if (file === null) {
              // 删除文件时同时清除既有头像信息
              setExistingAvatarFileName(undefined);
            }
          }}
          voiceId={voiceId}
          onVoiceIdChange={setVoiceId}
          enableAvatar={enableAvatar}
          onEnableAvatarChange={(enabled) => {
            setEnableAvatar(enabled);
            // 头像关闭时清除头像文件信息
            if (!enabled) {
              setAvatarFile(null);
              setExistingAvatarFileName(undefined);
            }
          }}
        />
      ),
    },
    {
      label: t("scenarios.create.steps.goals"),
      component: (
        <GoalsStep
          formData={formData}
          updateFormData={(data) => setFormData({ ...formData, ...data })}
        />
      ),
    },
    {
      label: t("scenarios.create.steps.pdfs") || "PDF資料",
      component: (
        <PdfFilesStep
          formData={{
            scenarioId: scenarioId,
            pdfFiles: formData.pdfFiles,
          }}
          updateFormData={(data) =>
            setFormData({
              ...formData,
              pdfFiles: data.pdfFiles || formData.pdfFiles,
            })
          }
        />
      ),
    },
    {
      label: t("scenarios.create.steps.presentation"),
      component: (
        <PresentationStep
          formData={{
            scenarioId: scenarioId || "",
            presentationFile: formData.presentationFile,
          }}
          updateFormData={(data) =>
            setFormData({
              ...formData,
              presentationFile: data.presentationFile,
            })
          }
        />
      ),
    },
    {
      label: t("scenarios.create.steps.sharing"),
      component: (
        <SharingStep
          formData={formData}
          guardrailsList={guardrailsList}
          updateFormData={(data) => setFormData({ ...formData, ...data })}
        />
      ),
    },
    {
      label: t("scenarios.create.steps.preview"),
      component: <PreviewStep formData={formData} />,
    },
  ];

  // 进入下一步
  const handleNext = () => {
    // 在 NPC 信息步骤（步骤 1）中对 voiceId 进行必填校验
    // CR-010: 与 Create 页面统一为相同的字段级校验
    if (activeStep === 1) {
      if (!voiceId) {
        setValidationErrors({ voiceId: "scenarios.validation.voiceIdRequired" });
        setError(null);
        return;
      }
      setValidationErrors({});
      setError(null);
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  // 返回上一步
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // 更新场景
  const handleSubmit = async () => {
    if (!scenarioId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 头像上传/替换处理
      let avatarId: string | undefined = existingAvatarId;
      const avatarService = AvatarService.getInstance();

      if (avatarFile) {
        // 有新文件时：先上传新头像 → 成功后再删除旧头像
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

        // 新头像确认后再删除旧头像
        if (existingAvatarId) {
          try {
            await avatarService.deleteAvatar(existingAvatarId);
          } catch (deleteError) {
            console.warn("旧头像删除错误（孤立资源）:", deleteError);
          }
        }
      } else if (!avatarFile && !existingAvatarFileName && existingAvatarId) {
        // 文件被删除时：删除旧头像
        try {
          await avatarService.deleteAvatar(existingAvatarId);
        } catch (deleteError) {
          console.warn("旧头像删除错误（继续）:", deleteError);
        }
        avatarId = undefined;
      }

      // 为 API 请求整理数据
      const scenarioData = {
        title: formData.title,
        description: formData.description,
        difficulty: formData.difficulty,
        category: formData.category,
        maxTurns: formData.maxTurns,
        npc: { ...formData.npc, voiceId },
        initialMetrics: formData.initialMetrics,
        goals: formData.goals,
        // 发送 undefined 让后端将其解释为「字段未更新」（[] 表示删除全部 PDF）
        pdfFiles: formData.pdfFiles?.length > 0 ? formData.pdfFiles : undefined,
        presentationFile: formData.presentationFile || undefined,
        visibility: formData.visibility,
        guardrail: formData.guardrail,
        initialMessage: formData.initialMessage,
        enableAvatar,
        ...(avatarId !== undefined ? { avatarId } : {}),
        ...(formData.visibility === "shared"
          ? { sharedWithUsers: formData.sharedWithUsers }
          : {}),
      };

      // 通过 API 更新场景
      await apiService.updateScenario(scenarioId, scenarioData);

      // 成功时
      navigate("/scenarios", {
        state: {
          success: true,
          message: t("scenarios.edit.success"),
          scenarioId,
        },
      });
    } catch (error) {
      console.error("场景更新错误:", error);
      setError(
        error instanceof Error
          ? error.message
          : t("scenarios.edit.error.unknown"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 取消处理
  const handleCancel = () => {
    if (window.confirm(t("scenarios.edit.confirmCancel"))) {
      navigate("/scenarios");
    }
  };

  // 加载提示
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {t("common.loading")}
        </Typography>
      </Container>
    );
  }

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
          {t("scenarios.edit.title")}
        </Typography>

        {/* 错误消息 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>{t("common.error")}</AlertTitle>
            {error}
          </Alert>
        )}

        {/* 步骤条 */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* 当前步骤的内容 */}
        <Box sx={{ mt: 2, mb: 4 }}>{steps[activeStep].component}</Box>

        {/* 导航按钮 */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
          <Button
            variant="outlined"
            onClick={activeStep === 0 ? handleCancel : handleBack}
            sx={{ mr: 1 }}
            disabled={isSubmitting}
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
                {isSubmitting ? t("common.saving") : t("scenarios.edit.save")}
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

export default ScenarioEditPage;
