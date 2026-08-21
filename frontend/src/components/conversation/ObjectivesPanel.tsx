import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { useTranslation } from "react-i18next";

interface ObjectivesPanelProps {
  objectives: string[];
}

/**
 * 商談目標表示パネルコンポーネント
 */
const ObjectivesPanel: React.FC<ObjectivesPanelProps> = ({ objectives }) => {
  const { t } = useTranslation();
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t("conversation.negotiationObjective")}
        </Typography>
        {objectives.map((objective, index) => (
          <Box key={index} mb={1}>
            <Typography variant="body2" color="text.secondary">
              • {objective}
            </Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};

export default ObjectivesPanel;
