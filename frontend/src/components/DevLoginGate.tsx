import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { devLogin } from "../services/LocalAuth";

/** The local demo waits for its backend; connection errors are not invitation requirements. */
export default function DevLoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const request = useRef<{
    attempt: number;
    promise: ReturnType<typeof devLogin>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Reuse the in-flight request when StrictMode re-runs the effect.
    if (!request.current || request.current.attempt !== attempt) {
      request.current = { attempt, promise: devLogin() };
    }
    request.current.promise
      .then(() => {
        if (active) onSuccess();
      })
      .catch(() => {
        if (!active) return;
        if (attempt < 2) {
          timer = setTimeout(() => setAttempt((value) => value + 1), 1500);
        } else {
          setFailed(true);
        }
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [attempt, onSuccess]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: 3,
        bgcolor: "#f7f8fc",
      }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 360 }}>
        <Box
          component="img"
          src="/brand/xiaolian-duoduo-logo-horizontal-v1-300w.webp"
          alt="销练多多"
          sx={{ width: 180, height: "auto", mb: 3 }}
        />
        {failed ? (
          <Box role="alert">
            <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
              暂时连接不上服务
            </Typography>
            <Typography
              sx={{ mt: 1, mb: 2.5, color: "text.secondary", fontSize: 14 }}
            >
              服务可能还在启动，稍后重试即可。
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                request.current = null;
                setFailed(false);
                setAttempt(0);
              }}
              sx={{ borderRadius: "999px", px: 3, boxShadow: "none" }}
            >
              重新连接
            </Button>
          </Box>
        ) : (
          <Box role="status" aria-live="polite">
            <CircularProgress size={22} thickness={4} />
            <Typography sx={{ mt: 2, color: "text.secondary", fontSize: 14 }}>
              正在连接销练多多…
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
