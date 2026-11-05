import { useId, useRef, useState, type FormEvent } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { designTokens as d } from "../../theme/designTokens";

const promptKeys = ["renewal", "discovery", "investment"] as const;

export default function ScenarioPromptComposer({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const canSend = Boolean(prompt.trim());

  return (
    <Box
      component="section"
      aria-labelledby="workspace-title"
      sx={{
        maxWidth: compact ? "none" : 880,
        mx: "auto",
        pt: compact ? 0 : { xs: 1.5, md: 3 },
        pb: compact ? 3 : { xs: 3, md: 4 },
      }}
    >
      <Typography
        id="workspace-title"
        component={compact ? "h2" : "h1"}
        sx={{
          fontSize: compact ? 20 : { xs: 27, md: 38 },
          fontWeight: 700,
          lineHeight: 1.35,
          textAlign: compact ? "left" : "center",
          letterSpacing: "-.03em",
          textWrap: "balance",
          color: d.colors.ink,
        }}
      >
        {compact ? "也可以，练你自己的销售难题" : t("scenarios.composer.heading")}
      </Typography>
      {!compact && <Typography
        sx={{
          textAlign: "center",
          fontSize: { xs: 14, md: 16 },
          color: d.colors.muted,
          lineHeight: 1.7,
          mt: 1.25,
          mb: { xs: 2.5, md: 3 },
          textWrap: "pretty",
        }}
      >
        {t("scenarios.composer.description")}
      </Typography>}
      <Box
        component="form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (canSend)
            navigate("/scenarios/generate", {
              state: { prompt: prompt.trim() },
            });
        }}
        sx={{
          p: compact ? { xs: 2, sm: 2.5 } : { xs: 2, sm: 3 },
          mt: compact ? 1.5 : 0,
          bgcolor: d.colors.surface,
          border: `1px solid ${d.colors.controlBorder}`,
          borderRadius: d.radius.composer,
          boxShadow: d.shadow.composer,
          transition: d.transition,
          "&:focus-within": {
            borderColor: d.colors.primary,
            boxShadow: "0 0 0 3px rgba(37,99,235,.08)",
          },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Typography
          component="label"
          htmlFor={inputId}
          sx={{
            display: "block",
            color: d.colors.ink,
            fontSize: 14,
            fontWeight: 600,
            mb: 1,
          }}
        >
          {t("scenarios.composer.inputLabel")}
        </Typography>
        <TextField
          id={inputId}
          fullWidth
          multiline
          minRows={compact ? 1 : 2}
          maxRows={5}
          variant="standard"
          value={prompt}
          inputRef={inputRef}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("scenarios.composer.placeholder")}
          autoComplete="off"
          name="practice-situation"
          inputProps={{ maxLength: 2000 }}
          InputProps={{ disableUnderline: true }}
          sx={{
            "& .MuiInputBase-root": {
              fontSize: 16,
              lineHeight: 1.8,
              color: d.colors.ink,
            },
            "& textarea::placeholder": { color: d.colors.subtle, opacity: 1 },
          }}
        />
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mt: compact ? 1 : 2, gap: 1 }}
        >
          <Button
            color="inherit"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate("/scenarios/create")}
            sx={{
              minHeight: 44,
              minWidth: 0,
              px: 1.5,
              py: 1,
              border: `1px solid ${d.colors.border}`,
              borderRadius: d.radius.pill,
              color: d.colors.muted,
              fontSize: 13,
              fontWeight: 500,
              "&:hover": { bgcolor: d.colors.surfaceSoft },
              "&.Mui-focusVisible": d.focus,
            }}
          >
            {t("scenarios.composer.manualCreate")}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSend}
            aria-label={t("scenarios.composer.send")}
            sx={{
              minWidth: 88,
              height: 44,
              minHeight: 44,
              flexShrink: 0,
              px: 2,
              py: 0,
              borderRadius: d.radius.pill,
              bgcolor: d.colors.primary,
              color: d.colors.onPrimary,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              letterSpacing: 0,
              boxShadow: "none",
              "&:hover": { bgcolor: d.colors.primaryHover, boxShadow: "none" },
              "&.Mui-disabled": {
                bgcolor: d.colors.disabled,
                color: d.colors.disabledText,
              },
              "&.Mui-focusVisible": d.focus,
            }}
          >
            <Box
              component="span"
              translate="no"
              className="notranslate"
              sx={{
                display: "inline-block",
                flexShrink: 0,
                minWidth: "2em",
                whiteSpace: "nowrap",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              {t("scenarios.composer.send")}
            </Box>
          </Button>
        </Stack>
      </Box>
      <Stack
        direction="row"
        justifyContent={compact ? "flex-start" : "center"}
        sx={{ gap: 1, flexWrap: "wrap", mt: compact ? 1 : 2 }}
      >
        {promptKeys.map((key) => (
          <Button
            key={key}
            onClick={() => {
              setPrompt(t(`scenarios.composer.presets.${key}.prompt`));
              inputRef.current?.focus();
            }}
            sx={{
              bgcolor: d.colors.surface,
              border: `1px solid ${d.colors.border}`,
              color: d.colors.muted,
              borderRadius: d.radius.pill,
              minHeight: 44,
              px: 1.5,
              py: 1,
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.5,
              "&:hover": {
                bgcolor: d.colors.primarySoft,
                borderColor: d.colors.primaryBorder,
                color: d.colors.primaryHover,
              },
              "&.Mui-focusVisible": d.focus,
            }}
          >
            {t(`scenarios.composer.presets.${key}.label`)}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
