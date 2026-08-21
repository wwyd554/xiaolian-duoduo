import React from "react";
import {
  Card,
  CardContent,
  Box,
  Avatar,
  Typography,
  Chip,
  Tooltip,
} from "@mui/material";
import { NPC } from "../../types/index";
import { useTranslation } from "react-i18next";

interface NPCInfoCardProps {
  npc: NPC;
}

/**
 * NPCの情報を表示するカードコンポーネント
 */
const NPCInfoCard: React.FC<NPCInfoCardProps> = ({ npc }) => {
  const { t } = useTranslation();

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ py: 1.5, height: "100%" }}>
        <Box display="flex" alignItems="center" gap={1.5} height="100%">
          <Avatar sx={{ width: 45, height: 45, fontSize: "1.3rem" }}>
            {npc.avatar}
          </Avatar>
          <Box flexGrow={1} sx={{ overflow: "hidden" }}>
            <Typography variant="h6" sx={{ mb: 0.5, fontSize: "1.1rem" }}>
              {npc.name}
            </Typography>
            <Tooltip title={npc.description} placement="bottom-start">
              <Typography
                variant="body2"
                color="text.secondary"
                mb={0.5}
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {npc.description}
              </Typography>
            </Tooltip>
            <Box display="flex" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
              {npc.personality.slice(0, 3).map((trait, index) => (
                <Chip
                  key={index}
                  label={trait}
                  size="small"
                  variant="outlined"
                  sx={{ height: "20px", fontSize: "0.7rem" }}
                />
              ))}
              {npc.personality.length > 3 && (
                <Tooltip title={npc.personality.slice(3).join(", ")}>
                  <Chip
                    label={t("conversation.npc.moreTraits", {
                      count: npc.personality.length - 3,
                    })}
                    size="small"
                    variant="outlined"
                    sx={{ height: "20px", fontSize: "0.7rem" }}
                  />
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default NPCInfoCard;
