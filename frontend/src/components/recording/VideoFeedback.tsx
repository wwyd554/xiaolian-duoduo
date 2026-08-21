import React from "react";
import {
  Box,
  Typography,
  Alert,
  LinearProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { VideoAnalysisResult } from "../../types/api";

interface VideoFeedbackProps {
  isVisible?: boolean;
  /** Step Functionsで取得済みの動画分析結果（渡された場合はAPIを呼び出さない） */
  initialData?: VideoAnalysisResult | null;
}

/**
 * 動画分析結果表示コンポーネント
 */
const VideoFeedback: React.FC<VideoFeedbackProps> = ({
  isVisible = true,
  initialData = null,
}) => {
  const { t } = useTranslation();

  // コンポーネントが非表示の場合は何も表示しない
  if (!isVisible) {
    return null;
  }

  return (
    <Box>
      {initialData ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            📹 {t("videoFeedback.title")}
          </Typography>

          {/* 総合スコア */}
          <Box sx={{ mb: 3, textAlign: "center" }}>
            <Typography variant="h4" color="primary" gutterBottom>
              {initialData.overallScore}/10
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("videoFeedback.overallScore")}
            </Typography>
          </Box>

          {/* 詳細スコア */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t("videoFeedback.detailedEvaluation")}
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography variant="body2">
                  {t("videoFeedback.eyeContact")}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {initialData.eyeContact}/10
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(initialData.eyeContact / 10) * 100}
                color="primary"
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography variant="body2">
                  {t("videoFeedback.facialExpression")}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {initialData.facialExpression}/10
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(initialData.facialExpression / 10) * 100}
                color="secondary"
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography variant="body2">
                  {t("videoFeedback.gesture")}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {initialData.gesture}/10
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(initialData.gesture / 10) * 100}
                color="success"
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography variant="body2">
                  {t("videoFeedback.emotion")}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {initialData.emotion}/10
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(initialData.emotion / 10) * 100}
                color="warning"
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          </Box>

          {/* 強み */}
          {initialData.strengths.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                ✅ {t("videoFeedback.strengths")}
              </Typography>
              {Array.isArray(initialData.strengths) &&
                initialData.strengths.map((strength, index) => (
                  <Alert key={index} severity="success" sx={{ mb: 1 }}>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: "bold" }}
                      >
                        {strength.title}
                      </Typography>
                      <Typography variant="body2">
                        {strength.description}
                      </Typography>
                    </Box>
                  </Alert>
                ))}
            </Box>
          )}

          {/* 改善点 */}
          {initialData.improvements.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                💡 {t("videoFeedback.improvements")}
              </Typography>
              {Array.isArray(initialData.improvements) &&
                initialData.improvements.map((improvement, index) => (
                  <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: "bold" }}
                      >
                        {improvement.title}
                      </Typography>
                      <Typography variant="body2">
                        {improvement.description}
                      </Typography>
                    </Box>
                  </Alert>
                ))}
            </Box>
          )}

          {/* 詳細分析 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              📊 {t("videoFeedback.analysis")}
            </Typography>
            <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {initialData.analysis}
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : (
        // 動画分析データがない場合は「データなし」を表示
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="medium">
            {t("videoFeedback.noDataTitle", "動画分析データなし")}
          </Typography>
          <Typography variant="body2">
            {t(
              "videoFeedback.noData",
              "このセッションには動画分析データがありません。セッション中にカメラで録画された場合のみ、動画分析が実行されます。",
            )}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default VideoFeedback;
