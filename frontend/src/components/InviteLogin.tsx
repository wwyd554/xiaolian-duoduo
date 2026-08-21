/**
 * 邀请码登录表单 —— 本地认证（替代原 aws-amplify Authenticator/Cognito）
 *
 * 输入邀请码 + 昵称，注册成功后回调 onSuccess 进入主应用。
 */
import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { registerWithInviteCode } from "../services/LocalAuth";

interface InviteLoginProps {
  onSuccess: () => void;
}

const InviteLogin: React.FC<InviteLoginProps> = ({ onSuccess }) => {
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !nickname.trim()) {
      setError("请填写邀请码和昵称");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await registerWithInviteCode(inviteCode.trim(), nickname.trim());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
        p: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            销售陪练助手
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            使用邀请码登录，开始你的销售实战演练
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              label="邀请码"
              placeholder="例如：XXXX-XXXX-XXXX"
              fullWidth
              margin="normal"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
            <TextField
              label="昵称"
              placeholder="怎么称呼你"
              fullWidth
              margin="normal"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 3, py: 1.2 }}
            >
              {loading ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "进入陪练"
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default InviteLogin;
