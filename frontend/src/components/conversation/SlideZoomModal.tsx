import React, { useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
} from "@mui/material";
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SlideImageInfo } from "../../types/api";

interface SlideZoomModalProps {
  /** モーダル表示状態 */
  open: boolean;
  /** スライド画像一覧 */
  slides: SlideImageInfo[];
  /** 現在表示中のスライドインデックス */
  currentIndex: number;
  /** 提示済みスライドのページ番号リスト */
  presentedPages: number[];
  /** スライド変更コールバック */
  onSlideChange: (index: number) => void;
  /** 提示ボタン押下時のコールバック */
  onPresent: (pageNumber: number) => void;
  /** 提示取消ボタン押下時のコールバック */
  onUnpresent: (pageNumber: number) => void;
  /** モーダル閉じるコールバック */
  onClose: () => void;
}

/**
 * スライド拡大モーダル
 * スライドを大きく表示し、前後のスライドに移動可能
 */
const SlideZoomModal: React.FC<SlideZoomModalProps> = ({
  open,
  slides,
  currentIndex,
  presentedPages,
  onSlideChange,
  onPresent,
  onUnpresent,
  onClose,
}) => {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement>(null);

  const currentSlide = slides[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < slides.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) onSlideChange(currentIndex - 1);
  }, [hasPrev, currentIndex, onSlideChange]);

  const handleNext = useCallback(() => {
    if (hasNext) onSlideChange(currentIndex + 1);
  }, [hasNext, currentIndex, onSlideChange]);

  // キーボードナビゲーション
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト入力中やボタンフォーカス中はスキップ
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable) {
        return;
      }
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrev, handleNext]);

  if (!currentSlide) return null;

  const isCurrentPresented = presentedPages.includes(currentSlide.pageNumber);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="slide-zoom-title"
    >
      <DialogTitle
        id="slide-zoom-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 1.5,
          bgcolor: "grey.900",
          color: "white",
        }}
      >
        <Typography variant="body2">
          {t("conversation.slideZoom.title", {
            current: currentSlide.pageNumber,
            total: slides.length,
          })}
          {isCurrentPresented && (
            <Typography component="span" variant="body2" sx={{ ml: 1, color: "success.light" }}>
              ✓ {t("conversation.slideTray.presented")}
            </Typography>
          )}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label={t("common.close")}
          sx={{ color: "white" }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 0,
          bgcolor: "#1a1a2e",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        {/* スライド画像 */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            p: 2,
          }}
        >
          {currentSlide.imageUrl ? (
            <Box
              component="img"
              ref={imgRef}
              src={currentSlide.imageUrl}
              alt={t("conversation.slideZoom.slideAlt", {
                page: currentSlide.pageNumber,
              })}
              sx={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 1,
                border: isCurrentPresented ? 6 : 0,
                borderColor: "success.main",
                transition: "border-color 0.2s",
              }}
            />
          ) : (
            <Typography color="grey.500">
              {t("conversation.slideZoom.noImage")}
            </Typography>
          )}
        </Box>

        {/* ナビゲーション + 提示ボタン */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            py: 1.5,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            width: "100%",
          }}
        >
          <IconButton
            onClick={handlePrev}
            disabled={!hasPrev}
            aria-label={t("conversation.slideZoom.prev")}
            sx={{ color: "white", "&.Mui-disabled": { color: "grey.700" } }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body2" color="grey.400">
            {currentSlide.pageNumber} / {slides.length}
          </Typography>
          <IconButton
            onClick={handleNext}
            disabled={!hasNext}
            aria-label={t("conversation.slideZoom.next")}
            sx={{ color: "white", "&.Mui-disabled": { color: "grey.700" } }}
          >
            <ChevronRightIcon />
          </IconButton>

          <Box sx={{ mx: 1, height: 24, borderLeft: "1px solid rgba(255,255,255,0.2)" }} />

          <Button
            variant={isCurrentPresented ? "outlined" : "contained"}
            size="small"
            color={isCurrentPresented ? "error" : "primary"}
            onClick={() => {
              if (isCurrentPresented) {
                onUnpresent(currentSlide.pageNumber);
              } else {
                onPresent(currentSlide.pageNumber);
              }
            }}
            aria-label={
              isCurrentPresented
                ? t("conversation.slideTray.unpresent")
                : t("conversation.slideTray.present")
            }
            sx={{ fontSize: "0.8rem" }}
          >
            {isCurrentPresented
              ? `✕ ${t("conversation.slideTray.unpresentBtn")}`
              : `☑ ${t("conversation.slideTray.presentBtn")}`}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default SlideZoomModal;
