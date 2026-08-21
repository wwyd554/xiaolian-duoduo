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
 * コンプライアンス違反一覧表示コンポーネント
 * セッション終了後の評価画面で使用
 */
const ComplianceViolationsList: React.FC<ComplianceViolationsListProps> = ({
  violations,
}) => {
  const { t } = useTranslation();

  // Helper function to translate legacy Japanese rule names
  const translateLegacyRuleName = (ruleName: string): string => {
    // Map legacy Japanese text to translation keys
    if (ruleName.includes("トピック違反:")) {
      const topicName = ruleName.replace("トピック違反: ", "");
      return String(t("compliance.violations.topicViolation", { topicName }));
    }
    if (ruleName.includes("コンテンツフィルター:")) {
      const filterType = ruleName.replace("コンテンツフィルター: ", "");
      return String(t("compliance.violations.contentFilter", { filterType }));
    }
    if (ruleName === "カスタムワード検出") {
      return String(t("compliance.violations.customWordDetected"));
    }
    if (ruleName.includes("管理語句リスト:")) {
      const type = ruleName.replace("管理語句リスト: ", "");
      return String(t("compliance.violations.managedWordList", { type }));
    }
    if (ruleName.includes("個人情報検出:")) {
      const type = ruleName.replace("個人情報検出: ", "");
      return String(t("compliance.violations.personalInfoDetected", { type }));
    }
    if (ruleName.includes("正規表現フィルター:")) {
      const name = ruleName.replace("正規表現フィルター: ", "");
      return String(t("compliance.violations.regexFilter", { name }));
    }
    if (ruleName.includes("コンテキストグラウンディング:")) {
      const type = ruleName.replace("コンテキストグラウンディング: ", "");
      return String(t("compliance.violations.contextualGrounding", { type }));
    }

    // If no mapping found, return original text
    return ruleName;
  };

  // Helper function to translate legacy Japanese messages
  const translateLegacyMessage = (message: string): string => {
    // Map legacy Japanese text to translation keys
    if (message.includes("禁止されたトピックが検出されました:")) {
      const topicName = message.replace(
        "禁止されたトピックが検出されました: ",
        "",
      );
      return String(
        t("compliance.violations.prohibitedTopicDetected", { topicName }),
      );
    }
    if (message.includes("不適切なコンテンツが検出されました:")) {
      // Extract filterType and confidence from message like "不適切なコンテンツが検出されました: HATE (信頼度: HIGH)"
      const match = message.match(
        /不適切なコンテンツが検出されました: (.+?) \(信頼度: (.+?)\)/,
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
    if (message.includes("禁止語句が検出されました:")) {
      const match = message.replace("禁止語句が検出されました: ", "");
      return String(
        t("compliance.violations.prohibitedWordDetected", { match }),
      );
    }
    if (message.includes("管理語句リストの語句が検出されました:")) {
      // Extract match and type from message like "管理語句リストの語句が検出されました: word (TYPE)"
      const match = message.match(
        /管理語句リストの語句が検出されました: (.+?) \((.+?)\)/,
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
    if (message.includes("個人情報が検出されました:")) {
      // Extract type and match from message like "個人情報が検出されました: EMAIL - example@test.com"
      const match = message.match(/個人情報が検出されました: (.+?) - (.+)/);
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
    if (message.includes("正規表現パターンにマッチしました:")) {
      const match = message.replace("正規表現パターンにマッチしました: ", "");
      return String(t("compliance.violations.regexPatternMatched", { match }));
    }
    if (message.includes("コンテキストグラウンディング違反:")) {
      // Extract type, score, and threshold from message like "コンテキストグラウンディング違反: TYPE (スコア: 0.85, 閾値: 0.75)"
      const match = message.match(
        /コンテキストグラウンディング違反: (.+?) \(スコア: (.+?), 閾値: (.+?)\)/,
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

  // 空配列またはundefinedの場合は違反なしとして処理
  const hasViolations = violations && violations.length > 0;

  // 違反の重大度に応じてアイコンと色を選択
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

  // 違反のグループ化（同じruleNameごと）
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
            {t("compliance.violationsTitle", "コンプライアンス違反")}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {!hasViolations ? (
          <Alert severity="success" sx={{ mb: 1 }}>
            {t(
              "compliance.noViolationsDetected",
              "コンプライアンス違反は検出されませんでした",
            )}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t(
                "compliance.violationsDescription",
                "商談中に以下のコンプライアンス違反が検出されました。適切な表現を心がけましょう。",
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
                      {/* 翻訳キーがある場合はそれを使用、なければレガシー日本語テキストを翻訳 */}
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
                              {/* 翻訳キーがある場合はそれを使用、なければレガシー日本語テキストを翻訳 */}
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
                                {t("compliance.context", "検出された文脈")}:
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
