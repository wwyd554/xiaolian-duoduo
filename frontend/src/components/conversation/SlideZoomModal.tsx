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
  /** 弹窗显示状态 */
  open: boolean;
  /** 幻灯片图片列表 */
  slides: SlideImageInfo[];
  /** 当前显示的幻灯片索引 */
  currentIndex: number;
  /** 已展示幻灯片的页码列表 */
  presentedPages: number[];
  /** 幻灯片变更回调 */
  onSlideChange: (index: number) => void;
  /** 点击展示按钮时的回调 */
  onPresent: (pageNumber: number) => void;
  /** 点击取消展示按钮时的回调 */
  onUnpresent: (pageNumber: number) => void;
  /** 弹窗关闭回调 */
  onClose: () => void;
}

/**
 * 幻灯片放大弹窗
 * 放大显示幻灯片，可在前后幻灯片间切换
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

  // 键盘导航
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // 文本输入中或按钮聚焦中时跳过
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
        {/* 幻灯片图片 */}
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

        {/* 导航 + 展示按钮 */}
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
