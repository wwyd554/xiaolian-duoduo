import { keyframes } from "@mui/system";

// 淡入
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

// 淡出
export const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

// 滑入（从上方）
export const slideInFromTop = keyframes`
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// 滑入（从下方）
export const slideInFromBottom = keyframes`
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// 滑入（从左侧）
export const slideInFromLeft = keyframes`
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

// 滑入（从右侧）
export const slideInFromRight = keyframes`
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

// 脉冲（闪烁）
export const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

// 缩放进入（放大显示）
export const scaleIn = keyframes`
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

// 弹跳（弹动）
export const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
`;

// 打字效果
export const typewriter = keyframes`
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
`;

// 旋转
export const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// 动画混合器
export const animationMixin = {
  fadeIn: {
    animation: `${fadeIn} 0.5s ease-in-out`,
  },
  fadeOut: {
    animation: `${fadeOut} 0.5s ease-in-out`,
  },
  slideInFromTop: {
    animation: `${slideInFromTop} 0.5s ease-out`,
  },
  slideInFromBottom: {
    animation: `${slideInFromBottom} 0.5s ease-out`,
  },
  slideInFromLeft: {
    animation: `${slideInFromLeft} 0.5s ease-out`,
  },
  slideInFromRight: {
    animation: `${slideInFromRight} 0.5s ease-out`,
  },
  pulse: {
    animation: `${pulse} 2s infinite ease-in-out`,
  },
  scaleIn: {
    animation: `${scaleIn} 0.3s ease-out`,
  },
  bounce: {
    animation: `${bounce} 1s ease`,
  },
  typewriter: {
    display: "inline-block",
    overflow: "hidden",
    whiteSpace: "nowrap",
    animation: `${typewriter} 3s steps(40, end)`,
  },
  spin: {
    animation: `${spin} 1s linear infinite`,
  },
};

// 用于交错（分阶段）动画的延迟
export const createStaggeredTransition = (
  baseDelay: number = 100,
  count: number = 10,
) => {
  const delays: Record<string, { transitionDelay: string }> = {};

  for (let i = 0; i < count; i++) {
    delays[`&:nth-of-type(${i + 1})`] = {
      transitionDelay: `${baseDelay * i}ms`,
    };
  }

  return delays;
};
