import React from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  ArrowBackRounded,
  CallEndRounded,
  DashboardCustomizeRounded,
  MonitorRounded,
  SettingsRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { Scenario } from "../../types/index";
import { useTranslation } from "react-i18next";
import { calculateCurrentTurns } from "../../utils/dialogueEngine";

interface ConversationHeaderProps {
  scenario: Scenario;
  sessionStarted: boolean;
  sessionEnded: boolean;
  onManualEnd: () => void;
  messageCount: number;
  // 新增 Props：顶部栏操作按钮
  onToggleRightPanels?: () => void;
  onToggleMetrics?: () => void;
  onOpenSettings?: () => void;
  rightPanelsVisible?: boolean;
  metricsVisible?: boolean;
  onRequestExit?: () => void;
}

/**
 * 会话页面的顶部栏组件
 * 沉浸式陪练页顶部栏：品牌、场景、轮次、教练工具与结束按钮
 */
const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  scenario,
  sessionStarted,
  sessionEnded,
  onManualEnd,
  messageCount,
  onToggleRightPanels,
  onToggleMetrics,
  onOpenSettings,
  rightPanelsVisible,
  metricsVisible,
  onRequestExit,
}) => {
  const currentTurns = sessionStarted ? calculateCurrentTurns(messageCount) : 0;
  const maxTurns = scenario.maxTurns || 10;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const difficultyLabel =
    {
      easy: t("scenarios.beginner"),
      normal: t("scenarios.intermediate"),
      hard: t("scenarios.advanced"),
      expert: t("scenarios.advanced"),
    }[scenario.difficulty] || scenario.difficulty;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 0.75, sm: 1.25 },
        minHeight: { xs: 64, md: 76 },
        px: { xs: 1.25, sm: 2.5 },
        py: 1,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid",
        borderColor: "divider",
        zIndex: 50,
      }}
    >
      {/* 返回按钮 */}
      <IconButton
        onClick={() =>
          onRequestExit ? onRequestExit() : navigate("/scenarios")
        }
        aria-label={t("navigation.back")}
        size="small"
        sx={{
          width: 40,
          height: 40,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          "&:hover": { backgroundColor: "#f3f5f9" },
        }}
      >
        <ArrowBackRounded fontSize="small" />
      </IconButton>

      <Box
        component="img"
        src="/brand/xiaolian-duoduo-logo-horizontal-v1-300w.webp"
        alt="销练多多"
        sx={{
          display: { xs: "none", sm: "block" },
          width: 118,
          height: 38,
          objectFit: "contain",
          objectPosition: "left center",
          flexShrink: 0,
        }}
      />

      <Box
        aria-hidden="true"
        sx={{
          display: { xs: "none", sm: "block" },
          width: "1px",
          height: 32,
          flexShrink: 0,
          bgcolor: "divider",
          mx: 0.5,
        }}
      />

      {/* 场景信息 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <Typography
            sx={{
              fontWeight: 750,
              fontSize: { xs: 13, sm: 15 },
              lineHeight: 1.35,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {scenario.title}
          </Typography>
          <Chip
            label={difficultyLabel}
            size="small"
            sx={{
              display: { xs: "none", md: "inline-flex" },
              height: 20,
              fontSize: "0.6875rem",
              fontWeight: 600,
              bgcolor: "#fff7ed",
              color: "#c65b1a",
              borderColor: "#fed7aa",
            }}
            variant="outlined"
          />
        </Box>
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: sessionStarted && !sessionEnded ? "#25a66a" : "#9aa3b2",
              boxShadow:
                sessionStarted && !sessionEnded
                  ? "0 0 0 3px rgba(37,166,106,.12)"
                  : "none",
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {scenario.npc.name} · {scenario.npc.role}
          </Typography>
        </Box>
      </Box>

      {/* 轮次计数显示 */}
      {sessionStarted && !sessionEnded && (
        <Chip
          label={t("conversation.workspace.turns", {
            current: currentTurns,
            max: maxTurns,
          })}
          color={currentTurns >= maxTurns - 2 ? "warning" : "default"}
          variant="outlined"
          size="small"
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            height: 32,
            bgcolor: "background.paper",
            fontWeight: 700,
          }}
        />
      )}

      {/* 操作按钮组 */}
      <Box sx={{ display: "flex", gap: 0.5, ml: { xs: 0, sm: 0.5 } }}>
        {sessionStarted && onToggleRightPanels && (
          <Tooltip title={t("conversation.header.toggleRightPanels")}>
            <IconButton
              onClick={onToggleRightPanels}
              aria-label={t("conversation.header.toggleRightPanels")}
              aria-pressed={rightPanelsVisible}
              size="small"
              sx={{
                width: 40,
                height: 40,
                color: rightPanelsVisible ? "primary.main" : "text.secondary",
                backgroundColor: rightPanelsVisible
                  ? "rgba(43,89,209,.09)"
                  : "transparent",
                "&:hover": { backgroundColor: "#f3f4f6" },
              }}
            >
              <DashboardCustomizeRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {sessionStarted && onToggleMetrics && (
          <Tooltip title={t("conversation.header.toggleMetrics")}>
            <IconButton
              onClick={onToggleMetrics}
              aria-label={t("conversation.header.toggleMetrics")}
              aria-pressed={metricsVisible}
              size="small"
              sx={{
                display: { xs: "none", md: "inline-flex" },
                width: 40,
                height: 40,
                color: metricsVisible ? "primary.main" : "text.secondary",
                backgroundColor: metricsVisible
                  ? "rgba(43,89,209,.09)"
                  : "transparent",
                "&:hover": { backgroundColor: "#f3f4f6" },
              }}
            >
              <MonitorRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onOpenSettings && (
          <Tooltip title={t("conversation.header.openSettings")}>
            <IconButton
              onClick={onOpenSettings}
              aria-label={t("conversation.header.openSettings")}
              size="small"
              sx={{
                width: 40,
                height: 40,
                color: "text.secondary",
                "&:hover": { backgroundColor: "#f3f4f6" },
              }}
            >
              <SettingsRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 会话结束按钮 - 始终显示 */}
      {sessionStarted && !sessionEnded && (
        <Button
          variant="contained"
          startIcon={<CallEndRounded />}
          onClick={onManualEnd}
          aria-label={t("conversation.header.endSession")}
          color="error"
          size="small"
          sx={{
            ml: 0.5,
            minWidth: { xs: 42, sm: "auto" },
            width: { xs: 42, sm: "auto" },
            height: 40,
            px: { xs: 0, sm: 2 },
            borderRadius: 3,
            "& .MuiButton-startIcon": { mx: { xs: 0, sm: "-4px 8px" } },
          }}
        >
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            {t("conversation.header.endSession")}
          </Box>
        </Button>
      )}
    </Box>
  );
};

export default ConversationHeader;
