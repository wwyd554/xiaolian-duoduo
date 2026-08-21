import React, { useState, useEffect, useRef } from "react";
import { Box, Paper, Typography, Avatar } from "@mui/material";
import { alpha, Theme } from "@mui/material/styles";

interface AnimatedMessageProps {
  content: string;
  sender: "user" | "npc";
  timestamp: Date | string;
  avatar?: string;
  name?: string;
  animationDelay?: number;
  typingEffect?: boolean;
}

const AnimatedMessage: React.FC<AnimatedMessageProps> = ({
  content,
  sender,
  timestamp,
  avatar,
  name,
  animationDelay = 0,
  typingEffect = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(typingEffect);
  const messageRef = useRef<HTMLDivElement>(null);

  // メッセージのアニメーション表示
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);

    return () => clearTimeout(timer);
  }, [animationDelay]);

  // タイピングエフェクト
  useEffect(() => {
    if (!isTyping || !isVisible) return;

    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(content.substring(0, index));
      index++;

      if (index > content.length) {
        clearInterval(interval);
        setIsTyping(false);
        setDisplayedText(content);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [content, isTyping, isVisible]);

  // 表示する日時
  const displayTime =
    typeof timestamp === "string"
      ? new Date(timestamp).toLocaleTimeString()
      : timestamp.toLocaleTimeString();

  // ユーザーまたはNPCに応じたスタイル
  const isUser = sender === "user";

  return (
    <Box
      ref={messageRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        mb: 2,
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translateY(0)"
          : isUser
            ? "translateY(20px)"
            : "translateY(-20px)",
        transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
      }}
    >
      <Box display="flex" alignItems="flex-end" gap={1}>
        {!isUser && (
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.8),
              fontSize: "1rem",
            }}
          >
            {avatar || name?.charAt(0) || "N"}
          </Avatar>
        )}

        <Paper
          elevation={1}
          sx={{
            p: 1.5,
            borderRadius: 2,
            maxWidth: "80%",
            bgcolor: isUser
              ? (theme: Theme) => alpha(theme.palette.primary.main, 0.1)
              : (theme: Theme) => alpha(theme.palette.grey[100], 1),
            borderTopRightRadius: isUser ? 0 : 16,
            borderTopLeftRadius: isUser ? 16 : 0,
            position: "relative",
          }}
        >
          {name && (
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="medium"
              display="block"
              mb={0.5}
            >
              {name}
            </Typography>
          )}

          <Typography variant="body1">
            {isTyping ? displayedText : content}
            {isTyping && (
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: "0.5em",
                  height: "1em",
                  bgcolor: "text.primary",
                  ml: 0.5,
                  animation: "blink 1s infinite",
                  "@keyframes blink": {
                    "0%, 100%": { opacity: 0 },
                    "50%": { opacity: 1 },
                  },
                }}
              />
            )}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              mt: 0.5,
              textAlign: isUser ? "right" : "left",
            }}
          >
            {displayTime}
          </Typography>
        </Paper>

        {isUser && (
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: (theme: Theme) =>
                alpha(theme.palette.secondary.main, 0.8),
              fontSize: "1rem",
            }}
          >
            {avatar || "U"}
          </Avatar>
        )}
      </Box>
    </Box>
  );
};

export default AnimatedMessage;
