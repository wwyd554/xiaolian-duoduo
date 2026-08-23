import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ApiService } from "../../../services/ApiService";
import { PdfFileInfo } from "../../../types/api";
import PdfUploader from "../../../components/common/PdfUploader";
import type { UploadedFileInfo, UploadResult } from "../../../components/common/PdfUploader";

interface PdfFilesStepProps {
  formData: {
    scenarioId?: string;
    pdfFiles: PdfFileInfo[];
  };
  updateFormData: (data: { pdfFiles: PdfFileInfo[] }) => void;
}

const PdfFilesStep: React.FC<PdfFilesStepProps> = ({
  formData,
  updateFormData,
}) => {
  const { t } = useTranslation();
  const apiService = ApiService.getInstance();

  const handleUpload = useCallback(async (file: File): Promise<UploadResult> => {
    const sid = formData.scenarioId || `temp-${Date.now()}`;
    const pdfUrlInfo = await apiService.getPdfUploadUrl(sid, file.name, file.type);
    await apiService.uploadPdfFile(pdfUrlInfo.uploadUrl, pdfUrlInfo.formData, file, file.type);

    const metadataFileName = `${file.name}.metadata.json`;
    const metadataUrlInfo = await apiService.getPdfMetadataUploadUrl(sid, metadataFileName);
    await apiService.uploadPdfMetadata(
      metadataUrlInfo.uploadUrl,
      metadataUrlInfo.formData,
      { metadataAttributes: { scenarioId: sid } },
    );

    return { key: pdfUrlInfo.key, fileName: file.name, contentType: file.type, size: file.size };
  }, [apiService, formData.scenarioId]);

  const handleDelete = useCallback(async (index: number) => {
    const fileToDelete = formData.pdfFiles[index];
    const sid = formData.scenarioId || `temp-${Date.now()}`;
    await apiService.deletePdfWithMetadata(sid, fileToDelete.fileName);
  }, [apiService, formData.pdfFiles, formData.scenarioId]);

  const handleFilesChange = useCallback((files: UploadedFileInfo[]) => {
    updateFormData({
      pdfFiles: files.map(f => ({
        key: f.key,
        fileName: f.fileName,
        contentType: f.contentType,
        size: f.size,
      })),
    });
  }, [updateFormData]);

  return (
    <PdfUploader
      title={t("scenarios.create.pdfFiles.title") || "上传销售资料（用于评估）"}
      description={t("scenarios.create.pdfFiles.description") || "以 PDF 形式上传销售资料后，会话后的评估可自动检查发言内容的准确性。（最多 5 个）"}
      note={t("scenarios.create.pdfFiles.note") || "※ 上传的 PDF 将用于销售会话后的参考检查"}
      files={formData.pdfFiles}
      maxFiles={5}
      multiple
      onUpload={handleUpload}
      onDelete={handleDelete}
      onFilesChange={handleFilesChange}
    />
  );
};

export default PdfFilesStep;
