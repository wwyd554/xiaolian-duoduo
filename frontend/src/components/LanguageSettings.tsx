import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
} from "@mui/material";
import {
  languageNameMapping,
  supportedLanguages,
} from "../i18n/utils/languageUtils";
import { LanguageService } from "../services/LanguageService";

/**
 * 语言设置组件
 *
 * 用于在设置页面或个人资料页面修改语言设置的组件
 */
const LanguageSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const languageService = LanguageService.getInstance();

  const [selectedLanguage, setSelectedLanguage] = useState(() =>
    i18n.language.split("-")[0]
  );

  // 语言变更处理器
  const handleLanguageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newLang = event.target.value;
    setSelectedLanguage(newLang);

    try {
      // 使用语言服务更改语言（同时进行持久化）
      await languageService.changeLanguage(newLang);
      console.log("已切换语言:", newLang);
    } catch (error) {
      console.error("语言切换错误:", error);
      // 出错时恢复原选择
      setSelectedLanguage(i18n.language.split("-")[0]);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t("settings.language")}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">{t("settings.language")}</FormLabel>
            <RadioGroup
              aria-label="language"
              name="language"
              value={selectedLanguage}
              onChange={handleLanguageChange}
            >
              {supportedLanguages.map((lang) => (
                <FormControlLabel
                  key={lang}
                  value={lang}
                  control={<Radio />}
                  label={languageNameMapping[lang]}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LanguageSettings;
