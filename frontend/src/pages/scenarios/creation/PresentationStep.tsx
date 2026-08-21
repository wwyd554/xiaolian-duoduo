import React, { useCallback } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiService } from "../../../services/ApiService";
import type { PresentationFileInfo } from "../../../types/api";
import PdfUploader from "../../../components/common/PdfUploader";
import type { UploadedFileInfo, UploadResult } from "../../../components/common/PdfUploader";

interface PresentationStepProps {
  formData: {
    scenarioId: string;
    presentationFile?: PresentationFileInfo;
  };
  updateFormData: (data: { presentationFile?: PresentationFileInfo }) => void;
}

const PresentationStep: React.FC<PresentationStepProps> = ({
  formData,
  updateFormData,
}) => {
  const { t } = useTranslation();
  const apiService = ApiService.getInstance();

  // 提案資料をUploadedFileInfo[]形式に変換（PdfUploaderのインターフェースに合わせる）
  const files: UploadedFileInfo[] = formData.presentationFile
    ? [{
      key: formData.presentationFile.key,
      fileName: formData.presentationFile.fileName,
      contentType: formData.presentationFile.contentType,
      size: formData.presentationFile.size,
      status: formData.presentationFile.status,
    }]
    : [];

  const handleUpload = useCallback(async (file: File): Promise<UploadResult> => {
    const sid = formData.scenarioId || `temp-${Date.now()}`;
    const urlInfo = await apiService.getPresentationUploadUrl(sid, file.name, "application/pdf");
    await apiService.uploadPresentationFile(urlInfo.uploadUrl, urlInfo.formData, file);

    // スライド変換はシナリオ作成後にScenarioCreatePage.handleSubmitで実行するため、
    // ここではS3アップロードのみ行い、ステータスをuploadedに設定
    updateFormData({
      presentationFile: {
        key: urlInfo.key,
        fileName: file.name,
        contentType: "application/pdf",
        size: file.size,
        status: "ready",
      },
    });

    return { key: urlInfo.key, fileName: file.name, contentType: "application/pdf", size: file.size };
  }, [apiService, formData.scenarioId, updateFormData]);

  const handleDelete = useCallback(async () => {
    const sid = formData.scenarioId || "";
    if (sid) {
      await apiService.deletePresentationFile(sid);
    }
  }, [apiService, formData.scenarioId]);

  const handleFilesChange = useCallback((updatedFiles: UploadedFileInfo[]) => {
    if (updatedFiles.length === 0) {
      updateFormData({ presentationFile: undefined });
    }
    // アップロード時はhandleUpload内でupdateFormDataを直接呼ぶため、ここでは削除時のみ処理
  }, [updateFormData]);

  // ステータス表示用レンダラー
  const renderStatus = useCallback((file: UploadedFileInfo) => {
    if (!file.status) return null;
    const statusLabels: Record<string, string> = {
      converting: ` — ${t("scenarios.create.presentation.converting")}`,
      ready: ` — ${t("scenarios.create.presentation.ready")}`,
      error: ` — ${t("scenarios.create.presentation.conversionError")}`,
    };
    return <Typography component="span" variant="caption">{statusLabels[file.status] || ""}</Typography>;
  }, [t]);

  return (
    <PdfUploader
      title={t("scenarios.create.presentation.title")}
      description={t("scenarios.create.presentation.description")}
      note={t("scenarios.create.presentation.note")}
      files={files}
      maxFiles={1}
      multiple={false}
      onUpload={handleUpload}
      onDelete={handleDelete}
      onFilesChange={handleFilesChange}
      renderStatus={renderStatus}
    />
  );
};

export default PresentationStep;
