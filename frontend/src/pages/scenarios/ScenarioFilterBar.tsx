import { useId, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import { useTranslation } from "react-i18next";

import { designTokens as d } from "../../theme/designTokens";

type FilterOption = { value: string; label: string };

const filterButtonSx = {
  minWidth: 0,
  minHeight: 44,
  px: 1.75,
  py: 0.75,
  borderRadius: d.radius.control,
  color: d.colors.muted,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  bgcolor: d.colors.surface,
  border: `1px solid ${d.colors.border}`,
  boxShadow: "none",
  "&:hover": { bgcolor: d.colors.primarySoft, boxShadow: "none" },
  "&.Mui-focusVisible": { ...d.focus },
} as const;

function FilterMenu({
  label,
  ariaLabel,
  value,
  active,
  options,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  active: boolean;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  return (
    <>
      <Button
        id={`${id}-trigger`}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          ...filterButtonSx,
          ...((active || open) && {
            bgcolor: d.colors.primarySoft,
            color: d.colors.primaryHover,
            borderColor: d.colors.primaryBorder,
          }),
        }}
      >
        {label}
      </Button>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 176,
              maxWidth: 280,
              maxHeight: 340,
              borderRadius: "16px",
              bgcolor: d.colors.surface,
              border: "1px solid rgba(32, 39, 57, .06)",
              boxShadow: d.shadow.overlay,
            },
          },
          list: { "aria-labelledby": `${id}-trigger`, sx: { p: 0.75 } },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === value}
            role="menuitemradio"
            aria-checked={option.value === value}
            onClick={() => {
              onChange(option.value);
              setAnchor(null);
            }}
            sx={{
              minHeight: 44,
              px: 1.5,
              py: 1,
              my: 0.25,
              gap: 2,
              borderRadius: d.radius.control,
              color: d.colors.ink,
              fontSize: 14,
              "&.Mui-selected": { bgcolor: d.colors.primarySoft },
              "&.Mui-selected:hover, &:hover, &.Mui-focusVisible": {
                bgcolor: d.colors.surfaceSoft,
              },
            }}
          >
            <Box component="span" sx={{ flex: 1 }}>
              {option.label}
            </Box>
            <CheckRoundedIcon
              sx={{
                fontSize: 17,
                visibility: option.value === value ? "visible" : "hidden",
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

type ScenarioFilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  difficulty: string;
  onDifficultyChange: (value: string) => void;
  difficultyOptions: FilterOption[];
  category: string;
  categories: string[];
  onCategoryChange: (value: string) => void;
  sortOrder: string;
  onSortChange: (value: string) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  resultCount: number;
  hasActiveFilters: boolean;
  onReset: () => void;
};

export default function ScenarioFilterBar(props: ScenarioFilterBarProps) {
  const { t } = useTranslation();
  const sortOptions = [
    { value: "difficulty", label: t("scenarios.sort.byDifficulty") },
    { value: "industry", label: t("scenarios.sort.byIndustry") },
    { value: "title", label: t("scenarios.sort.byTitle") },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1.5,
        mb: 2,
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <FilterMenu
          label={
            props.difficulty === "all"
              ? t("scenarios.management.difficulty")
              : props.difficultyOptions.find(
                  (option) => option.value === props.difficulty,
                )?.label || props.difficulty
          }
          ariaLabel={t("scenarios.workspace.difficultyFilterAria")}
          value={props.difficulty}
          active={props.difficulty !== "all"}
          options={props.difficultyOptions}
          onChange={props.onDifficultyChange}
        />
        <FilterMenu
          label={
            props.category === "all" ? t("scenarios.industry") : props.category
          }
          ariaLabel={t("scenarios.workspace.categoryFilterAria")}
          value={props.category}
          active={props.category !== "all"}
          options={[
            { value: "all", label: t("scenarios.filters.allIndustries") },
            ...props.categories.map((category) => ({
              value: category,
              label: category,
            })),
          ]}
          onChange={props.onCategoryChange}
        />
        <FilterMenu
          label={
            props.sortOrder === "difficulty"
              ? t("scenarios.workspace.sortLabel")
              : sortOptions.find((option) => option.value === props.sortOrder)
                  ?.label || props.sortOrder
          }
          ariaLabel={t("scenarios.workspace.sortAria")}
          value={props.sortOrder}
          active={props.sortOrder !== "difficulty"}
          options={sortOptions}
          onChange={props.onSortChange}
        />
        <Button
          aria-pressed={props.favoritesOnly}
          onClick={props.onToggleFavorites}
          startIcon={
            props.favoritesOnly ? (
              <StarRoundedIcon />
            ) : (
              <StarBorderRoundedIcon />
            )
          }
          sx={{
            ...filterButtonSx,
            ...(props.favoritesOnly && {
              bgcolor: d.colors.primarySoft,
              color: d.colors.primaryHover,
              borderColor: d.colors.primaryBorder,
            }),
            "& .MuiButton-startIcon": { mr: 0.65, "& svg": { fontSize: 17 } },
          }}
        >
          {t("scenarios.filters.favoritesOnly")}
        </Button>
        {props.hasActiveFilters && (
          <Button
            onClick={props.onReset}
            size="small"
            sx={{
              minWidth: 0,
              px: 1,
              color: "text.secondary",
              fontSize: 12,
              borderRadius: "10px",
            }}
          >
            {t("scenarios.workspace.clearFilters")}
          </Button>
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          ml: { sm: "auto" },
          width: { xs: "100%", sm: "auto" },
        }}
      >
        <Typography
          role="status"
          aria-live="polite"
          sx={{ flexShrink: 0, color: "text.secondary", fontSize: 12 }}
        >
          {t("scenarios.showingItems", { count: props.resultCount })}
        </Typography>
        <TextField
          placeholder={t("scenarios.searchPlaceholder")}
          size="small"
          value={props.searchQuery}
          onChange={(event) => props.onSearchChange(event.target.value)}
          sx={{
            width: { xs: "auto", sm: 240 },
            flex: { xs: 1, sm: "0 0 auto" },
            minWidth: 0,
            "& .MuiOutlinedInput-root": {
              height: 44,
              pl: 1.5,
              pr: 1,
              borderRadius: d.radius.control,
              fontSize: 13,
              bgcolor: d.colors.surface,
              "& fieldset": { borderColor: d.colors.controlBorder },
              "&:hover fieldset": { borderColor: d.colors.primaryBorder },
              "&.Mui-focused fieldset": {
                borderWidth: 1,
                borderColor: d.colors.primary,
              },
            },
          }}
          slotProps={{
            htmlInput: { "aria-label": t("scenarios.searchPlaceholder") },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon
                    sx={{ fontSize: 18, color: d.colors.subtle }}
                  />
                </InputAdornment>
              ),
              endAdornment: props.searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label={t("scenarios.workspace.clearSearch")}
                    onClick={() => props.onSearchChange("")}
                    sx={{ p: 0.5 }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
      </Box>
    </Box>
  );
}
