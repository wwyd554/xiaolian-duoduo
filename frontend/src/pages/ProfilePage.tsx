import React from "react";
import { Container, Typography, Box } from "@mui/material";
import UserNameEditor from "../components/user/UserNameEditor";
import { useTranslation } from "react-i18next";

/**
 * 用户个人资料编辑页面
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

            {/* 将来在这里添加更多的个人资料设置组件 */}
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default ProfilePage;
