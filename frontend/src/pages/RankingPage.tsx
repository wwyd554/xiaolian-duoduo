import React, { useEffect, useState } from "react";
import { Box, Container } from "@mui/material";
import { useTranslation } from "react-i18next";
import RankingList from "../components/RankingList";
import { AuthService } from "../services/AuthService";

/**
 * 排行榜页面
 * 显示每个场景的日/周/月排行榜
 */
const RankingPage: React.FC = () => {
  const { t } = useTranslation();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined,
  );
  const authService = AuthService.getInstance();

  useEffect(() => {
    // 设置页面标题
    document.title = `${t("ranking.title")} | ${t("app.title")}`;
  }, [t]);

  useEffect(() => {
    // 获取当前用户 ID
    const fetchCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUserId(user?.preferredUsername || user?.name);
      } catch (error) {
        console.error("用户信息获取失败:", error);
      }
    };

    fetchCurrentUser();
  }, [authService]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ pt: 4, pb: 8 }}>
        <RankingList currentUserId={currentUserId} />
      </Box>
    </Container>
  );
};

export default RankingPage;
