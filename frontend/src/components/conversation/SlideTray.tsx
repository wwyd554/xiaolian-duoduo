import React, { useCallback } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  ZoomIn as ZoomInIcon,
  CheckCircle as CheckCircleIcon,
  ClearAll as ClearAllIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SlideImageInfo } from "../../types/api";

interface SlideTrayProps {
  /** 幻灯片图片列表 */
  slides: SlideImageInfo[];
  /** 当前选中的幻灯片索引（从 0 开始） */
  currentIndex: number;
  /** 已选择幻灯片的页码列表 */
  presentedPages: number[];
  /** 幻灯片选择变化时的回调（点击切换） */
  onSlideSelect: (index: number) => void;
  /** 添加选择回调 */
  onPresent: (pageNumber: number) => void;
  /** 取消选择回调 */
  onUnpresent: (pageNumber: number) => void;
  /** 全部取消选择回调 */
  onClearAll: () => void;
  /** 点击放大按钮时的回调 */
  onZoom: () => void;
}

/**
 * 幻灯片托盘组件
 * 点击缩略图切换选择/取消
 */
const SlideTray: React.FC<SlideTrayProps> = ({
  slides,
  currentIndex,
  presentedPages,
  onSlideSelect,
  onPresent,
  onUnpresent,
  onClearAll,
  onZoom,
}) => {
  const { t } = useTranslation();

  const handleThumbnailClick = useCallback(
    (index: number, pageNumber: number) => {
      onSlideSelect(index);
      // 点击切换选择/取消
      if (presentedPages.includes(pageNumber)) {
        onUnpresent(pageNumber);
      } else {
        onPresent(pageNumber);
      }
    },
    [presentedPages, onSlideSelect, onPresent, onUnpresent],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number, pageNumber: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleThumbnailClick(index, pageNumber);
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        onSlideSelect(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < slides.length - 1) {
        e.preventDefault();
        onSlideSelect(currentIndex + 1);
      }
    },
    [currentIndex, slides.length, onSlideSelect, handleThumbnailClick],
  );

  if (slides.length === 0) return null;

  const hasSelections = presentedPages.length > 0;

  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.50",
        px: 1.5,
        py: 1,
      }}
      role="region"
      aria-label={t("conversation.slideTray.label")}
    >
      {/* 顶部行 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          📄 {t("conversation.slideTray.title")}
        </Typography>
        <Tooltip title={t("conversation.slideTray.zoom")}>
          <IconButton
            size="small"
            onClick={onZoom}
            aria-label={t("conversation.slideTray.zoom")}
            sx={{ p: 0.25 }}
          >
            <ZoomInIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {hasSelections && (
          <>
            <Typography variant="caption" color="success.main" sx={{ ml: 0.5 }}>
              {t("conversation.slideTray.selectedCount", { count: presentedPages.length })}
            </Typography>
            <Tooltip title={t("conversation.slideTray.clearAll")}>
              <IconButton
                size="small"
                onClick={onClearAll}
                aria-label={t("conversation.slideTray.clearAll")}
                sx={{ p: 0.25, color: "text.secondary" }}
              >
                <ClearAllIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* 缩略图列表（点击切换） */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, overflowX: "auto" }} role="listbox" aria-multiselectable="true" aria-label={t("conversation.slideTray.label")}>
        {slides.map((slide, index) => {
          const isPresented = presentedPages.includes(slide.pageNumber);

          return (
            <Tooltip
              key={slide.pageNumber}
              title={`${t("conversation.slideTray.slide")} ${slide.pageNumber}${isPresented ? ` ✓` : ""} — ${t("conversation.slideTray.clickToToggle")}`}
            >
              <Box
                onClick={() => handleThumbnailClick(index, slide.pageNumber)}
                tabIndex={0}
                role="option"
                aria-selected={isPresented}
                aria-label={`${t("conversation.slideTray.slide")} ${slide.pageNumber}`}
                onKeyDown={(e) => handleKeyDown(e, index, slide.pageNumber)}
                sx={{
                  width: 80,
                  height: 56,
                  borderRadius: 0.5,
                  overflow: "hidden",
                  cursor: "pointer",
                  flexShrink: 0,
                  position: "relative",
                  border: 2,
                  borderColor: isPresented ? "success.main" : "grey.300",
                  opacity: isPresented ? 1 : 0.6,
                  transition: "all 0.15s",
                  "&:hover": {
                    opacity: 1,
                    borderColor: isPresented ? "success.dark" : "primary.light",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                {slide.thumbnailUrl ? (
                  <Box
                    component="img"
                    src={slide.thumbnailUrl}
                    alt={`${t("conversation.slideTray.slide")} ${slide.pageNumber}`}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      bgcolor: "#1a1a2e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#aaa",
                      fontSize: "0.6rem",
                    }}
                  >
                    {slide.pageNumber}
                  </Box>
                )}
                {isPresented && (
                  <CheckCircleIcon
                    sx={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      fontSize: 16,
                      color: "success.main",
                      bgcolor: "white",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export default SlideTray;
