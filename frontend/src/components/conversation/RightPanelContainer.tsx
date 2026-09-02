import React, { useId, useState } from "react";
import { Box, IconButton, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MetricsOverlay from "./MetricsOverlay";
import GoalsPanel from "./GoalsPanel";
import ScenarioPanel from "./ScenarioPanel";
import PersonaPanel from "./PersonaPanel";
import type { Goal, GoalStatus, Metrics, Scenario } from "../../types/index";
import { useTranslation } from "react-i18next";

interface RightPanelContainerProps {
  visible: boolean;
  goals: Goal[];
  goalStatuses: GoalStatus[];
  scenario: Scenario;
  currentMetrics: Metrics;
  prevMetrics: Metrics | null;
  metricsUpdating: boolean;
  metricsVisible: boolean;
  onClose?: () => void;
}

/**
 * 对话页右侧 AI 训练助手。
 * 通过单层标签页组织实时状态、目标和客户资料，减少滚动与卡片堆叠。
 */
const RightPanelContainer: React.FC<RightPanelContainerProps> = ({
  visible,
  goals,
  goalStatuses,
  scenario,
  currentMetrics,
  prevMetrics,
  metricsUpdating,
  metricsVisible,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const instanceId = useId().replaceAll(":", "");
  const panelLabels = [
    t("conversation.workspace.assistantLive"),
    t("conversation.workspace.assistantGoals"),
    t("conversation.workspace.assistantProfile"),
  ];

  if (!visible) return null;

  const getTabId = (index: number) => `${instanceId}-assistant-tab-${index}`;
  const getPanelId = (index: number) =>
    `${instanceId}-assistant-panel-${index}`;

  return (
    <Box
      component="aside"
      aria-label={t("conversation.workspace.assistant")}
      sx={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box
        component="header"
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1.15,
          px: { xs: 1.5, sm: 2 },
          py: 1.4,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            borderRadius: "9px",
            bgcolor: "rgba(43, 89, 209, 0.09)",
            color: "primary.main",
          }}
          aria-hidden="true"
        >
          <AutoAwesomeRoundedIcon sx={{ width: 17, height: 17 }} />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h2"
            sx={{ fontSize: "0.875rem", fontWeight: 750, lineHeight: 1.35 }}
          >
            {t("conversation.workspace.assistant")}
          </Typography>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.65, mt: 0.25 }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                flexShrink: 0,
                borderRadius: "50%",
                bgcolor: metricsUpdating ? "#f29d38" : "#2fa77e",
                boxShadow: metricsUpdating
                  ? "0 0 0 3px rgba(242, 157, 56, 0.12)"
                  : "0 0 0 3px rgba(47, 167, 126, 0.11)",
              }}
              aria-hidden="true"
            />
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.625rem",
                lineHeight: 1.4,
              }}
            >
              {metricsUpdating
                ? t("conversation.workspace.assistantAnalyzing")
                : t("conversation.workspace.assistantActive")}
            </Typography>
          </Box>
        </Box>

        {onClose ? (
          <Tooltip title={t("conversation.workspace.assistantClose")}>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label={t("conversation.workspace.assistantClose")}
              sx={{ width: 34, height: 34, color: "text.secondary" }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, nextValue: number) => setActiveTab(nextValue)}
        variant="fullWidth"
        aria-label={t("conversation.workspace.assistantTabsAria")}
        sx={{
          minHeight: 42,
          flexShrink: 0,
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTabs-indicator": {
            height: 2,
            bgcolor: "primary.main",
          },
          "& .MuiTab-root": {
            minWidth: 0,
            minHeight: 42,
            px: 0.5,
            color: "text.secondary",
            fontSize: { xs: "0.6875rem", sm: "0.72rem" },
            fontWeight: 600,
            letterSpacing: 0,
            textTransform: "none",
            "&.Mui-selected": {
              color: "text.primary",
              fontWeight: 750,
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: -2,
            },
          },
        }}
      >
        {panelLabels.map((label, index) => (
          <Tab
            key={label}
            disableRipple
            label={label}
            id={getTabId(index)}
            aria-controls={getPanelId(index)}
          />
        ))}
      </Tabs>

      <Box
        sx={{
          minHeight: 0,
          flex: 1,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(98, 105, 120, 0.28) transparent",
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(98, 105, 120, 0.25)",
            borderRadius: 999,
          },
        }}
      >
        <Box
          role="tabpanel"
          id={getPanelId(0)}
          aria-labelledby={getTabId(0)}
          hidden={activeTab !== 0}
          sx={{ px: { xs: 1.5, sm: 2 }, py: 2 }}
        >
          {activeTab === 0 ? (
            metricsVisible ? (
              <MetricsOverlay
                currentMetrics={currentMetrics}
                prevMetrics={prevMetrics}
                metricsUpdating={metricsUpdating}
                visible
              />
            ) : (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <Typography
                  sx={{ color: "text.secondary", fontSize: "0.75rem" }}
                >
                  {t("conversation.workspace.metricsHidden")}
                </Typography>
              </Box>
            )
          ) : null}
        </Box>

        <Box
          role="tabpanel"
          id={getPanelId(1)}
          aria-labelledby={getTabId(1)}
          hidden={activeTab !== 1}
          sx={{ px: { xs: 1.5, sm: 2 }, py: 2 }}
        >
          {activeTab === 1 ? (
            <GoalsPanel goals={goals} goalStatuses={goalStatuses} />
          ) : null}
        </Box>

        <Box
          role="tabpanel"
          id={getPanelId(2)}
          aria-labelledby={getTabId(2)}
          hidden={activeTab !== 2}
          sx={{ px: { xs: 1.5, sm: 2 }, py: 2 }}
        >
          {activeTab === 2 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
              <PersonaPanel npc={scenario.npc} />
              <Box
                sx={{ height: "1px", bgcolor: "divider" }}
                aria-hidden="true"
              />
              <ScenarioPanel scenario={scenario} />
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(RightPanelContainer);
