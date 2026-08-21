import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface HeaderBarProps {
  title: string;
  onBack?: () => void;
  subtitle?: string;
  rightContent?: React.ReactNode;
}

/**
 * シンプルなヘッダーバーコンポーネント
 * 主にサブページで使用します
 */
const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  onBack,
  subtitle,
  rightContent,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <AppBar
      position="static"
      color="default"
      elevation={1}
      sx={{
        backgroundColor: "background.paper",
        color: "text.primary",
      }}
    >
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          onClick={handleBack}
          aria-label="back"
        >
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ ml: 2, flexGrow: 1 }}>
          <Typography variant={isMobile ? "h6" : "h5"} component="h1" noWrap>
            {title}
          </Typography>

          {subtitle && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        {rightContent && <Box>{rightContent}</Box>}
      </Toolbar>
    </AppBar>
  );
};

export default HeaderBar;
