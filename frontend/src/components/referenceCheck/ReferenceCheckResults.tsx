import React from "react";
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { ReferenceCheckResult } from "../../types/api";
import MessageAccordion from "./MessageAccordion";

/**
 * 结果展示组件的属性
 */
interface ReferenceCheckResultsProps {
  data: ReferenceCheckResult;
  issuesCount: number;
}

/**
 * 判断消息是否有问题
 * 仅将「有问题 (issue)」视为问题。
 * 「不适用 (not_applicable)」（问候、常规进行等）不视为问题。
 * @param msg 消息对象
 * @returns 有问题时返回 true
 */
const hasIssue = (msg: { evaluation: string }): boolean => {
  return msg.evaluation === "issue";
};

/**
 * 引用检查结果展示组件
 */
const ReferenceCheckResults: React.FC<ReferenceCheckResultsProps> = ({
  data,
  issuesCount,
}) => {
  const { t } = useTranslation();

  return (
    <Box>
      {/* 无问题时的显示 */}
      {issuesCount === 0 ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>
            {t("referenceCheck.noIssuesTitle", "无问题")}
          </AlertTitle>
          {t(
            "referenceCheck.noIssues",
            "未发现与文档一致性问题，已能够提供恰当的信息。",
          )}
        </Alert>
      ) : (
        <>
          {/* 有问题时的警告 */}
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>
              {t("referenceCheck.issuesFoundTitle", "已发现问题")} (
              {issuesCount}件)
            </AlertTitle>
            {t(
              "referenceCheck.issuesFoundDescription",
              "发现与文档一致性存在问题，请确认以下详情。",
            )}
          </Alert>

          {/* 有问题的消息详情 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
            {t("referenceCheck.problemMessages", "有问题的消息")}
          </Typography>

          {data.messages &&
            data.messages
              .map((msg, originalIndex) => ({ ...msg, originalIndex }))
              .filter((msg) => hasIssue(msg))
              .map((msg) => (
                <MessageAccordion
                  key={`problem-${msg.originalIndex}`}
                  message={msg}
                  index={msg.originalIndex}
                />
              ))}
        </>
      )}

      {/* 全部消息详情（可折叠） */}
      {data.messages && data.messages.length > 0 && (
        <Accordion sx={{ mt: 4 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {t("referenceCheck.allMessages", "全部消息的详情")} (
              {data.messages.length}件)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {data.messages.map((msg, index) => (
                <MessageAccordion
                  key={`all-${index}`}
                  message={msg}
                  index={index}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 说明区域 */}
      <Box sx={{ mt: 4, p: 3, bgcolor: "background.default", borderRadius: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="medium">
          {t("referenceCheck.explanationTitle", "关于引用检查")}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t(
            "referenceCheck.explanation1",
            "引用检查用于确认销售人员的发言是否与场景中设定的文档内容保持一致。",
          )}
        </Typography>
        <Typography variant="body2">
          {t(
            "referenceCheck.explanation2",
            "通过提供准确的信息，可以建立与客户的信任关系并提升销售效果。如果发现问题，请重新确认文档内容，努力提供准确的信息。",
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default ReferenceCheckResults;
