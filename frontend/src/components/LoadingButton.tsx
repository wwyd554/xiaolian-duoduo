import React from "react";
import { useTranslation } from "react-i18next";
import { Button, CircularProgress } from "@mui/material";
import type { ButtonProps } from "@mui/material";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  children,
  loading = false,
  loadingText,
  disabled,
  startIcon,
  ...rest
}) => {
  const { t } = useTranslation();

  // デフォルトのローディングテキストは翻訳キーから取得
  const finalLoadingText = loadingText || t("common.loading");
  return (
    <Button
      disabled={loading || disabled}
      startIcon={
        loading ? <CircularProgress size={20} color="inherit" /> : startIcon
      }
      {...rest}
    >
      {loading ? finalLoadingText : children}
    </Button>
  );
};

export default LoadingButton;
