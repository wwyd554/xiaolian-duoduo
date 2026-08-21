import React from "react";
import { Container, Typography, Box } from "@mui/material";
import UserNameEditor from "../components/user/UserNameEditor";
import { useTranslation } from "react-i18next";

/**
 * ユーザープロフィール編集ページ
 */
const ProfilePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            {t("profile.title")}
          </Typography>

          <Box sx={{ mt: 4 }}>
            <UserNameEditor />

            {/* 将来的に追加のプロフィール設定コンポーネントをここに配置 */}
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default ProfilePage;
