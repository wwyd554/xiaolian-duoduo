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
  ButtonBase,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import AccountCircle from "@mui/icons-material/AccountCircle";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import HistoryIcon from "@mui/icons-material/History";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PersonIcon from "@mui/icons-material/Person";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import { AuthService } from "../services/AuthService";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

interface HeaderProps {
  // showBackButton?: boolean; // 当前未使用
  pageTitle?: string;
  variant?: "app" | "landing";
}

/**
 * 应用顶部栏组件
 */
const Header: React.FC<HeaderProps> = ({ pageTitle, variant = "app" }) => {
  const { t } = useTranslation();
  const defaultTitle = t("home.title");
  const navigate = useNavigate();
  const location = useLocation();
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
  const isLanding = variant === "landing";
  const isHomeRoute = location.pathname === "/";
  const isScenariosRoute = location.pathname.startsWith("/scenarios");
  const isAudioAnalysisRoute = location.pathname.startsWith("/audio-analysis");
  const isHistoryRoute = location.pathname.startsWith("/history");

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

  useEffect(() => {
    setDrawerOpen(false);
    setAnchorEl(null);
  }, [isMobile]);

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
    setDrawerOpen(false);
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

  const handleAudioAnalysisClick = () => {
    navigate("/audio-analysis");
    setDrawerOpen(false);
  };

  // 抽屉的开合
  const toggleDrawer = () => {
    setDrawerOpen((current) => !current);
  };

  // 用于显示用户名（优先级：preferredUsername > name > 邮箱）
  const displayName =
    currentUser?.preferredUsername ||
    currentUser?.name ||
    t("auth.notLoggedIn");

  const navigationItems = [
    {
      id: "home",
      label: t("navigation.home"),
      icon: <HomeIcon />,
      active: isHomeRoute,
      onClick: handleHomeClick,
    },
    {
      id: "scenarios",
      label: t("navigation.scenarios"),
      icon: <PlayArrowIcon />,
      active: isScenariosRoute,
      onClick: handleScenariosClick,
    },
    {
      id: "history",
      label: t("navigation.history"),
      icon: <HistoryIcon />,
      active: isHistoryRoute,
      onClick: handleHistoryClick,
    },
    {
      id: "audio-analysis",
      label: t("home.audioAnalysisButton"),
      icon: <AudiotrackRoundedIcon />,
      active: isAudioAnalysisRoute,
      onClick: handleAudioAnalysisClick,
    },
  ];

  const accountMenu = (
    <Menu
      id="menu-appbar"
      anchorEl={anchorEl}
      keepMounted
      open={isMenuOpen}
      onClose={handleMenuClose}
      transformOrigin={{ horizontal: "left", vertical: "bottom" }}
      anchorOrigin={{ horizontal: "right", vertical: "top" }}
    >
      <MenuItem onClick={handleProfileClick}>
        {t("navigation.profile")}
      </MenuItem>
      <MenuItem onClick={handleLogout}>{t("auth.signOut")}</MenuItem>
    </Menu>
  );

  const drawerContent = (
    <Box component="nav" aria-label={defaultTitle} sx={{ width: 250, pt: 1 }}>
      <List>
        {navigationItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={item.active}
            aria-current={item.active ? "page" : undefined}
            onClick={item.onClick}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
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

  if (!isMobile) {
    return (
      <>
        <Box
          component="aside"
          sx={{
            position: "sticky",
            top: 0,
            alignSelf: "flex-start",
            flexShrink: 0,
            width: { sm: 192, md: 232 },
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            px: 1.75,
            py: 2,
            color: "text.primary",
            bgcolor: "#f7f7f4",
            borderRight: "1px solid rgba(30,36,48,.09)",
          }}
        >
          <ButtonBase
            onClick={handleHomeClick}
            aria-label={`${defaultTitle} · ${t("navigation.home")}`}
            sx={{
              width: "100%",
              minHeight: 64,
              justifyContent: "flex-start",
              px: 1.25,
              borderRadius: "14px",
              "&.Mui-focusVisible": {
                outline: "3px solid rgba(43,89,209,.28)",
                outlineOffset: 2,
              },
            }}
          >
            <Box
              component="img"
              src="/brand/xiaolian-duoduo-logo-horizontal-v1-300w.webp"
              alt={defaultTitle}
              sx={{
                display: "block",
                width: { sm: 150, md: 154 },
                height: 48,
                objectFit: "contain",
                objectPosition: "left center",
                userSelect: "none",
              }}
            />
          </ButtonBase>

          {pageTitle ? (
            <Typography
              sx={{
                mt: 1,
                px: 1.5,
                color: "text.secondary",
                fontSize: 11,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pageTitle}
            </Typography>
          ) : null}

          <Box
            component="nav"
            aria-label={defaultTitle}
            sx={{ mt: pageTitle ? 2.25 : 3.25 }}
          >
            <List disablePadding sx={{ display: "grid", gap: 0.65 }}>
              {navigationItems.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={item.active}
                  aria-current={item.active ? "page" : undefined}
                  onClick={item.onClick}
                  sx={{
                    minHeight: 46,
                    px: 1.4,
                    borderRadius: "13px",
                    color: item.active ? "#fff" : "#5d626c",
                    bgcolor: item.active ? "#222321" : "transparent",
                    "&:hover": {
                      bgcolor: item.active ? "#222321" : "rgba(30,36,48,.055)",
                      color: item.active ? "#fff" : "text.primary",
                    },
                    "&.Mui-selected": {
                      bgcolor: "#222321",
                      color: "#fff",
                    },
                    "&.Mui-selected:hover": { bgcolor: "#222321" },
                    "&.Mui-focusVisible": {
                      outline: "3px solid rgba(43,89,209,.28)",
                      outlineOffset: 2,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.35,
                      color: "inherit",
                      "& svg": { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: 13,
                          fontWeight: item.active ? 700 : 600,
                        },
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Box sx={{ mt: "auto", pt: 2 }}>
            <Divider sx={{ mb: 1.75 }} />
            <Box
              sx={{
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                px: 0.75,
                mb: 1.25,
                color: "text.secondary",
              }}
            >
              <LanguageSwitcher />
            </Box>

            {loading ? (
              <Box
                role="status"
                sx={{ minHeight: 56, display: "grid", placeItems: "center" }}
              >
                <CircularProgress size={22} color="inherit" />
              </Box>
            ) : currentUser ? (
              <ButtonBase
                onClick={handleMenuOpen}
                aria-label={t("navigation.profile")}
                aria-controls="menu-appbar"
                aria-haspopup="true"
                aria-expanded={isMenuOpen ? "true" : undefined}
                sx={{
                  width: "100%",
                  minHeight: 62,
                  justifyContent: "flex-start",
                  gap: 1.1,
                  p: 1,
                  borderRadius: "14px",
                  textAlign: "left",
                  "&:hover": { bgcolor: "rgba(30,36,48,.055)" },
                  "&.Mui-focusVisible": {
                    outline: "3px solid rgba(43,89,209,.28)",
                    outlineOffset: 2,
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    bgcolor: "secondary.main",
                    color: "background.default",
                    fontSize: 14,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.35 }}
                  >
                    {displayName}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{ mt: 0.2, color: "text.secondary", fontSize: 10.5 }}
                  >
                    {currentUser.email}
                  </Typography>
                </Box>
              </ButtonBase>
            ) : (
              <Box
                sx={{
                  minHeight: 56,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  color: "text.secondary",
                }}
              >
                <AccountCircle />
                <Typography sx={{ fontSize: 12.5 }}>{displayName}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        {accountMenu}
      </>
    );
  }

  return (
    <>
      <AppBar
        position={isLanding ? "sticky" : "static"}
        elevation={0}
        sx={{
          top: 0,
          bgcolor: isLanding
            ? "rgba(247, 247, 248, 0.82)"
            : "background.default",
          color: "text.primary",
          backdropFilter: isLanding ? "blur(18px)" : "none",
          WebkitBackdropFilter: isLanding ? "blur(18px)" : "none",
          borderBottom: "1px solid",
          borderColor: isLanding ? "rgba(23, 24, 26, 0.07)" : "divider",
        }}
      >
        <Toolbar
          sx={{
            width: "100%",
            maxWidth: isLanding ? 1280 : "none",
            minHeight: { xs: 64, md: isLanding ? 72 : 76 },
            mx: "auto",
            px: { xs: 2, md: isLanding ? 4 : 4 },
          }}
        >
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label={t("navigation.openMenu")}
              aria-controls="mobile-navigation-drawer"
              aria-expanded={drawerOpen}
              edge="start"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            sx={{
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
              gap: 2,
              minWidth: 0,
            }}
          >
            <ButtonBase
              onClick={handleHomeClick}
              aria-label={`${defaultTitle} · ${t("navigation.home")}`}
              sx={{
                flexShrink: 0,
                borderRadius: 1.5,
                transition: "opacity 0.2s ease",
                "&:hover": { opacity: 0.78 },
              }}
            >
              <Box
                component="img"
                src="/brand/xiaolian-duoduo-logo-horizontal-v1-300w.webp"
                alt={defaultTitle}
                sx={{
                  display: "block",
                  width: { xs: 116, sm: isLanding ? 132 : 142 },
                  height: isLanding ? 40 : 46,
                  objectFit: "contain",
                  objectPosition: "left center",
                  userSelect: "none",
                }}
              />
            </ButtonBase>
            {pageTitle && !isMobile && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  pl: 2,
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {pageTitle}
              </Typography>
            )}
          </Box>

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
                  aria-label={t("navigation.profile")}
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen ? "true" : undefined}
                  onClick={handleMenuOpen}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: "secondary.main",
                      color: "background.default",
                      fontSize: 14,
                    }}
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
                aria-label={t("navigation.profile")}
              >
                <AccountCircle />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* 移动端导航抽屉 */}
      <Drawer
        id="mobile-navigation-drawer"
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Header;
