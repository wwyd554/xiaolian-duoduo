import React from "react";
import { Box } from "@mui/material";
import GoalsPanel from "./GoalsPanel";
import ScenarioPanel from "./ScenarioPanel";
import PersonaPanel from "./PersonaPanel";
import type { Goal, GoalStatus, Scenario } from "../../types/index";

interface RightPanelContainerProps {
  visible: boolean;
  goals: Goal[];
  goalStatuses: GoalStatus[];
  scenario: Scenario;
}

/**
 * 右侧面板容器组件
 * 将 GoalsPanel + ScenarioPanel + PersonaPanel 纵向排列
 * 通过 📋 按钮控制批量显示/隐藏
 */
const RightPanelContainer: React.FC<RightPanelContainerProps> = ({
  visible,
  goals,
  goalStatuses,
  scenario,
}) => {
  if (!visible) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        height: "100%",
        overflowY: "auto",
        p: 1.5,
        // 让滚动条更紧凑
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "rgba(0,0,0,0.15)",
          borderRadius: 2,
        },
      }}
    >
      {/* 目标面板 - 用覆盖层样式包裹现有 GoalsPanel */}
      <Box
        sx={{
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(8px)",
          borderRadius: 3,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          // 覆盖 GoalsPanel 的 Card 样式
          "& .MuiCard-root": {
            boxShadow: "none",
            background: "transparent",
            mt: 0,
          },
          "& .MuiCardContent-root": {
            p: "12px 16px !important",
          },
        }}
      >
        <GoalsPanel goals={goals} goalStatuses={goalStatuses} />
      </Box>

      <ScenarioPanel scenario={scenario} />
      <PersonaPanel npc={scenario.npc} />
    </Box>
  );
};

export default RightPanelContainer;
