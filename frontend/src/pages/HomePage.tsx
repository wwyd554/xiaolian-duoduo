import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

const ScenarioSelectPage = lazy(() => import("./ScenarioSelectPage"));

export default function HomePage() {
  return <Suspense fallback={<Box sx={{ p: 6, textAlign: "center" }}><CircularProgress aria-label="正在加载工作台" /></Box>}><ScenarioSelectPage workspaceHome /></Suspense>;
}
