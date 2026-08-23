import React from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  AlertTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * 状态展示组件的属性
 */
interface ReferenceCheckStatusProps {
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string;
  hasData: boolean;
}

/**
 * 引用检查的状态展示组件
 */
const ReferenceCheckStatus: React.FC<ReferenceCheckStatusProps> = ({
  isLoading,
  isAnalyzing,
  error,
  hasData,
}) => {
  const { t } = useTranslation();

  // 加载状态或分析中状态
  if (isLoading || isAnalyzing) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 4,
        }}
      >
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          {t("referenceCheck.analyzing", "正在执行引用检查...")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t(
            "referenceCheck.analyzingDescription",
            "正在确认与文档的一致性",
          )}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, fontStyle: "italic" }}
        >
          {t(
            "referenceCheck.analyzingNote",
            "※ 处理可能需要一些时间，请稍候。",
          )}
        </Typography>
      </Box>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>{t("referenceCheck.errorTitle", "错误")}</AlertTitle>
        {error}
      </Alert>
    );
  }

  // 无数据的情况（如未上传 PDF）
  if (!hasData) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>
          {t("referenceCheck.noDataTitle", "无引用检查数据")}
        </AlertTitle>
        <Typography variant="body2">
          {t(
            "referenceCheck.noData",
            "此会话没有引用检查数据。仅当场景中上传了 PDF 资料时，才会执行引用检查。",
          )}
        </Typography>
      </Alert>
    );
  }

  return null;
};

export default ReferenceCheckStatus;
