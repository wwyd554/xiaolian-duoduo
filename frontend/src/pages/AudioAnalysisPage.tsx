import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AudioAnalysisService } from "../services/AudioAnalysisService";
import { ApiService } from "../services/ApiService";
import {
  AudioAnalysisLanguage,
  AudioAnalysisStatusResponse,
} from "../types/audioAnalysis";
import { ScenarioInfo } from "../types/api";

/**
 * 语音分析页面
 * 上传洽谈音频数据并进行分析的页面
 */
const AudioAnalysisPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] =
    useState<AudioAnalysisLanguage>("zh");
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] =
    useState<AudioAnalysisStatusResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [analysisSessionId, setAnalysisSessionId] = useState<string>("");

  const audioAnalysisService = AudioAnalysisService.getInstance();
  const apiService = ApiService.getInstance();

  useEffect(() => {
    // 设置页面标题
    document.title = `${t("audioAnalysis.title", "语音分析")} | ${t("app.title")}`;
  }, [t]);

  useEffect(() => {
    // 获取场景列表
    const fetchScenarios = async () => {
      try {
        const response = await apiService.getScenarios();
        if (response.scenarios) {
          setScenarios(response.scenarios);
        }
      } catch (error) {
        console.error("场景获取错误:", error);
        setError("获取场景列表失败");
      }
    };

    fetchScenarios();
  }, [apiService]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 文件验证
      const validation = audioAnalysisService.validateAudioFile(file);
      if (!validation.isValid) {
        setError(validation.error || "文件格式无效");
        return;
      }

      setSelectedFile(file);
      setError("");
    }
  };

  const handleLanguageChange = (language: AudioAnalysisLanguage) => {
    setSelectedLanguage(language);
  };

  const handleScenarioChange = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile || !selectedScenario) {
      setError("请选择音频文件和场景");
      return;
    }

    try {
      setError("");
      setIsUploading(true);
      setUploadProgress(0);

      // 执行语音分析
      const result = await audioAnalysisService.executeFullAnalysis(
        selectedFile,
        selectedScenario,
        selectedLanguage,
        (progress) => {
          setUploadProgress(progress);
        },
        (status) => {
          setAnalysisStatus(status);
          if (status.status === "IN_PROGRESS") {
            setIsUploading(false);
            setIsAnalyzing(true);
          } else if (status.status === "FAILED" || status.currentStep === "ERROR") {
            // 错误时的处理
            setIsUploading(false);
            setIsAnalyzing(false);
            const errorMessage = status.progress?.error || "语音分析时发生错误";
            setError(errorMessage);
          }
        }
      );

      // 分析完了
      setIsAnalyzing(false);
      setAnalysisSessionId(result.sessionId);
      setResultDialogOpen(true);
    } catch (error) {
      console.error("音频分析错误:", error);
      setError(
        error instanceof Error ? error.message : "语音分析失败"
      );
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const handleViewResults = () => {
    setResultDialogOpen(false);
    // 跳转到已有的 ResultPage
    navigate(`/result/${analysisSessionId}`);
  };

  const getStepContent = () => {
    if (isUploading) {
      return "正在上传音频文件...";
    } else if (isAnalyzing) {
      switch (analysisStatus?.currentStep) {
        case "START":
          return "正在准备分析...";
        case "TRANSCRIBING":
          return "正在转写音频...";
        case "ANALYZING":
          return "AI 分析中...";
        case "SAVING":
          return "正在保存结果...";
        case "ERROR":
          return "分析时发生错误";
        default:
          return "分析中...";
      }
    }
    return "等待中";
  };

  const activeStep = () => {
    if (isUploading) return 0;
    if (analysisStatus?.currentStep === "START") return 1;
    if (analysisStatus?.currentStep === "TRANSCRIBING") return 2;
    if (analysisStatus?.currentStep === "ANALYZING") return 3;
    if (analysisStatus?.currentStep === "SAVING") return 4;
    if (analysisStatus?.currentStep === "ERROR") return -1; // 错误时特殊处理
    return 0;
  };

  const steps = [
    "上传",
    "分析准备",
    "语音转写",
    "AI 分析",
    "结果保存",
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ pt: 4, pb: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("audioAnalysis.title", "语音分析")}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {t(
            "audioAnalysis.description",
            "上传真实的洽谈音频数据，按所选场景进行分析。"
          )}
        </Typography>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t("audioAnalysis.settings", "分析设置")}
            </Typography>

            {/* 语言选择 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("audioAnalysis.language", "语言设置")}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  label="中文"
                  color={selectedLanguage === "zh" ? "primary" : "default"}
                  onClick={() => handleLanguageChange("zh")}
                  variant={selectedLanguage === "zh" ? "filled" : "outlined"}
                />
                <Chip
                  label="English"
                  color={selectedLanguage === "en" ? "primary" : "default"}
                  onClick={() => handleLanguageChange("en")}
                  variant={selectedLanguage === "en" ? "filled" : "outlined"}
                />
              </Box>
            </Box>

            {/* 场景选择 */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>
                  {t("audioAnalysis.selectScenario", "选择分析场景")}
                </InputLabel>
                <Select
                  value={selectedScenario}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  label={t("audioAnalysis.selectScenario", "选择分析场景")}
                >
                  {scenarios.map((scenario) => (
                    <MenuItem key={scenario.scenarioId} value={scenario.scenarioId}>
                      {scenario.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 文件选择 */}
            <Box sx={{ mb: 3 }}>
              <input
                accept="audio/*,.mp3,.wav,.flac,.ogg"
                style={{ display: "none" }}
                id="audio-file-upload"
                type="file"
                onChange={handleFileSelect}
              />
              <label htmlFor="audio-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  disabled={isUploading || isAnalyzing}
                >
                  {selectedFile
                    ? selectedFile.name
                    : t("audioAnalysis.selectFile", "选择音频文件")}
                </Button>
              </label>
            </Box>

            {/* 错误提示 */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* 开始分析按钮 */}
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartAnalysis}
              disabled={
                !selectedFile || !selectedScenario || isUploading || isAnalyzing
              }
              size="large"
            >
              {t("audioAnalysis.startAnalysis", "开始分析")}
            </Button>
          </CardContent>
        </Card>

        {/* 进度显示 */}
        {(isUploading || isAnalyzing) && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t("audioAnalysis.progress", "分析进度")}
              </Typography>

              <Stepper activeStep={activeStep()} sx={{ mb: 3 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {getStepContent()}
                </Typography>
              </Box>

              {isUploading && (
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{ mb: 2 }}
                />
              )}

              {isAnalyzing && (
                <LinearProgress variant="indeterminate" sx={{ mb: 2 }} />
              )}

              <Typography variant="caption" color="text.secondary">
                {t(
                  "audioAnalysis.processingNote",
                  "※ 处理可能需要一些时间，请勿关闭页面，请稍候。"
                )}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* 结果显示对话框 */}
        <Dialog
          open={resultDialogOpen}
          onClose={() => setResultDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {t("audioAnalysis.analysisComplete", "语音分析完成")}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {t(
                "audioAnalysis.analysisCompleteMessage",
                "语音分析已完成。要查看结果吗？"
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                "audioAnalysis.resultViewNote",
                "在分析结果页面可以查看说话人角色分析、评分、参考检查等详细信息。"
              )}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResultDialogOpen(false)}>
              {t("common.cancel", "取消")}
            </Button>
            <Button
              onClick={handleViewResults}
              variant="contained"
              color="primary"
            >
              {t("audioAnalysis.viewResults", "查看结果")}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default AudioAnalysisPage;
