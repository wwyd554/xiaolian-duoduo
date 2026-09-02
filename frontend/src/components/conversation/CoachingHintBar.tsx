import React, { useState } from "react";
import { Box, Button, Collapse, Paper, Typography } from "@mui/material";
import {
  AutoAwesomeRounded,
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface CoachingHintBarProps {
  hint: string | undefined;
}

/** 按需呼出的教练提示，避免提示常驻导致代答感。 */
const CoachingHintBar: React.FC<CoachingHintBarProps> = ({ hint }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!hint) return null;

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pt: 0.75 }}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 900,
          mx: "auto",
          borderRadius: 3,
          border: "1px solid #e2e7f0",
          bgcolor: "#fbfcff",
          overflow: "hidden",
        }}
      >
        <Button
          fullWidth
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          startIcon={<AutoAwesomeRounded fontSize="small" />}
          endIcon={
            expanded ? <KeyboardArrowUpRounded /> : <KeyboardArrowDownRounded />
          }
          sx={{
            minHeight: 40,
            px: 1.5,
            color: "#405170",
            justifyContent: "flex-start",
            fontSize: 13,
            fontWeight: 700,
            "& .MuiButton-endIcon": { ml: "auto" },
          }}
        >
          {expanded
            ? t("conversation.workspace.hideHint")
            : t("conversation.workspace.showHint")}
        </Button>
        <Collapse in={expanded}>
          <Box
            role="status"
            aria-live="polite"
            aria-label={t("coachingHint.label")}
            sx={{
              display: "flex",
              gap: 1,
              px: 1.75,
              py: 1.25,
              borderTop: "1px solid #e7ebf3",
              bgcolor: "#eef2ff",
            }}
          >
            <Typography
              component="span"
              sx={{ fontSize: 13.5, lineHeight: 1.65, color: "#33466b" }}
            >
              <Box component="strong" sx={{ color: "primary.main", mr: 0.75 }}>
                {t("conversation.workspace.coach")}
              </Box>
              {hint}
            </Typography>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default CoachingHintBar;
