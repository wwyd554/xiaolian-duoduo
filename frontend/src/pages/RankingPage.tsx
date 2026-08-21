import React, { useEffect, useState } from "react";
import { Box, Container } from "@mui/material";
import { useTranslation } from "react-i18next";
import RankingList from "../components/RankingList";
import { AuthService } from "../services/AuthService";

/**
 * ランキングページ
 * シナリオごとの日次/週次/月次ランキングを表示する
 */
const RankingPage: React.FC = () => {
  const { t } = useTranslation();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined,
  );
  const authService = AuthService.getInstance();

  useEffect(() => {
    // ページタイトルの設定
    document.title = `${t("ranking.title")} | ${t("app.title")}`;
  }, [t]);

  useEffect(() => {
    // 現在のユーザーIDを取得
    const fetchCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUserId(user?.preferredUsername || user?.name);
      } catch (error) {
        console.error("ユーザー情報の取得に失敗しました:", error);
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
