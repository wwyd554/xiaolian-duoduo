import React, { useId, useMemo } from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import type { Goal, GoalStatus } from "../../types/index";
import { useTranslation } from "react-i18next";

interface GoalsPanelProps {
  goals: Goal[];
  goalStatuses: GoalStatus[];
}

const clampProgress = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

/** 训练目标与达成进度，适用于侧栏和旧版设置面板。 */
const GoalsPanel: React.FC<GoalsPanelProps> = ({ goals, goalStatuses }) => {
  const { t } = useTranslation();
  const headingId = `${useId().replaceAll(":", "")}-training-goals-heading`;

  const statusByGoalId = useMemo(
    () => new Map(goalStatuses.map((status) => [status.goalId, status])),
    [goalStatuses],
  );

  const achievedCount = goals.reduce(
    (count, goal) => count + (statusByGoalId.get(goal.id)?.achieved ? 1 : 0),
    0,
  );
  const overallProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce(
            (total, goal) =>
              total + clampProgress(statusByGoalId.get(goal.id)?.progress ?? 0),
            0,
          ) / goals.length,
        )
      : 0;

  return (
    <Box role="region" aria-labelledby={headingId} sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.25,
        }}
      >
        <Box>
          <Typography
            component="h3"
            id={headingId}
            sx={{ fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.35 }}
          >
            {t("conversation.negotiationGoal")}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              color: "text.secondary",
              fontSize: "0.6875rem",
              lineHeight: 1.45,
            }}
          >
            {t("conversation.workspace.goalsSubtitle")}
          </Typography>
        </Box>

        {goals.length > 0 ? (
          <Typography
            sx={{
              color:
                achievedCount === goals.length ? "#16836f" : "text.secondary",
              fontSize: "0.75rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
            aria-label={t("conversation.workspace.goalsCompletedAria", {
              achieved: achievedCount,
              total: goals.length,
            })}
          >
            {t("conversation.workspace.goalsCompleted", {
              achieved: achievedCount,
              total: goals.length,
            })}
          </Typography>
        ) : null}
      </Box>

      {goals.length > 0 ? (
        <>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            aria-label={t("conversation.workspace.goalsOverallAria")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress}
            sx={{
              height: 4,
              mb: 1,
              borderRadius: 999,
              bgcolor: "#e8ebf0",
              "& .MuiLinearProgress-bar": {
                borderRadius: 999,
                bgcolor:
                  achievedCount === goals.length ? "#16836f" : "primary.main",
              },
            }}
          />

          <Box component="ol" sx={{ p: 0, m: 0, listStyle: "none" }}>
            {goals.map((goal, index) => {
              const status = statusByGoalId.get(goal.id) ?? {
                goalId: goal.id,
                progress: 0,
                achieved: false,
              };
              const progress = clampProgress(status.progress);

              return (
                <Box
                  component="li"
                  key={goal.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "20px minmax(0, 1fr)",
                    gap: 1,
                    py: 1.35,
                    borderBottom: index === goals.length - 1 ? 0 : "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box
                    sx={{
                      pt: "1px",
                      color: status.achieved ? "#16836f" : "text.disabled",
                    }}
                  >
                    {status.achieved ? (
                      <CheckCircleRoundedIcon
                        sx={{ width: 18, height: 18 }}
                        aria-hidden="true"
                      />
                    ) : (
                      <RadioButtonUncheckedRoundedIcon
                        sx={{ width: 18, height: 18 }}
                        aria-hidden="true"
                      />
                    )}
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          color: status.achieved
                            ? "text.secondary"
                            : "text.primary",
                          fontSize: "0.75rem",
                          fontWeight: goal.isRequired ? 650 : 500,
                          lineHeight: 1.5,
                          textDecoration: status.achieved
                            ? "line-through"
                            : "none",
                          textDecorationColor: "rgba(98, 105, 120, 0.55)",
                        }}
                      >
                        {goal.description}
                      </Typography>

                      {goal.isRequired ? (
                        <Box
                          component="span"
                          sx={{
                            flexShrink: 0,
                            px: 0.7,
                            py: 0.15,
                            color: "primary.main",
                            bgcolor: "rgba(43, 89, 209, 0.07)",
                            fontSize: "0.5625rem",
                            fontWeight: 750,
                            lineHeight: 1.5,
                          }}
                        >
                          {t("conversation.workspace.goalPriority")}
                        </Box>
                      ) : null}
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 0.75,
                      }}
                    >
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        aria-label={t(
                          "conversation.workspace.goalProgressAria",
                          { goal: goal.description },
                        )}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        sx={{
                          flex: 1,
                          height: 4,
                          borderRadius: 999,
                          bgcolor: "#eceef2",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 999,
                            bgcolor: status.achieved
                              ? "#16836f"
                              : "primary.main",
                          },
                        }}
                      />
                      <Typography
                        sx={{
                          width: 28,
                          color: status.achieved ? "#16836f" : "text.secondary",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          textAlign: "right",
                        }}
                      >
                        {progress}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      ) : (
        <Box
          sx={{
            py: 4,
            borderTop: "1px solid",
            borderBottom: "1px solid",
            borderColor: "divider",
            textAlign: "center",
          }}
        >
          <Typography sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
            {t("conversation.workspace.goalsEmpty")}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default GoalsPanel;
