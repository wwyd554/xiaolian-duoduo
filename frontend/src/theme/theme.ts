import { createTheme, responsiveFontSizes } from "@mui/material";
import { designTokens as d } from "./designTokens";

const theme = responsiveFontSizes(
  createTheme({
    palette: {
      primary: {
        main: d.colors.primary,
        dark: d.colors.primaryHover,
        contrastText: d.colors.onPrimary,
      },
      secondary: { main: d.colors.ink },
      background: { default: d.colors.canvas, paper: d.colors.surface },
      text: { primary: d.colors.ink, secondary: d.colors.muted },
      divider: d.colors.border,
      success: { main: d.colors.success },
      warning: { main: d.colors.warning },
      error: { main: d.colors.danger },
      action: {
        hover: d.colors.primarySoft,
        disabledBackground: d.colors.disabled,
        disabled: d.colors.disabledText,
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: d.fontFamily,
      fontSize: 14,
      h1: { fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.3 },
      h2: { fontWeight: 700, letterSpacing: "-.025em", lineHeight: 1.35 },
      h3: { fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.4 },
      h4: { fontWeight: 600, letterSpacing: "-.02em" },
      h5: { fontWeight: 600, letterSpacing: "-.015em" },
      h6: { fontWeight: 600, letterSpacing: "-.01em" },
      body1: { fontSize: 16, lineHeight: 1.7 },
      body2: { fontSize: 14, lineHeight: 1.65 },
      button: { fontWeight: 600, letterSpacing: 0, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            margin: 0,
            padding: 0,
            width: "100%",
            minHeight: "100vh",
            overflow: "auto",
            backgroundColor: d.colors.canvas,
          },
          "#root": {
            width: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: d.radius.control,
            padding: "10px 18px",
            boxShadow: "none",
            "&.Mui-focusVisible": d.focus,
          },
          outlined: {
            borderColor: d.colors.controlBorder,
            color: d.colors.ink,
            "&:hover": {
              borderColor: d.colors.primaryBorder,
              backgroundColor: d.colors.primarySoft,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { "&.Mui-focusVisible": d.focus } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${d.colors.border}`,
            borderRadius: d.radius.card,
            boxShadow: d.shadow.card,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: d.radius.control,
            backgroundColor: d.colors.surface,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: d.colors.controlBorder,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: d.colors.primaryBorder,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: d.colors.primary,
              borderWidth: 1,
            },
          },
        },
      },
      MuiSelect: { styleOverrides: { select: { fontFamily: d.fontFamily } } },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 44,
            fontFamily: d.fontFamily,
            fontSize: 14,
            borderRadius: "8px",
          },
        },
      },
      MuiContainer: {
        styleOverrides: {
          root: { width: "100%", maxWidth: "100%", margin: "0 auto" },
        },
      },
    },
  }),
);

export default theme;
