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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
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
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { AuthService } from "../services/AuthService";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import { designTokens as d } from "../theme/designTokens";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [productInfoOpen, setProductInfoOpen] = useState(false);
  const isMenuOpen = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isLanding = variant === "landing";
  const isHomeRoute = location.pathname === "/";
  const isScenariosRoute = location.pathname.startsWith("/scenarios");
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
      id: "demo",
      label: "产品演示",
      icon: <AutoStoriesOutlinedIcon />,
      active: location.pathname === "/demo",
      onClick: () => { navigate("/demo"); setDrawerOpen(false); },
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
  ];

  const accountMenu = (
    <Menu
      id="menu-appbar"
      anchorEl={anchorEl}
      keepMounted
      open={isMenuOpen}
      onClose={handleMenuClose}
      transformOrigin={{ horizontal: "left", vertical: "bottom" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
    >
      <MenuItem
        onClick={() => {
          handleMenuClose();
          setSettingsOpen(true);
        }}
      >
        <ListItemIcon>
          <SettingsOutlinedIcon fontSize="small" />
        </ListItemIcon>
        {t("navigation.settings", "设置")}
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleMenuClose();
          setProductInfoOpen(true);
        }}
      >
        <ListItemIcon>
          <InfoOutlinedIcon fontSize="small" />
        </ListItemIcon>
        {t("navigation.productInfo", "产品说明")}
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleProfileClick}>
        {t("navigation.profile")}
      </MenuItem>
      <MenuItem onClick={handleLogout}>{t("auth.signOut")}</MenuItem>
    </Menu>
  );

  const utilityDialogs = (
    <>
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="app-settings-title"
      >
        <DialogTitle id="app-settings-title">
          {t("navigation.settings", "设置")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            {t("settings.language")}
          </Typography>
          <LanguageSwitcher />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>
            {t("common.close", "关闭")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={productInfoOpen}
        onClose={() => setProductInfoOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="product-info-title"
      >
        <DialogTitle id="product-info-title">
          {t("navigation.productInfo", "产品说明")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6" sx={{ mb: 1 }}>
            销练多多 · AI 销售陪练
          </Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.9 }}>
            选择销售场景，与 AI
            模拟客户练习沟通；结束后查看对话记录与复盘建议，找到下一次可以改进的地方。
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            如何使用
          </Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.9 }}>
            开始练习：选择场景，使用文字或语音进行对话。
            <br />
            销售复盘：查看练习记录，也可导入聊天记录，或上传录音并在本地转写后进行分析。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            AI
            反馈仅供训练参考，请结合实际业务判断。导入真实沟通记录前，请先去除客户的敏感信息。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductInfoOpen(false)}>
            {t("common.close", "关闭")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
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
            bgcolor: d.colors.surface,
            borderRight: `1px solid ${d.colors.border}`,
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
                    color: item.active ? d.colors.primaryHover : d.colors.muted,
                    bgcolor: item.active ? d.colors.primarySoft : "transparent",
                    "&:hover": {
                      bgcolor: item.active
                        ? d.colors.primarySoft
                        : d.colors.surfaceSoft,
                      color: item.active ? d.colors.primaryHover : d.colors.ink,
                    },
                    "&.Mui-selected": {
                      bgcolor: d.colors.primarySoft,
                      color: d.colors.primaryHover,
                    },
                    "&.Mui-selected:hover": { bgcolor: d.colors.primarySoft },
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
                          fontSize: 14,
                          fontWeight: item.active ? 600 : 500,
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
                  width: 48,
                  height: 48,
                  ml: 0.5,
                  borderRadius: "50%",
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
                  <PersonIcon fontSize="small" />
                </Avatar>
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
        {utilityDialogs}
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
            ? "rgba(255, 255, 255, 0.92)"
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
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : currentUser ? (
              <>
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
                    <PersonIcon fontSize="small" />
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
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      setSettingsOpen(true);
                    }}
                  >
                    {t("navigation.settings", "设置")}
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      setProductInfoOpen(true);
                    }}
                  >
                    {t("navigation.productInfo", "产品说明")}
                  </MenuItem>
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
      {utilityDialogs}
    </>
  );
};

export default Header;
