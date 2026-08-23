import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  IconButton,
  Menu,
  ListItemText,
} from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";
import {
  languageNameMapping,
  supportedLanguages,
} from "../i18n/utils/languageUtils";

/**
 * 语言切换组件
 *
 * 提供用于放置在顶部栏等处进行语言切换的 UI。
 * 桌面端显示下拉框，移动端显示图标按钮和菜单。
 */
const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // 组件挂载时将语言设置为中文
  useEffect(() => {
    const savedLanguage = localStorage.getItem("i18nextLng");
    if (!savedLanguage || !supportedLanguages.includes(savedLanguage)) {
      i18n.changeLanguage("zh");
      localStorage.setItem("i18nextLng", "zh");
    }
  }, [i18n]);

  // 当前语言
  const currentLanguage = i18n.language || "zh";

  // 语言切换处理器
  const handleLanguageChange = (event: SelectChangeEvent) => {
    const newLang = event.target.value;
    i18n.changeLanguage(newLang);
    // 保存到 localStorage 进行持久化
    localStorage.setItem("i18nextLng", newLang);
  };

  // 打开移动端菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // 关闭移动端菜单
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // 在移动端菜单选择语言时
  const handleMenuItemClick = (lang: string) => {
    i18n.changeLanguage(lang);
    // 保存到 localStorage 进行持久化
    localStorage.setItem("i18nextLng", lang);
    handleMenuClose();
  };

  return (
    <>
      {/* 桌面端显示用的选择框（带图标） */}
      <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
        <TranslateIcon sx={{ color: "inherit", fontSize: "1.2rem" }} />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={currentLanguage}
            onChange={handleLanguageChange}
            displayEmpty
            variant="outlined"
            sx={{
              "& .MuiSelect-select": {
                py: 0.5,
                display: "flex",
                alignItems: "center",
              },
              fontFamily: "inherit", // 继承字体系列
              color: "inherit", // 继承文本颜色
            }}
          >
            {supportedLanguages.map((lang) => (
              <MenuItem key={lang} value={lang} sx={{ fontFamily: "inherit" }}>
                {languageNameMapping[lang]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* 移动端显示用的图标按钮 */}
      <Box sx={{ display: { xs: "flex", md: "none" } }}>
        <IconButton
          onClick={handleMenuOpen}
          color="inherit"
          aria-label={t("settings.language")}
        >
          <TranslateIcon />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          slotProps={{
            paper: {
              "aria-labelledby": "language-button",
            },
          }}
        >
          {supportedLanguages.map((lang) => (
            <MenuItem
              key={lang}
              onClick={() => handleMenuItemClick(lang)}
              selected={currentLanguage === lang}
              sx={{ fontFamily: "inherit" }}
            >
              <ListItemText sx={{ fontFamily: "inherit" }}>
                {languageNameMapping[lang]}
              </ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </>
  );
};

export default LanguageSwitcher;
