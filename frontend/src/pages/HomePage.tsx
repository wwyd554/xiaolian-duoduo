import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import { Trans, useTranslation } from "react-i18next";
import ExperienceFlowShowcase from "../components/home/ExperienceFlowShowcase";

const PRODUCT_PROOF_KEYS = [
  "home.hero.proofs.scenarios",
  "home.hero.proofs.emotionFeedback",
  "home.hero.proofs.reviewDimensions",
] as const;

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        minHeight: { xs: "auto", sm: "calc(100dvh - 32px)" },
        display: "flex",
        alignItems: "center",
        m: { xs: 0, sm: 2 },
        borderRadius: { xs: 0, sm: "32px" },
        border: { xs: "none", sm: "1px solid rgba(30,36,48,.07)" },
        background:
          "radial-gradient(circle at 78% 12%, rgba(151,156,255,.25), transparent 32%), radial-gradient(circle at 96% 82%, rgba(188,222,255,.52), transparent 34%), linear-gradient(135deg, #f6f2ea 0%, #f2efe9 48%, #edf0f8 100%)",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          zIndex: -1,
          width: { xs: 420, md: 760 },
          height: { xs: 420, md: 680 },
          borderRadius: "50%",
          top: { xs: 410, md: "48%" },
          right: { xs: "-45%", md: "-17%" },
          transform: { md: "translateY(-50%)" },
          background:
            "radial-gradient(circle at 42% 44%, rgba(233,225,255,.94), rgba(184,190,255,.52) 46%, rgba(173,211,255,.24) 68%, transparent 72%)",
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />

      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          zIndex: -1,
          width: 280,
          height: 280,
          left: -110,
          bottom: -155,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,.72)",
          filter: "blur(8px)",
        }}
      />

      <Container
        maxWidth="xl"
        sx={{
          position: "relative",
          py: { xs: 6, md: 3, lg: 3.5 },
          px: { xs: 2.5, sm: 2.5, md: 3, lg: 3.5, xl: 4.5 },
        }}
      >
        <Box
          component="section"
          aria-labelledby="home-hero-title"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              lg: "minmax(340px, .9fr) minmax(0, 1.1fr)",
              xl: "minmax(380px, .92fr) minmax(0, 1.08fr)",
            },
            alignItems: "center",
            gap: { xs: 6, md: 5, lg: 4, xl: 6 },
          }}
        >
          <Box sx={{ minWidth: 0, maxWidth: 680 }}>
            <Stack
              direction="row"
              alignItems="center"
              gap={0.8}
              sx={{
                width: "fit-content",
                mb: { xs: 2.5, md: 3 },
                px: 1.4,
                py: 0.75,
                borderRadius: 999,
                border: "1px solid rgba(30,36,48,.12)",
                bgcolor: "rgba(255,255,255,.54)",
              }}
            >
              <AutoAwesomeRounded sx={{ fontSize: 15, color: "#6659d9" }} />
              <Typography
                sx={{
                  color: "text.primary",
                  fontSize: 12,
                  fontWeight: 750,
                  letterSpacing: ".06em",
                }}
              >
                {t("home.hero.eyebrow")}
              </Typography>
            </Stack>

            <Typography
              id="home-hero-title"
              component="h1"
              sx={{
                maxWidth: 720,
                fontSize: {
                  xs: "2.78rem",
                  sm: "2.9rem",
                  md: "3.3rem",
                  lg: "3.35rem",
                  xl: "4.05rem",
                },
                fontWeight: 780,
                lineHeight: 0.98,
                letterSpacing: "-.062em",
                color: "#1f201e",
              }}
            >
              {t("home.hero.titleLine1")}
              <Box component="span" sx={{ display: "block" }}>
                <Trans
                  i18nKey="home.hero.titleLine2"
                  components={{
                    highlight: (
                      <Box
                        component="span"
                        sx={{
                          position: "relative",
                          display: "inline-block",
                          zIndex: 0,
                          "&::after": {
                            content: '""',
                            position: "absolute",
                            zIndex: -1,
                            left: "-.03em",
                            right: "-.05em",
                            bottom: ".06em",
                            height: ".22em",
                            borderRadius: 999,
                            bgcolor: "#a8a5ff",
                            transform: "rotate(-1.5deg)",
                          },
                        }}
                      />
                    ),
                  }}
                />
              </Box>
            </Typography>

            <Typography
              sx={{
                maxWidth: 600,
                color: "#565b66",
                fontSize: { xs: 16, md: 17, lg: 18 },
                lineHeight: 1.72,
                mt: { xs: 3, md: 3.5 },
              }}
            >
              {t("home.hero.description")}
            </Typography>

            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              gap={1.25}
              sx={{ mt: 4 }}
            >
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate("/scenarios")}
                sx={{
                  minWidth: 178,
                  py: 1.45,
                  px: 2.7,
                  borderRadius: 999,
                  bgcolor: "#1f201e",
                  color: "#fff",
                  boxShadow: "0 10px 24px rgba(31,32,30,.16)",
                  "&:hover": {
                    bgcolor: "#343532",
                    boxShadow: "0 12px 28px rgba(31,32,30,.2)",
                    transform: "translateY(-1px)",
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                    "&:hover": { transform: "none" },
                  },
                }}
              >
                {t("home.startButton")}
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<HistoryRounded />}
                onClick={() => navigate("/history")}
                sx={{
                  minWidth: 166,
                  py: 1.35,
                  borderRadius: 999,
                  color: "#1f201e",
                  borderColor: "rgba(31,32,30,.26)",
                  bgcolor: "rgba(255,255,255,.32)",
                  "&:hover": {
                    borderColor: "#1f201e",
                    bgcolor: "rgba(255,255,255,.62)",
                  },
                }}
              >
                {t("home.reviewButton")}
              </Button>
            </Stack>

            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              gap={{ xs: 1, sm: 1.2 }}
              sx={{ mt: { xs: 3.5, md: 4.25 } }}
            >
              {PRODUCT_PROOF_KEYS.map((key) => (
                <Stack
                  key={key}
                  direction="row"
                  alignItems="center"
                  gap={0.55}
                  sx={{
                    px: 1.15,
                    py: 0.65,
                    borderRadius: 999,
                    bgcolor: "rgba(255,255,255,.5)",
                    border: "1px solid rgba(30,36,48,.08)",
                  }}
                >
                  <CheckRounded sx={{ fontSize: 15, color: "#6659d9" }} />
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: "#565b66",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t(key)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box
            id="experience-flow"
            sx={{
              minWidth: 0,
              width: "100%",
              justifySelf: "center",
              transform: { md: "translateY(2px)" },
            }}
          >
            <ExperienceFlowShowcase />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;
