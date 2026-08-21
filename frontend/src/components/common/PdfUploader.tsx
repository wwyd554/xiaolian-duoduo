import React, { useState, useRef } from "react";
import {
  Box,
  Typography,
  Alert,
  LinearProgress,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PictureAsPdfIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

/** アップロード済みファイル情報 */
export interface UploadedFileInfo {
  key: string;
  fileName: string;
  contentType: string;
  size?: number;
  /** 追加ステータス（提案資料の変換状態など） */
  status?: string;
}

/** アップロード処理の結果 */
export interface UploadResult {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
}

interface PdfUploaderProps {
  /** タイトル */
  title: string;
  /** 説明文 */
  description: string;
  /** 注釈テキスト */
  note?: string;
  /** アップロード済みファイル一覧 */
  files: UploadedFileInfo[];
  /** 最大ファイル数（デフォルト: 1） */
  maxFiles?: number;
  /** 複数ファイル選択を許可するか */
  multiple?: boolean;
  /** アップロード処理（呼び出し元が実装） */
  onUpload: (file: File) => Promise<UploadResult>;
  /** 削除処理（呼び出し元が実装） */
  onDelete: (index: number) => Promise<void>;
  /** ファイルリスト更新コールバック */
  onFilesChange: (files: UploadedFileInfo[]) => void;
  /** ステータス表示用のレンダラー（提案資料の変換状態など） */
  renderStatus?: (file: UploadedFileInfo) => React.ReactNode;
}

/**
 * 再利用可能なPDFアップロードコンポーネント
 *
 * 営業資料（Knowledge Base連携用）と提案資料（スライド連動用）の
 * 両方で使用される共通UIコンポーネント。
 */
const PdfUploader: React.FC<PdfUploaderProps> = ({
  title,
  description,
  note,
  files,
  maxFiles = 1,
  multiple = false,
  onUpload,
  onDelete,
  onFilesChange,
  renderStatus,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingIndices, setDeletingIndices] = useState<Set<number>>(new Set());

  const canUpload = files.length < maxFiles;

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      setError(t("common.pdfUploader.maxFilesError", { max: maxFiles }));
      return;
    }

    const toUpload = Array.from(selectedFiles).slice(0, remaining);

    // PDFのみ許可
    const nonPdf = toUpload.filter(f => f.type !== "application/pdf");
    if (nonPdf.length > 0) {
      setError(t("common.pdfUploader.onlyPdfError"));
      return;
    }

    // 100MB上限
    const tooLarge = toUpload.filter(f => f.size > 100 * 1024 * 1024);
    if (tooLarge.length > 0) {
      setError(t("common.pdfUploader.tooLargeError"));
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const newFiles: UploadedFileInfo[] = [];
      const step = 80 / toUpload.length;

      for (let i = 0; i < toUpload.length; i++) {
        setUploadProgress(10 + step * i);
        const result = await onUpload(toUpload[i]);
        newFiles.push({
          key: result.key,
          fileName: result.fileName,
          contentType: result.contentType,
          size: result.size,
        });
      }

      setUploadProgress(100);
      onFilesChange([...files, ...newFiles]);
    } catch (err) {
      console.error("PDFアップロードエラー:", err);
      setError(t("common.pdfUploader.uploadError"));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (index: number) => {
    setDeletingIndices(prev => new Set(prev).add(index));
    setError(null);

    try {
      await onDelete(index);
      const updated = [...files];
      updated.splice(index, 1);
      onFilesChange(updated);
    } catch (err) {
      console.error("ファイル削除エラー:", err);
      setError(t("common.pdfUploader.deleteError"));
    } finally {
      setDeletingIndices(prev => {
        const s = new Set(prev);
        s.delete(index);
        return s;
      });
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {description}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* アップロード済みファイル一覧 */}
      {files.length > 0 ? (
        <Paper variant="outlined" sx={{ mb: 2, maxHeight: 300, overflow: "auto" }}>
          <List disablePadding>
            {files.map((file, index) => (
              <ListItem
                key={file.key || index}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={t("common.delete")}
                    onClick={() => handleDelete(index)}
                    disabled={deletingIndices.has(index)}
                    color="error"
                    size="small"
                  >
                    {deletingIndices.has(index) ? (
                      <CircularProgress size={18} />
                    ) : (
                      <DeleteIcon />
                    )}
                  </IconButton>
                }
              >
                <PictureAsPdfIcon color="error" sx={{ mr: 2 }} />
                <ListItemText
                  primary={file.fileName}
                  secondary={
                    <>
                      {formatFileSize(file.size)}
                      {renderStatus ? renderStatus(file) : null}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : canUpload ? (
        /* アップロードエリア（ドロップゾーン風） */
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: "center",
            cursor: isUploading ? "default" : "pointer",
            mb: 2,
            "&:hover": isUploading
              ? {}
              : { borderColor: "primary.main", bgcolor: "action.hover" },
          }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={t("common.pdfUploader.uploadArea")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isUploading) fileInputRef.current?.click();
            }
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography variant="body1" gutterBottom>
            {t("common.pdfUploader.uploadPrompt")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("common.pdfUploader.uploadHint", { max: maxFiles })}
          </Typography>
        </Paper>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("common.pdfUploader.maxReached", { max: maxFiles })}
        </Typography>
      )}

      {/* アップロード進捗 */}
      {isUploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            aria-label={t("common.pdfUploader.uploading")}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>
            {t("common.pdfUploader.uploading")}
          </Typography>
        </Box>
      )}

      {/* 隠しファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple={multiple}
        style={{ display: "none" }}
        onChange={handleFileSelect}
        aria-hidden="true"
      />

      {note && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {note}
        </Typography>
      )}
    </Box>
  );
};

export default PdfUploader;
