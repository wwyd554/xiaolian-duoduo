import React, { useState, useEffect } from "react";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  CircularProgress,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  AccountCircle,
  Menu as MenuIcon,
  Home as HomeIcon,
  History as HistoryIcon,
  PlayArrow as PlayArrowIcon,
  Person as PersonIcon,
  EmojiEvents as EmojiEventsIcon,
} from "@mui/icons-material";
import { AuthService } from "../services/AuthService";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

interface HeaderProps {
  // showBackButton?: boolean; // 当前未使用
  pageTitle?: string;
}

/**
 * 应用顶部栏组件
 */
const Header: React.FC<HeaderProps> = ({ pageTitle }) => {
  const { t } = useTranslation();
  const defaultTitle = t("home.title");
  const navigate = useNavigate();
  const authService = AuthService.getInstance();
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    preferredUsername?: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMenuOpen = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // 异步获取用户信息
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error(t("errors.auth"), error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [t, authService]);

  // 打开菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // 关闭菜单
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // 跳转到个人资料页面
  const handleProfileClick = () => {
    handleMenuClose();
    navigate("/profile");
  };

  // 登出处理
  const handleLogout = async () => {
    handleMenuClose();
    try {
      await authService.logout();
      navigate("/");
      window.location.reload(); // 重新加载应用以重置认证状态
    } catch (error) {
      console.error(t("errors.logout"), error);
    }
  };

  // 返回上一个页面
  // 返回上一页的功能（未使用，故删除）
  // const handleGoBack = () => {
  //   navigate(-1);
  // };

  // 跳转到主页
  const handleHomeClick = () => {
    navigate("/");
    setDrawerOpen(false);
  };

  // 跳转到场景选择页面
  const handleScenariosClick = () => {
    navigate("/scenarios");
    setDrawerOpen(false);
  };

  // 跳转到历史页面
  const handleHistoryClick = () => {
    navigate("/history");
    setDrawerOpen(false);
  };

  // 跳转到排行榜页面
  const handleRankingsClick = () => {
    navigate("/rankings");
    setDrawerOpen(false);
  };

  // 抽屉的开合
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // 用于显示用户名（优先级：preferredUsername > name > 邮箱）
  const displayName =
    currentUser?.preferredUsername ||
    currentUser?.name ||
    t("auth.notLoggedIn");

  // 导航的绘制
  const drawerContent = (
    <Box sx={{ width: 250 }} role="presentation">
      <List>
        <ListItemButton onClick={handleHomeClick}>
          <ListItemIcon>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary={t("navigation.home")} />
        </ListItemButton>
        <ListItemButton onClick={handleScenariosClick}>
          <ListItemIcon>
            <PlayArrowIcon />
          </ListItemIcon>
          <ListItemText primary={t("navigation.scenarios")} />
        </ListItemButton>
        <ListItemButton onClick={handleHistoryClick}>
          <ListItemIcon>
            <HistoryIcon />
          </ListItemIcon>
          <ListItemText primary={t("navigation.history")} />
        </ListItemButton>
        <ListItemButton onClick={handleRankingsClick}>
          <ListItemIcon>
            <EmojiEventsIcon />
          </ListItemIcon>
          <ListItemText primary={t("navigation.rankings")} />
        </ListItemButton>
      </List>
      <Divider />
      <List>
        <ListItemButton onClick={handleProfileClick}>
          <ListItemIcon>
            <PersonIcon />
          </ListItemIcon>
          <ListItemText primary={t("navigation.profile")} />
        </ListItemButton>
        {currentUser && (
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <AccountCircle />
            </ListItemIcon>
            <ListItemText primary={t("auth.signOut")} />
          </ListItemButton>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              cursor: "pointer",
              "&:hover": {
                opacity: 0.8,
              },
              transition: "all 0.2s ease",
              userSelect: "none", // 防止文本选中
            }}
            onClick={handleHomeClick}
          >
            {pageTitle || defaultTitle}
          </Typography>

          {!isMobile && (
            <Box sx={{ display: "flex", mx: 2 }}>
              <Button
                color="inherit"
                onClick={handleHomeClick}
                sx={{ mx: 0.5 }}
              >
                {t("navigation.home")}
              </Button>
              <Button
                color="inherit"
                onClick={handleScenariosClick}
                sx={{ mx: 0.5 }}
              >
                {t("navigation.scenarios")}
              </Button>
              <Button
                color="inherit"
                onClick={handleHistoryClick}
                sx={{ mx: 0.5 }}
              >
                {t("navigation.history")}
              </Button>
              <Button
                color="inherit"
                onClick={handleRankingsClick}
                sx={{ mx: 0.5 }}
              >
                {t("navigation.rankings")}
              </Button>
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box sx={{ mr: 2 }}>
              <LanguageSwitcher />
            </Box>

            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : currentUser ? (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    mr: 1,
                    display: { xs: "none", sm: "block" },
                  }}
                >
                  {displayName}
                </Typography>
                <IconButton
                  size="large"
                  edge="end"
                  color="inherit"
                  aria-label="user account"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenuOpen}
                >
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  keepMounted
                  open={isMenuOpen}
                  onClose={handleMenuClose}
                  transformOrigin={{ horizontal: "right", vertical: "top" }}
                  anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                >
                  <MenuItem onClick={handleProfileClick}>
                    {t("navigation.profile")}
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>
                    {t("auth.signOut")}
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <IconButton
                size="large"
                edge="end"
                color="inherit"
                aria-label="user account"
              >
                <AccountCircle />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* 移动端导航抽屉 */}
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer}>
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Header;
