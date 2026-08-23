import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import { AuthService } from "../../services/AuthService";
import { useTranslation } from "react-i18next";

/**
 * 用户名编辑组件
 *
 * 提供用于显示和编辑用户名的 UI
 */
const UserNameEditor: React.FC = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // 从认证服务获取用户信息
  const authService = AuthService.getInstance();

  // 组件挂载时获取当前用户信息
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUsername(currentUser.preferredUsername || currentUser.name || "");
          setUserId(currentUser.userId || "");
        }
      } catch (error) {
        console.error("用户信息获取失败:", error);
      }
    };

    fetchUserData();
  }, [authService, t]);

  // 编辑模式的切换
  const handleEditToggle = async () => {
    setIsEditing(!isEditing);
    // 取消编辑模式时恢复原用户名
    if (isEditing) {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUsername(currentUser.preferredUsername || currentUser.name || "");
        }
      } catch (error) {
        console.error("用户信息获取失败:", error);
      }
    }
  };

  // 用户名的保存
  const handleSave = async () => {
    try {
      await authService.updatePreferredUsername(username);
      setIsEditing(false);
      setNotification({
        open: true,
        message: t("profile.usernameUpdateSuccess"),
        severity: "success",
      });
    } catch (error) {
      console.error("更新用户名时出错:", error);
      setNotification({
        open: true,
        message: t("profile.usernameUpdateError"),
        severity: "error",
      });
    }
  };

  // 关闭通知
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t("profile.username")}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography sx={{ mr: 2, minWidth: "100px" }}>
          {t("profile.username")}:
        </Typography>

        {isEditing ? (
          <TextField
            size="small"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
            sx={{ flexGrow: 1, mr: 1 }}
          />
        ) : (
          <Typography sx={{ flexGrow: 1 }}>{username}</Typography>
        )}

        <Button
          variant={isEditing ? "outlined" : "contained"}
          color="primary"
          size="small"
          onClick={handleEditToggle}
          sx={{ minWidth: "80px", ml: 1 }}
        >
          {isEditing ? t("common.cancel") : t("profile.edit")}
        </Button>

        {isEditing && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={handleSave}
            sx={{ ml: 1 }}
            disabled={!username?.trim()}
          >
            {t("common.save")}
          </Button>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("profile.usernameNote")}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 用户 ID 显示部分 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t("profile.userId")}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography sx={{ mr: 2, minWidth: "100px" }} color="text.secondary">
            {t("profile.userId")}:
          </Typography>

          <Typography
            variant="body2"
            sx={{
              flexGrow: 1,
              fontFamily: "monospace",
              padding: "6px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.04)",
              borderRadius: 1,
              overflowX: "auto",
            }}
          >
            {userId || t("profile.userIdNotAvailable")}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {t("profile.userIdNote")}
        </Typography>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          elevation={6}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default UserNameEditor;
