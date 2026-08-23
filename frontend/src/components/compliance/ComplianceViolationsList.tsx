import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  Chip,
  Divider,
  Alert,
  Paper,
} from "@mui/material";
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Gavel as GavelIcon,
} from "@mui/icons-material";
import { ComplianceViolation } from "../../types/api";

interface ComplianceViolationsListProps {
  violations: ComplianceViolation[];
}

/**
 * 合规违规列表展示组件
 * 在会话结束后的评估页面使用
 */
const ComplianceViolationsList: React.FC<ComplianceViolationsListProps> = ({
  violations,
}) => {
  const { t } = useTranslation();

  // Helper function to translate legacy Japanese rule names
  const translateLegacyRuleName = (ruleName: string): string => {
    // Map legacy Japanese text to translation keys
    if (ruleName.includes("话题违规:")) {
      const topicName = ruleName.replace("话题违规: ", "");
      return String(t("compliance.violations.topicViolation", { topicName }));
    }
    if (ruleName.includes("内容过滤器:")) {
      const filterType = ruleName.replace("内容过滤器: ", "");
      return String(t("compliance.violations.contentFilter", { filterType }));
    }
    if (ruleName === "自定义词检测") {
      return String(t("compliance.violations.customWordDetected"));
    }
    if (ruleName.includes("管理词句列表:")) {
      const type = ruleName.replace("管理词句列表: ", "");
      return String(t("compliance.violations.managedWordList", { type }));
    }
    if (ruleName.includes("个人信息检测:")) {
      const type = ruleName.replace("个人信息检测: ", "");
      return String(t("compliance.violations.personalInfoDetected", { type }));
    }
    if (ruleName.includes("正则表达式过滤器:")) {
      const name = ruleName.replace("正则表达式过滤器: ", "");
      return String(t("compliance.violations.regexFilter", { name }));
    }
    if (ruleName.includes("上下文接地:")) {
      const type = ruleName.replace("上下文接地: ", "");
      return String(t("compliance.violations.contextualGrounding", { type }));
    }

    // If no mapping found, return original text
    return ruleName;
  };

  // Helper function to translate legacy Japanese messages
  const translateLegacyMessage = (message: string): string => {
    // Map legacy Japanese text to translation keys
    if (message.includes("检测到禁止话题:")) {
      const topicName = message.replace("检测到禁止话题: ", "");
      return String(
        t("compliance.violations.prohibitedTopicDetected", { topicName }),
      );
    }
    if (message.includes("检测到不当内容:")) {
      // Extract filterType and confidence from message like "检测到不当内容: HATE (置信度: HIGH)"
      const match = message.match(
        /检测到不当内容: (.+?) \(置信度: (.+?)\)/,
      );
      if (match) {
        const [, filterType, confidence] = match;
        return String(
          t("compliance.violations.inappropriateContentDetected", {
            filterType,
            confidence,
          }),
        );
      }
    }
    if (message.includes("检测到禁止词句:")) {
      const match = message.replace("检测到禁止词句: ", "");
      return String(
        t("compliance.violations.prohibitedWordDetected", { match }),
      );
    }
    if (message.includes("检测到管理词句列表中的词句:")) {
      // Extract match and type from message like "检测到管理词句列表中的词句: word (TYPE)"
      const match = message.match(
        /检测到管理词句列表中的词句: (.+?) \((.+?)\)/,
      );
      if (match) {
        const [, wordMatch, type] = match;
        return String(
          t("compliance.violations.managedWordDetected", {
            match: wordMatch,
            type,
          }),
        );
      }
    }
    if (message.includes("检测到个人信息:")) {
      // Extract type and match from message like "检测到个人信息: EMAIL - example@test.com"
      const match = message.match(/检测到个人信息: (.+?) - (.+)/);
      if (match) {
        const [, type, wordMatch] = match;
        return String(
          t("compliance.violations.personalInfoFound", {
            type,
            match: wordMatch,
          }),
        );
      }
    }
    if (message.includes("正则表达式模式匹配:")) {
      const match = message.replace("正则表达式模式匹配: ", "");
      return String(t("compliance.violations.regexPatternMatched", { match }));
    }
    if (message.includes("上下文接地违规:")) {
      // Extract type, score, and threshold from message like "上下文接地违规: TYPE (分数: 0.85, 阈值: 0.75)"
      const match = message.match(
        /上下文接地违规: (.+?) \(分数: (.+?), 阈值: (.+?)\)/,
      );
      if (match) {
        const [, type, score, threshold] = match;
        return String(
          t("compliance.violations.contextualGroundingViolation", {
            type,
            score,
            threshold,
          }),
        );
      }
    }

    // If no mapping found, return original text
    return message;
  };

  // 空数组或 undefined 时按无违规处理
  const hasViolations = violations && violations.length > 0;

  // 根据违规的严重程度选择图标和颜色
  const getSeverityInfo = (severity: string) => {
    switch (severity) {
      case "high":
        return {
          icon: <ErrorIcon color="error" />,
          color: "error",
          label: t("compliance.severityHigh", "High"),
        };
      case "medium":
        return {
          icon: <WarningIcon color="warning" />,
          color: "warning",
          label: t("compliance.severityMedium", "Medium"),
        };
      default:
        return {
          icon: <InfoIcon color="info" />,
          color: "info",
          label: t("compliance.severityLow", "Low"),
        };
    }
  };

  // 违规的分组（按相同 ruleName）
  const groupedViolations = hasViolations
    ? violations.reduce(
      (groups, violation) => {
        const ruleName = violation.ruleName;
        if (!groups[ruleName]) {
          groups[ruleName] = [];
        }
        groups[ruleName].push(violation);
        return groups;
      },
      {} as Record<string, ComplianceViolation[]>,
    )
    : {};

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <GavelIcon sx={{ mr: 1, color: "text.secondary" }} />
          <Typography variant="h6" component="div">
            {t("compliance.violationsTitle", "合规违规")}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {!hasViolations ? (
          <Alert severity="success" sx={{ mb: 1 }}>
            {t(
              "compliance.noViolationsDetected",
              "未检测到合规违规",
            )}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t(
                "compliance.violationsDescription",
                "商谈中检测到以下合规违规，请注意恰当的措辞。",
              )}
            </Typography>

            {Object.entries(groupedViolations).map(
              ([ruleName, violations], groupIndex) => (
                <Paper
                  key={`group-${groupIndex}`}
                  elevation={1}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderLeft: 4,
                    borderColor:
                      getSeverityInfo(violations[0].severity).color + ".main",
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography variant="subtitle1" fontWeight="medium">
                      {/* 有翻译键时使用翻译键，否则翻译旧版日文文本 */}
                      {violations[0].ruleNameKey
                        ? String(
                          t(
                            violations[0].ruleNameKey,
                            violations[0].ruleNameParams || {},
                          ),
                        )
                        : translateLegacyRuleName(ruleName)}
                    </Typography>
                    <Chip
                      label={getSeverityInfo(violations[0].severity).label}
                      size="small"
                      color={
                        getSeverityInfo(violations[0].severity).color as
                        | "error"
                        | "warning"
                        | "info"
                        | "success"
                      }
                      variant="filled"
                    />
                  </Box>

                  <List disablePadding>
                    {violations.map((violation, index) => (
                      <React.Fragment key={`violation-${index}`}>
                        {index > 0 && <Divider component="li" />}
                        <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                          <Box sx={{ width: "100%" }}>
                            <Typography variant="body1" sx={{ mb: 1 }}>
                              {/* 有翻译键时使用翻译键，否则翻译旧版日文文本 */}
                              {violation.messageKey
                                ? String(
                                  t(
                                    violation.messageKey,
                                    violation.messageParams || {},
                                  ),
                                )
                                : translateLegacyMessage(violation.message)}
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              <Typography
                                component="div"
                                variant="body2"
                                color="text.secondary"
                                fontStyle="italic"
                                sx={{ mb: 0.5 }}
                              >
                                {t("compliance.context", "检测到的语境")}:
                              </Typography>
                              <Paper
                                variant="outlined"
                                sx={{
                                  mt: 0.5,
                                  p: 1,
                                  bgcolor: "background.default",
                                  fontSize: "0.9rem",
                                }}
                              >
                                "{violation.context}"
                              </Paper>
                            </Box>
                          </Box>
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>
              ),
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ComplianceViolationsList;
