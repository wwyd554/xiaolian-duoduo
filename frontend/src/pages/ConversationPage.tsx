import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type {
  Message,
  Metrics,
  Session,
  Goal,
  GoalStatus,
  Scenario,
} from "../types/index";
import type {
  ComplianceViolation,
  DifficultyLevel
} from "../types/api";
import type { CompositionEventType } from "../types/components";
import { getSessionEndReason } from "../utils/dialogueEngine";
import { ApiService } from "../services/ApiService";
import { AudioService } from "../services/AudioService";
import { LanguageService } from "../services/LanguageService";
import { PollyService } from "../services/PollyService";
import { TranscribeService, ConnectionState } from "../services/TranscribeService";
import type { EmotionState } from "../types/index";
import {
  initializeGoalStatuses,
  calculateGoalScore,
  areAllRequiredGoalsAchieved,
  mergeGoalStatus,
} from "../utils/goalUtils";
import VideoManager from "../components/recording/v2/VideoManager";
import {
  loadVideoRecordingEnabled,
  saveVideoRecordingEnabled,
} from "../utils/videoRecordingSettings";

// 导入拆分的组件
import ConversationHeader from "../components/conversation/ConversationHeader";
import { AvatarProvider } from "../components/avatar";
import type { GestureType } from "../types/avatar";
import MessageList from "../components/conversation/MessageList";
import MessageInput from "../components/conversation/MessageInput";
import SuggestionBar from "../components/conversation/SuggestionBar";
// 添加用于清理的 useEffect
import { useEffect, useState, useCallback, useRef } from "react";
import ComplianceAlert from "../components/compliance/ComplianceAlert";
// 新组件
import MetricsOverlay from "../components/conversation/MetricsOverlay";
import RightPanelContainer from "../components/conversation/RightPanelContainer";
import CoachingHintBar from "../components/conversation/CoachingHintBar";
import AvatarStage from "../components/conversation/AvatarStage";
import SessionSettingsPanel from "../components/conversation/SessionSettingsPanel";
import SlideTray from "../components/conversation/SlideTray";
import SlideZoomModal from "../components/conversation/SlideZoomModal";
import type { SlideImageInfo } from "../types/api";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";

/**
 * 右面板（目标、指标等）的占用宽度
 * RightPanelContainer 的 maxWidth(260px) + right(12px) + 边距(8px) = 280px
 */
const RIGHT_PANEL_OFFSET = "280px";

/**
 * 左侧指标、相机区域的占用宽度
 * 头像隐藏时避免聊天记录重叠的左内边距
 */
const LEFT_METRICS_OFFSET = "200px";

/**
 * NPC 响应延迟设置（毫秒）
 * 测试环境下设为 0 以提高可测试性
 */
const NPC_RESPONSE_BASE_DELAY = import.meta.env.VITE_NPC_RESPONSE_DELAY
  ? Number(import.meta.env.VITE_NPC_RESPONSE_DELAY)
  : 1000;
const NPC_RESPONSE_RANDOM_DELAY = import.meta.env.VITE_NPC_RESPONSE_DELAY
  ? 0
  : 1000;

/**
 * 会话页面组件
 */
const ConversationPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // 状態管理
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // 以引用方式保持消息历史，避免异步更新的问题
  const messagesRef = useRef<Message[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<Metrics>({
    angerLevel: 0,
    trustLevel: 0,
    progressLevel: 0,
  });
  const [prevMetrics, setPrevMetrics] = useState<Metrics | null>(null);
  const [userInput, setUserInput] = useState("");
  // 保持语音识别已确定的文本
  const [, setConfirmedTranscripts] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  // 会话开始后用于防止组件重新挂载的 Ref
  const hasComponentMounted = useRef(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  // 头像表情状态管理用的状态变量
  const [currentEmotion, setCurrentEmotion] = useState<string>("neutral");
  // NPC 情绪状态（从实时评估获取，直接传给头像）
  const [npcDirectEmotion, setNpcDirectEmotion] = useState<EmotionState | undefined>(undefined);
  // NPC 手势状态（从实时评估获取，传给头像）
  const [npcGesture, setNpcGesture] = useState<GestureType>('none');
  // 建议回复候选项（从实时评估获取，传给建议按钮）
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // 场景的建议回复按钮启用/禁用
  const [suggestionEnabled, setSuggestionEnabled] = useState<boolean>(false);
  // 场景的初始建议回复候选项（洽谈开始时显示）
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  // 与场景关联的头像 ID
  const [scenarioAvatarId, setScenarioAvatarId] = useState<string | undefined>(undefined);
  // 与场景关联的头像 S3 key
  const [scenarioAvatarS3Key, setScenarioAvatarS3Key] = useState<string | undefined>(undefined);
  // 场景 NPC 的语音模型 ID
  const [scenarioVoiceId, setScenarioVoiceId] = useState<string | undefined>(undefined);
  // 场景的头像显示开/关
  const [enableAvatar, setEnableAvatar] = useState<boolean>(false);
  // 会话中的头像显示切换（运行时开关）
  const [avatarVisible, setAvatarVisible] = useState<boolean>(false);
  // 幻灯片相关 state
  const [slideImages, setSlideImages] = useState<SlideImageInfo[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [presentedSlidePages, setPresentedSlidePages] = useState<number[]>([]);
  const [isSlideZoomOpen, setIsSlideZoomOpen] = useState(false);
  const presentedSlidePagesRef = useRef<number[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioVolume, setAudioVolume] = useState<number>(80);
  const [speechRate, setSpeechRate] = useState<number>(1.15);
  const [isListening, setIsListening] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false); // 常时麦克风输入模式
  const [speechRecognitionError, setSpeechRecognitionError] = useState<
    "permission" | "no-speech" | "network" | "not-supported" | "unknown" | null
  >(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [metricsUpdating, setMetricsUpdating] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStatuses, setGoalStatuses] = useState<GoalStatus[]>([]);

  // Transcribe 语音识别服务的引用
  const transcribeServiceRef = useRef<TranscribeService | null>(null);
  // 引用最新 userInput 的 Ref
  const userInputRef = useRef<string>("");
  // 目标达成分数（会话结束时使用）
  const [goalScore, setGoalScore] = useState<number>(0);
  // 手势重置用定时器
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // NPC 响应定时器 Ref 管理（卸载时清理用）
  const npcResponseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 管理 isSpeaking/currentMetrics（为从 sendMessage 的依赖数组中排除）
  const isSpeakingRef = useRef(isSpeaking);
  const currentMetricsRef = useRef<Metrics>({ angerLevel: 0, trustLevel: 0, progressLevel: 0 });
  // 用 ref 管理 goalStatuses/goals/slideImages（为从 sendMessage 的依赖数组中排除）
  const goalStatusesRef = useRef<GoalStatus[]>([]);
  const goalsRef = useRef<Goal[]>([]);
  const slideImagesRef = useRef<SlideImageInfo[]>([]);
  // 用 ref 管理 suggestionEnabled（为从 sendMessage 的依赖数组中排除）
  const suggestionEnabledRef = useRef<boolean>(false);

  // 将 userInput 的变更同步到 ref
  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  // 将 isSpeaking 的变更同步到 ref
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // 将 currentMetrics 的变更同步到 ref
  useEffect(() => {
    currentMetricsRef.current = currentMetrics;
  }, [currentMetrics]);

  // 将 goalStatuses/goals/slideImages 的变更同步到 ref
  useEffect(() => {
    goalStatusesRef.current = goalStatuses;
  }, [goalStatuses]);

  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  useEffect(() => {
    slideImagesRef.current = slideImages;
  }, [slideImages]);

  // 将 suggestionEnabled 的变更同步到 ref
  useEffect(() => {
    suggestionEnabledRef.current = suggestionEnabled;
  }, [suggestionEnabled]);
  // 合规违规通知管理
  const [activeViolation, setActiveViolation] =
    useState<ComplianceViolation | null>(null);
  const [showComplianceAlert, setShowComplianceAlert] =
    useState<boolean>(false);
  // 相机初始化状态管理
  const [isCameraInitialized, setIsCameraInitialized] = useState<boolean>(false);
  // 相机错误状态管理
  const [cameraError, setCameraError] = useState<boolean>(false);
  // 视频录制功能的开/关设置（localStorage 持久化，默认开启）
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState<boolean>(
    loadVideoRecordingEnabled,
  );

  // 将视频录制设置的变更持久化到 localStorage
  useEffect(() => {
    saveVideoRecordingEnabled(videoRecordingEnabled);

    // 录制被禁用时，VideoManager 会卸载，相机初始化回调
    // 将不再被调用，因此显式重置相机相关 state，使状态含义保持一致。
    // （录制禁用时不使用相机，因此恢复到既非已初始化也非错误的状态）
    if (!videoRecordingEnabled) {
      setIsCameraInitialized(false);
      setCameraError(false);
    }
  }, [videoRecordingEnabled]);

  // 新布局用 state
  const [rightPanelsVisible, setRightPanelsVisible] = useState<boolean>(true);
  const [metricsVisible, setMetricsVisible] = useState<boolean>(true);
  const [chatLogExpanded] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);


  // 组件初始挂载时的标志设置
  useEffect(() => {
    hasComponentMounted.current = true;

    // TranscribeService 的初始化
    transcribeServiceRef.current = TranscribeService.getInstance();

    // 设置连接状态变更回调
    transcribeServiceRef.current.setOnConnectionStateChange((state: ConnectionState) => {
      setConnectionState(state);
    });

    // 从环境变量获取 WebSocket 端点
    const websocketEndpoint = import.meta.env.VITE_TRANSCRIBE_WEBSOCKET_URL;
    if (websocketEndpoint) {
      transcribeServiceRef.current.setWebSocketEndpoint(websocketEndpoint);
    }

    return () => {
      // 组件卸载时释放资源
      if (transcribeServiceRef.current) {
        transcribeServiceRef.current.dispose();
      }

      // 手势定时器的清理
      if (gestureTimerRef.current) {
        clearTimeout(gestureTimerRef.current);
      }

      // 清除 NPC 响应定时器和回退定时器
      if (npcResponseTimerRef.current) clearTimeout(npcResponseTimerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

      // 同时清除语音识别相关状态
      setConfirmedTranscripts([]);
    };
  }, []);

  // 初期化
  useEffect(() => {
    const fetchScenario = async () => {
      if (scenarioId) {
        try {
          const apiService = ApiService.getInstance();
          const scenarioInfo = await apiService.getScenarioDetail(scenarioId);

          if (scenarioInfo) {

            // 将从 API 获取的 ScenarioInfo 类型转换为 Scenario 类型
            const convertedScenario: Scenario = {
              id: scenarioInfo.scenarioId,
              title: scenarioInfo.title,
              description: scenarioInfo.description,
              difficulty: scenarioInfo.difficulty as DifficultyLevel,
              industry: scenarioInfo.category || scenarioInfo.industry || "",
              // 反映场景中定义的初始消息和语言
              initialMessage: scenarioInfo.initialMessage,
              language: scenarioInfo.language || "zh",
              npc: {
                // 对应 API 中可能使用的是 npc 字段而非 npcInfo 的情况
                id:
                  scenarioInfo.npc?.id ||
                  scenarioInfo.npcInfo?.id ||
                  `npc-${scenarioId}`,
                name:
                  scenarioInfo.npc?.name || scenarioInfo.npcInfo?.name || "",
                role:
                  scenarioInfo.npc?.role || scenarioInfo.npcInfo?.role || "",
                company:
                  scenarioInfo.npc?.company ||
                  scenarioInfo.npcInfo?.company ||
                  "",
                personality:
                  scenarioInfo.npc?.personality ||
                  scenarioInfo.npcInfo?.personality ||
                  [],
                avatar:
                  scenarioInfo.npc?.avatar ||
                  scenarioInfo.npcInfo?.avatar ||
                  "👤",
                description:
                  scenarioInfo.npc?.description ||
                  scenarioInfo.npcInfo?.description ||
                  "",
              },
              // 将可能以字符串类型返回的 maxTurns 转换为数值类型
              maxTurns:
                scenarioInfo.maxTurns !== undefined
                  ? Number(scenarioInfo.maxTurns)
                  : undefined,
              goals: (scenarioInfo.goals || []).map((goal) => {
                // goal 为字符串时转换为对象
                if (typeof goal === "string") {
                  return {
                    id: `goal-${Math.random().toString(36).substring(2, 11)}`,
                    description: goal,
                    priority: 3,
                    criteria: [],
                    isRequired: false,
                  };
                }
                // goal 为对象时确认所需属性
                return {
                  id:
                    goal.id ||
                    `goal-${Math.random().toString(36).substring(2, 11)}`,
                  description: goal.description || "",
                  priority: Number(goal.priority || 3),
                  criteria: goal.criteria || [],
                  isRequired: Boolean(goal.isRequired),
                };
              }),
              initialMetrics: {
                // 字符串类型时转换为数值
                angerLevel: Number(
                  scenarioInfo.initialMetrics?.angerLevel || 1,
                ),
                trustLevel: Number(
                  scenarioInfo.initialMetrics?.trustLevel || 1,
                ),
                progressLevel: Number(
                  scenarioInfo.initialMetrics?.progressLevel || 1,
                ),
              },
            };

            setScenario(convertedScenario);
            setCurrentMetrics(convertedScenario.initialMetrics);

            // 读取场景的头像显示开/关设置（未设置时默认为 false）
            setEnableAvatar(scenarioInfo.enableAvatar ?? false);
            // 运行时开关的初始值也与场景设置保持一致
            setAvatarVisible(scenarioInfo.enableAvatar ?? false);

            // 读取场景的建议回复按钮启用/禁用设置（未设置时默认为 false）
            setSuggestionEnabled(scenarioInfo.suggestionEnabled ?? false);
            // 读取场景的初始建议回复候选项（未设置时为空数组）
            setInitialSuggestions(scenarioInfo.initialSuggestions ?? []);

            // 设置场景 NPC 的语音模型 ID（在获取头像 API 前立即设置）
            // 等待头像详情 API 完成会导致 voiceId 设置延迟，
            // 从而防止初始消息的语音合成回退到默认（Takumi/男性）的问题
            const npcVoiceId = scenarioInfo.npc?.voiceId || scenarioInfo.npcInfo?.voiceId;
            if (npcVoiceId) {
              setScenarioVoiceId(npcVoiceId);
            }

            // 设置与场景关联的头像 ID
            if (scenarioInfo.avatarId) {
              setScenarioAvatarId(scenarioInfo.avatarId);
              // 从头像详情 API 获取 s3Key
              try {
                const { AvatarService } = await import("../services/AvatarService");
                const avatarDetail = await AvatarService.getInstance().getAvatarDetail(scenarioInfo.avatarId);
                if (avatarDetail?.s3Key) {
                  setScenarioAvatarS3Key(avatarDetail.s3Key);
                }
              } catch {
                // 头像 s3Key 获取失败时使用 CloudFront 回退
              }
            }

            // 获取提案资料的幻灯片图片
            if (scenarioInfo.presentationFile) {
              try {
                const slidesResponse = await apiService.getSlideImages(scenarioInfo.scenarioId);
                if (slidesResponse.status === 'ready' && slidesResponse.slides.length > 0) {
                  setSlideImages(slidesResponse.slides.map(s => ({
                    pageNumber: s.pageNumber,
                    imageKey: s.imageKey,
                    imageUrl: s.imageUrl,
                    thumbnailUrl: s.thumbnailUrl,
                  })));
                }
              } catch {
                // 幻灯片获取失败时忽略（按无提案资料处理）
              }
            }

            // 目标信息的初始化
            setGoals(
              convertedScenario.goals && convertedScenario.goals.length > 0
                ? convertedScenario.goals
                : []
            );
            const initialGoalStatuses =
              initializeGoalStatuses(convertedScenario);
            setGoalStatuses(initialGoalStatuses);

            // AudioService 的初始设置在另一个 useEffect 中管理
          } else {
            navigate("/scenarios");
          }
        } catch (error) {
          console.error("场景信息获取失败:", error);
          navigate("/scenarios");
        }
      }
    };

    fetchScenario();
  }, [scenarioId, navigate]);

  // 音频设置的初始应用（场景获取后）
  useEffect(() => {
    if (scenario) {
      const audioSvc = AudioService.getInstance();
      audioSvc.setAudioEnabled(audioEnabled);
      audioSvc.setVolume(audioVolume / 100);
    }
  }, [scenario, audioEnabled, audioVolume]);

  // 音频设置变更时的处理
  useEffect(() => {
    const audioSvc = AudioService.getInstance();
    audioSvc.setAudioEnabled(audioEnabled);
    audioSvc.setVolume(audioVolume / 100);

    // 音频输出关闭时：停止正在播放的音频，并重置口型
    if (!audioEnabled) {
      audioSvc.stopAllAudio();
      setIsSpeaking(false);
    }
  }, [audioEnabled, audioVolume]);

  // 朗读速度变更时的处理
  useEffect(() => {
    const pollySvc = PollyService.getInstance();
    pollySvc.setSpeechRate(speechRate);
  }, [speechRate]);

  // 根据场景语言设置 UI 语言
  useEffect(() => {
    if (scenario?.language) {
      const languageService = LanguageService.getInstance();
      const currentLang = languageService.getCurrentLanguage();

      // 场景语言与 UI 语言不同时，也变更 UI 语言
      if (scenario.language !== currentLang) {
        languageService
          .changeLanguage(scenario.language)
          .catch((err) => console.error("语言设置切换失败:", err));
      }
    }
  }, [scenario?.language]);

  // 商談開始
  // 录制相关 state 已迁移到 VideoManager 组件

  // 洽谈开始（启动相机并开始录制）
  const startConversation = async () => {
    if (!scenario) return;

    // 在 React 18 的 Strict 模式下防止双重渲染
    if (sessionStarted) {
      return;
    }

    // 在前端生成会话 ID
    const newSessionId = crypto.randomUUID();

    // 先设置会话 ID，确保状态更新可靠
    setSessionId(newSessionId);

    // 将会话保存到 DynamoDB（即使通过 AgentCore 进行的对话也能在评估页面中查看）
    const apiService = ApiService.getInstance();
    try {
      await apiService.createOrUpdateSession(
        newSessionId,
        scenario.id,
        `与${scenario.npc.name}的会话`,
        {
          name: scenario.npc.name,
          role: scenario.npc.role,
          company: scenario.npc.company,
          personality: scenario.npc.personality,
          description: scenario.npc.description,
        }
      );
    } catch (error) {
      console.error("会话保存错误（对话将继续）:", error);
      // 即使发生错误也可以继续会话
    }

    // Transcribe WebSocket 的初始化
    if (transcribeServiceRef.current) {
      transcribeServiceRef.current.initializeConnection(newSessionId, scenario?.language || 'zh')
        .catch(error => {
          console.error("Transcribe WebSocket连接错误:", error);
          // 即使有错误也可以继续正常会话
        });
    }

    // 加入短暂延迟以确保会话 ID 状态更新被可靠反映
    setTimeout(() => {
      setSessionStarted(true);
    }, 50);

    // 使用场景中定义的初始消息，否则显示默认消息
    const initialContent =
      scenario?.initialMessage ||
      `你好，我是${scenario?.npc.company}的${scenario?.npc.name}。今天想和你聊聊，方便吗？`;

    // 稍作延迟后添加消息（为渲染稳定）
    setTimeout(() => {
      const initialMessageId = crypto.randomUUID();

      const initialMessage: Message = {
        id: initialMessageId,
        sender: "npc",
        content: initialContent,
        timestamp: new Date(),
        metrics: currentMetrics,
      };

      // 同时更新 messagesRef 以保持一致（Bug 修复）
      const initialMessages = [initialMessage];
      messagesRef.current = initialMessages;
      setMessages(initialMessages);
      setCurrentEmotion("neutral");

      // 显示首次建议回复候选项（场景中启用且已设置首轮候选时）
      if (suggestionEnabled && initialSuggestions.length > 0) {
        setSuggestions(initialSuggestions);
      }
    }, 100); // 延迟 100ms

    // 初始消息的语音合成
    if (audioEnabled) {
      setIsSpeaking(true);
      const audioSvc = AudioService.getInstance();
      const initialMessageId = crypto.randomUUID();
      audioSvc
        .synthesizeAndQueueAudio(initialContent, initialMessageId, scenarioVoiceId)
        .then(() => {
          // 语音合成成功后，添加音频播放完成监听器
          audioSvc.addPlaybackCompleteListener(initialMessageId, () => {
            setIsSpeaking(false);
          });
        })
        .catch((error) => {
          console.error("初始消息的语音合成错误:", error);
          const synth = window.speechSynthesis;
          if (synth) {
            const utterance = new SpeechSynthesisUtterance(initialContent);
            utterance.lang = "ja-JP";
            utterance.onend = () => setIsSpeaking(false);
            synth.speak(utterance);
          } else {
            // 回退：语音合成不可用时
            setTimeout(() => setIsSpeaking(false), 3000);
          }
        });
    }
  };

  /**
   * 语音识别文本的规范化（去除重复等）
   */
  const normalizeTranscriptText = useCallback((text: string): string => {
    if (!text) return "";
    let cleanedText = text.trim();

    // 按句子去重
    const sentences = cleanedText.split(/[。.？?！!\n]/).map(s => s.trim()).filter(s => s);
    if (sentences.length >= 2) {
      const uniqueSentences = [...new Set(sentences)];
      if (uniqueSentences.length < sentences.length) {
        cleanedText = uniqueSentences.join('。') + '。';
      }
    }

    // 按短语去重
    const words = cleanedText.split(/\s+/);
    if (words.length >= 2) {
      const halfIndex = Math.ceil(words.length / 2);
      const firstHalf = words.slice(0, halfIndex).join(' ');
      const secondHalf = words.slice(halfIndex).join(' ');

      if (firstHalf === secondHalf ||
        (firstHalf.length > 3 && secondHalf.includes(firstHalf)) ||
        (secondHalf.length > 3 && firstHalf.includes(secondHalf))) {
        cleanedText = firstHalf;
      }
    }

    return cleanedText;
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (inputText?: string) => {
    // 使用参数传入的文本或当前 userInput（通过 ref 获取最新值）
    const messageText = inputText || userInputRef.current.trim();
    if (!messageText || !scenario || isProcessing) return;

    // 语音识别中则停止（发送时自动关闭麦克风）
    if (transcribeServiceRef.current && transcribeServiceRef.current.isListening()) {
      transcribeServiceRef.current.stopListening();
      setIsListening(false);
      setContinuousListening(false);
    }

    // 禁用输入字段（API 处理中）
    setIsProcessing(true);

    // 添加用户消息
    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      content: messageText,
      timestamp: new Date(),
      presentedSlides: presentedSlidePagesRef.current.length > 0
        ? [...presentedSlidePagesRef.current]
        : undefined,
    };

    // 使用引用确保维持最新的消息历史（Bug 修复）
    const currentMessages = messagesRef.current;
    const updatedMessages = [...currentMessages, userMessage];

    // 同时更新两处以确保同步
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);

    // 在清除输入前也更新 userInputRef 以确保同步
    userInputRef.current = "";
    setUserInput("");

    // 同时重置语音识别状态
    setConfirmedTranscripts([]);

    // 发送时清除建议回复候选项（将在下次评估结果中更新）
    setSuggestions([]);

    // 发送消息时暂时更新情绪状态
    // 用户输入期间保持中性状态
    setCurrentEmotion("neutral");

    // 生成 NPC 的响应（通过 ref 管理定时器 ID 以便可清理）
    npcResponseTimerRef.current = setTimeout(
      async () => {
        // 转换为安全的原始类型以避免循环引用
        const cleanMessageText = messageText ? String(messageText) : "";

        try {
          const apiService = ApiService.getInstance();
          // 添加会话 ID 和消息 ID
          const messageId = crypto.randomUUID();
          // 使用前端生成的会话 ID
          const currentSessionId = sessionId;

          // 创建纯对象后调用 API（通过 ref 获取最新的指标）
          const cleanMetrics = {
            angerLevel: Number(currentMetricsRef.current.angerLevel) || 1,
            trustLevel: Number(currentMetricsRef.current.trustLevel) || 1,
            progressLevel: Number(currentMetricsRef.current.progressLevel) || 1,
          };

          // 通过 messagesRef 确保获取最新的消息历史（Bug 修复）
          const currentMessages = messagesRef.current;

          // 深拷贝消息数组，转为纯数据结构（正确转换 sender 类型）
          const cleanMessages = currentMessages.map(msg => ({
            id: String(msg.id),
            sender: (msg.sender === "user" || msg.sender === "npc" ? msg.sender : "user") as "user" | "npc",
            content: String(msg.content),
            timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date()
          }));

          // 深拷贝 NPC 对象
          const cleanNpc = {
            name: String(scenario.npc.name),
            role: String(scenario.npc.role),
            company: String(scenario.npc.company),
            description: String(scenario.npc.description || ""),
            personality: Array.isArray(scenario.npc.personality) ?
              scenario.npc.personality.map(p => String(p)) : []
          };

          // 由于已从 /bedrock/conversation 端点移除指标输出，使用默认指标
          const result = await apiService.chatWithNPC(
            cleanMessageText, // 已转换为安全的字符串
            cleanNpc, // 已转换为安全的原始类型
            cleanMessages, // 已转换为安全的原始类型
            String(currentSessionId),
            String(messageId),
            // 添加情绪参数
            cleanMetrics,
            // 添加场景 ID
            String(scenario.id),
            // 添加语言设置
            scenario?.language || 'zh',
            // 发送已选幻灯片的 S3 key（AgentCore Runtime 直接从 S3 读取）
            presentedSlidePagesRef.current.length > 0
              ? slideImagesRef.current
                .filter(s => presentedSlidePagesRef.current.includes(s.pageNumber))
                .map(s => ({ pageNumber: s.pageNumber, imageKey: s.imageKey }))
              : undefined,
          );

          const { response } = result;

          // 使用前端生成的会话 ID
          const activeSessionId = sessionId;

          // 维持当前指标值（通过 ref 获取最新值）
          const newMetrics = { ...currentMetricsRef.current };

          const npcMessage: Message = {
            id: crypto.randomUUID(),
            sender: "npc",
            content: response,
            timestamp: new Date(),
            metrics: newMetrics,
          };

          // 开始讲话状态
          setIsSpeaking(true);

          // 从 messagesRef 获取最新状态（Bug 修复）
          const currentMessagesState = messagesRef.current;
          const finalMessages = [...currentMessagesState, npcMessage];

          // 同时更新两处以保持一致性
          messagesRef.current = finalMessages;
          setMessages(finalMessages);
          setCurrentMetrics(newMetrics);

          // 收到 API 响应时启用输入处理
          // 让用户可以在听语音的同时准备下一次输入
          setIsProcessing(false);

          // 使用 Amazon Polly 进行语音合成
          if (audioEnabled) {
            const audioService = AudioService.getInstance();
            audioService
              .synthesizeAndQueueAudio(response, messageId, scenarioVoiceId)
              .then(() => {
                // 语音合成成功后，添加音频播放完成监听器
                // 该监听器在音频播放完成时执行
                audioService.addPlaybackCompleteListener(messageId, () => {
                  setIsSpeaking(false);
                });
              })
              .catch((error) => {
                console.error("Amazon Polly语音合成错误:", error);
                // 发生错误时也更新讲话状态
                setIsSpeaking(false);
              });
          } else {
            // 音频无效时，在短暂延迟后更新讲话状态
            setTimeout(() => {
              setIsSpeaking(false);
            }, 500);
          }

          // NPC 响应后执行实时评估（仅在存在有效 sessionID 时）
          if (activeSessionId) {
            try {
              // 转换为安全字符串
              const cleanMessageText = messageText ? String(messageText) : "";

              // 将消息数组转换为纯数据结构（正确转换 sender 类型）
              const cleanMessages = finalMessages.map(msg => ({
                id: String(msg.id || ""),
                sender: (msg.sender === "user" || msg.sender === "npc" ? msg.sender : "user") as "user" | "npc",
                content: String(msg.content || ""),
                timestamp: msg.timestamp instanceof Date ? msg.timestamp :
                  (typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : new Date())
              }));

              // 将目标状态转换为纯数据结构（与 GoalStatus 类型对齐）
              const cleanGoalStatuses = Array.isArray(goalStatusesRef.current) ?
                goalStatusesRef.current.map(status => ({
                  goalId: String(status.goalId || ""),
                  achieved: Boolean(status.achieved),
                  progress: Number(status.progress || 0),
                  achievedAt: status.achievedAt
                })) : [];

              // 将目标转换为纯数据结构（与 Goal 类型对齐）
              const cleanGoals = Array.isArray(goalsRef.current) ?
                goalsRef.current.map(goal => ({
                  id: String(goal.id || ""),
                  description: String(goal.description || ""),
                  isRequired: Boolean(goal.isRequired),
                  priority: Number(goal.priority || 3),
                  criteria: Array.isArray(goal.criteria) ? goal.criteria.map(c => String(c)) : []
                })) : [];

              const evaluationResult = await apiService.getRealtimeEvaluation(
                cleanMessageText,
                cleanMessages,
                String(activeSessionId), // 转换为安全字符串
                cleanGoalStatuses,
                cleanGoals,
                String(scenario.id), // 转换为安全字符串
                String(scenario.language || "zh"), // 安全地转换为字符串
                // 传入当前分数（供智能体计算差值）（通过 ref 获取最新值）
                {
                  angerLevel: currentMetricsRef.current.angerLevel,
                  trustLevel: currentMetricsRef.current.trustLevel,
                  progressLevel: currentMetricsRef.current.progressLevel,
                },
                // 传入场景说明文（为提升建议质量）
                String(scenario.description || ""),
              );

              // 确认合规检查结果
              if (
                evaluationResult.compliance &&
                evaluationResult.compliance.violations &&
                evaluationResult.compliance.violations.length > 0
              ) {
                // 显示严重度最高的违规
                const sortedViolations = [
                  ...evaluationResult.compliance.violations,
                ].sort((a, b) => {
                  const severityOrder: Record<
                    "high" | "medium" | "low",
                    number
                  > = { high: 3, medium: 2, low: 1 };
                  return (
                    severityOrder[b.severity as "high" | "medium" | "low"] -
                    severityOrder[a.severity as "high" | "medium" | "low"]
                  );
                });

                // 将最严重的违规设置为通知
                setActiveViolation(sortedViolations[0]);
                setShowComplianceAlert(true);
              }

              if (evaluationResult) {
                // 保存上一次的指标（通过 ref 获取最新值）
                setPrevMetrics(currentMetricsRef.current);

                // 将 NPC 情绪状态反映到头像
                if (evaluationResult.npcEmotion) {
                  const validEmotions: EmotionState[] = ['happy', 'angry', 'neutral', 'annoyed', 'satisfied'];
                  const emotion = evaluationResult.npcEmotion as EmotionState;
                  if (validEmotions.includes(emotion)) {
                    setNpcDirectEmotion(emotion);
                  }
                } else {
                  // API 未返回 npcEmotion 时重置，回退到基于指标的计算
                  setNpcDirectEmotion(undefined);
                }

                // 将 NPC 手势反映到头像
                if (evaluationResult.gesture) {
                  const validGestures: GestureType[] = ['nod', 'headTilt', 'none'];
                  const gesture = evaluationResult.gesture as GestureType;
                  if (validGestures.includes(gesture)) {
                    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
                    setNpcGesture(gesture);
                    // 手势执行后重置
                    gestureTimerRef.current = setTimeout(() => setNpcGesture('none'), 1500);
                  }
                }

                // 更新建议回复候选项（场景中启用时显示）
                if (suggestionEnabledRef.current && Array.isArray(evaluationResult.suggestions)) {
                  setSuggestions(evaluationResult.suggestions);
                }

                // 设置新的指标
                setCurrentMetrics((prevMetrics) => ({
                  ...prevMetrics,
                  angerLevel:
                    evaluationResult.scores?.angerLevel ||
                    prevMetrics.angerLevel,
                  trustLevel:
                    evaluationResult.scores?.trustLevel ||
                    prevMetrics.trustLevel,
                  progressLevel:
                    evaluationResult.scores?.progressLevel ||
                    prevMetrics.progressLevel,
                  analysis: evaluationResult.analysis || prevMetrics.analysis,
                }));

                // 显示更新中的状态
                setMetricsUpdating(true);
                setTimeout(() => setMetricsUpdating(false), 1000);

                // 目标状态更新（与既有状态合并）
                if (evaluationResult.goalStatuses) {
                  setGoalStatuses((prevStatuses) => {
                    const merged = prevStatuses.map((prev) => {
                      const update = evaluationResult.goalStatuses!.find(
                        (u) => u.goalId === prev.goalId,
                      );
                      if (update) {
                        return mergeGoalStatus(prev, update);
                      }
                      return prev;
                    });
                    setGoalScore(calculateGoalScore(merged, goalsRef.current));
                    return merged;
                  });
                }
              }
            } catch (error) {
              console.error("实时评估API调用错误:", error);
            }
          }

          // 音频播放完成事件未触发时的回退
          // 防止音频无限播放（通过 ref 获取最新值）
          fallbackTimerRef.current = setTimeout(() => {
            if (isSpeakingRef.current) {
              setIsSpeaking(false);
            }
          }, 30000); // 较长的超时 - 通常音频播放应已完成

        } catch (error) {
          console.error("=== ConversationPage: API调用错误 ===");
          console.error("错误详情:", error);

          // 出错时结束会话
          setIsProcessing(false);
          console.error("由于API调用错误，结束会话");
        }
      },
      NPC_RESPONSE_BASE_DELAY + Math.random() * NPC_RESPONSE_RANDOM_DELAY,
    ); // NPC 响应延迟（可配置：通过 VITE_NPC_RESPONSE_DELAY 环境变量控制）
  }, [scenario, isProcessing, sessionId, audioEnabled, scenarioVoiceId]);

  /**
   * 会话结束处理
   *
   * 结束会话并跳转到结果页面
   *
   * @param finalMessages 最终的消息列表
   * @param finalMetrics 最终的指标
   */
  const endSession = useCallback(
    async (finalMessages: Message[], finalMetrics: Metrics) => {
      setSessionEnded(true);

      // 计算最终的目标分数
      const finalGoalScore = calculateGoalScore(goalStatuses, goals);
      setGoalScore(finalGoalScore);

      // 获取结束原因
      const endReason = getSessionEndReason(
        finalMetrics,
        finalMessages.length,
        goalStatuses,
        goals,
        scenario || undefined,
      );

      // 创建会话数据
      const session: Session = {
        id: sessionId,
        scenarioId: scenario!.id,
        startTime: new Date(Date.now() - finalMessages.length * 30000),
        endTime: new Date(),
        messages: finalMessages,
        finalMetrics,
        finalScore: 0,
        feedback: [],
        goalStatuses: goalStatuses,
        goalScore: goalScore,
        endReason: endReason,
      };

      // 将会话数据保存到 localStorage
      localStorage.setItem(`session_${session.id}`, JSON.stringify(session));

      // 改善等待录制完成处理
      const waitForRecordingUpload = () => {
        return new Promise<void>((resolve) => {
          let uploadCompleted = false;

          // 保存上一次的录制 key（为等待新会话的录制）
          const previousKey = localStorage.getItem("lastRecordingKey");

          // 90 秒超时（应对大文件）
          const timeoutId = setTimeout(() => {
            window.removeEventListener('recordingComplete', handleRecordingComplete as EventListener);
            resolve();
          }, 90000);

          const checkUploadComplete = (newVideoKey?: string) => {
            if (uploadCompleted) return;

            const videoKey = newVideoKey || localStorage.getItem("lastRecordingKey");

            // 确认是否已设置新 key
            // 1. 是包含会话 ID 的 key
            // 2. 与上一次的 key 不同（或不存在上一次的 key）
            if (videoKey && videoKey.includes(session.id)) {
              if (!previousKey || videoKey !== previousKey) {
                uploadCompleted = true;
                localStorage.setItem(`session_${session.id}_videoKey`, videoKey);
                clearTimeout(timeoutId);
                window.removeEventListener('recordingComplete', handleRecordingComplete as EventListener);
                resolve();
              } else {
                // 与上一次相同的 key，跳过
              }
            }
          };

          // 录制完成事件监听器
          const handleRecordingComplete = (event: CustomEvent) => {
            if (event.detail?.videoKey) {
              checkUploadComplete(event.detail.videoKey);
            } else {
              checkUploadComplete();
            }
          };

          window.addEventListener('recordingComplete', handleRecordingComplete as EventListener);

          // 定期检查 localStorage（作为事件未触发时的对策）
          const checkInterval = setInterval(() => {
            if (!uploadCompleted) {
              const currentKey = localStorage.getItem("lastRecordingKey");
              if (currentKey && currentKey.includes(session.id) && currentKey !== previousKey) {
                checkUploadComplete(currentKey);
                clearInterval(checkInterval);
              }
            } else {
              clearInterval(checkInterval);
            }
          }, 1000);

          // 超时时也清除定时器
          setTimeout(() => {
            clearInterval(checkInterval);
          }, 90000);
        });
      };

      // 等待录制上传完成后再跳转
      // 视频录制被禁用时跳过等待
      if (videoRecordingEnabled) {
        await waitForRecordingUpload();
      }

      // 异步开始会话分析（Step Functions）
      // 注意：录制禁用时也会启动会话分析，这是有意的设计。
      // 后端的视频分析步骤（sessionAnalysis/video_handler.py）会
      // 将 S3 中不存在视频的情况视为正常流程，以 videoSkipReason="no_video"
      // 跳过。因此即使录制关闭也不会产生错误或多余的 Nova 调用（计费），
      // 基于会话日志的反馈分析照常执行。
      try {
        const apiService = ApiService.getInstance();
        await apiService.startSessionAnalysis(
          session.id,
          i18n.language || "zh",
          goalStatuses
        );

        // 将分析开始信息保存到 localStorage
        localStorage.setItem(`session_${session.id}_analysisStarted`, "true");
      } catch {
        // 分析开始失败时也跳转到结果页面（回退到原有的同步分析）
      }

      setTimeout(() => {
        navigate(`/result/${session.id}`);
      }, 1000);
    },
    [
      goals,
      goalStatuses,
      navigate,
      scenario,
      goalScore,
      sessionId,
      i18n.language,
      videoRecordingEnabled,
    ],
  );

  // 手動終了
  const handleManualEnd = async () => {
    if (messages.length > 0) {
      await endSession(messages, currentMetrics);
    } else {
      navigate("/scenarios");
    }
  };

  // 幻灯片提示处理器
  const handleSlidePresent = useCallback((pageNumber: number) => {
    if (!presentedSlidePagesRef.current.includes(pageNumber)) {
      const updated = [...presentedSlidePagesRef.current, pageNumber];
      presentedSlidePagesRef.current = updated;
      setPresentedSlidePages(updated);
    }
  }, []);

  // 幻灯片取消提示处理器
  const handleSlideUnpresent = useCallback((pageNumber: number) => {
    const updated = presentedSlidePagesRef.current.filter(p => p !== pageNumber);
    presentedSlidePagesRef.current = updated;
    setPresentedSlidePages(updated);
  }, []);

  // 幻灯片全选取消处理器
  const handleSlideClearAll = useCallback(() => {
    presentedSlidePagesRef.current = [];
    setPresentedSlidePages([]);
  }, []);

  // Enter 键处理
  const handleKeyDown = (event: CompositionEventType) => {
    // IME 输入中不进行任何处理
    if (event.nativeEvent.isComposing || event.key === "Process") {
      return;
    }

    // Enter 键发送（Shift + Enter 换行）
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // 开始语音输入
  const startSpeechRecognition = useCallback(async () => {
    // 已在监听中则停止（开关动作）
    if (isListening && transcribeServiceRef.current) {
      transcribeServiceRef.current.stopListening();
      setIsListening(false);
      setContinuousListening(false);

      // 当前有正在输入的文本则发送
      if (userInputRef.current.trim()) {
        sendMessage(userInputRef.current.trim());
        // 状态已在 sendMessage 内被清除，因此这里无需处理
      } else {
        // 无文本时仅清除语音识别状态
        setConfirmedTranscripts([]);
      }
      return;
    }

    try {
      if (!transcribeServiceRef.current) {
        throw new Error("TranscribeService 未初始化");
      }

      // WebSocket 未连接时尝试重新连接
      if (!transcribeServiceRef.current.isConnected() && sessionId) {
        try {
          await transcribeServiceRef.current.initializeConnection(sessionId, scenario?.language || 'zh');
        } catch (error) {
          console.error("Transcribe WebSocket连接错误:", error);
          setSpeechRecognitionError("network");
          return;
        }
      }

      // 使用 Amazon Transcribe 开始常时麦克风输入
      await transcribeServiceRef.current.startListening(
        // 文字转写回调（isPartial: true=途中识别、false=最终确定）
        (text, isPartial) => {
          if (!isPartial) {
            // 最终确定时的处理（若在无音检测后到来则已发送，因此会被跳过）
            const trimmedText = text.trim();
            if (!trimmedText) return;

            const cleanedText = normalizeTranscriptText(trimmedText);
            if (!cleanedText) return;

            setConfirmedTranscripts((prev) => {
              if (prev.includes(cleanedText)) return prev;

              const newConfirmed = [...prev, cleanedText];
              const combinedText = newConfirmed.join("\n");

              setUserInput(combinedText);
              userInputRef.current = combinedText;

              return newConfirmed;
            });
          } else {
            // 途中识别时的处理 - Transcribe 会累积地返回文本
            const currentPartial = text.trim();
            if (!currentPartial) return;

            // 组合已确定文本与途中识别结果显示
            // 使用 state updater 函数避免闭包问题
            setConfirmedTranscripts((prevConfirmed) => {
              const combinedText = prevConfirmed.length > 0
                ? prevConfirmed.join("\n") + "\n" + currentPartial
                : currentPartial;

              setUserInput(combinedText);
              userInputRef.current = combinedText;
              return prevConfirmed; // 途中识别时不变更确定列表
            });
          }
        },
        // 无音检测回调（自动停止麦克风并确定文本。发送由用户手动进行）
        () => {
          // 停止麦克风（防止 Transcribe 会话超时）
          if (transcribeServiceRef.current && transcribeServiceRef.current.isListening()) {
            transcribeServiceRef.current.stopListening();
          }
          setIsListening(false);
          setContinuousListening(false);
        },
        // 错误回调
        (error) => {
          console.error("语音识别错误:", error);
          setIsListening(false);
          setContinuousListening(false);
          setSpeechRecognitionError("network");
        }
      );

      setIsListening(true);
      setContinuousListening(true);
      setSpeechRecognitionError(null);
    } catch (error) {
      console.error("语音识别开始失败:", error);
      setSpeechRecognitionError("not-supported");
      setIsListening(false);
    }
  }, [isListening, sessionId, sendMessage, normalizeTranscriptText, scenario?.language]);

  // 停止语音识别并切换到文本输入模式
  const switchToTextInput = useCallback(() => {
    setSpeechRecognitionError(null);
    setIsListening(false);
    setContinuousListening(false);

    // 停止 Transcribe 服务
    if (transcribeServiceRef.current && transcribeServiceRef.current.isListening()) {
      transcribeServiceRef.current.stopListening();
    }

    // 清除部分识别（保持已确定文本）

    // 将用户输入仅更新为已确定文本（统一使用 state updater 模式）
    setConfirmedTranscripts((prevConfirmed) => {
      if (prevConfirmed.length > 0) {
        const confirmedText = prevConfirmed.join("\n");
        setUserInput(confirmedText);
        userInputRef.current = confirmedText;
      }
      return prevConfirmed;
    });
  }, []);

  // 情绪状态变化的处理器
  const handleEmotionChange = useCallback((emotion: EmotionState) => {
    setCurrentEmotion(emotion);
  }, []);

  // 相机初始化状态的处理器
  const handleCameraInitialized = useCallback((initialized: boolean) => {
    setIsCameraInitialized(initialized);
    // 相机初始化失败时设置错误状态
    if (!initialized) {
      setCameraError(true);
    }
  }, []);

  // 目标达成时的通知显示
  useEffect(() => {
    // 与上一次的目标状态比较，检测新达成的目标
    const newlyAchievedGoals = goalStatuses.filter((status) => {
      if (!status.achieved) return false;
      const goal = goals.find((g) => g.id === status.goalId);
      return (
        goal &&
        status.achievedAt &&
        new Date(status.achievedAt).getTime() > Date.now() - 5000
      ); // 5 秒内达成的目标
    });

    // 存在新达成的目标时显示通知
    if (newlyAchievedGoals.length > 0) {
      const achievedGoal = newlyAchievedGoals[0];
      const goal = goals.find((g) => g.id === achievedGoal.goalId);

      if (goal) {
        // 所有必需目标均已达成时，结束会话
        if (areAllRequiredGoalsAchieved(goalStatuses, goals)) {
          setTimeout(async () => {
            if (!sessionEnded && messagesRef.current.length > 0) {
              await endSession(messagesRef.current, currentMetrics);
            }
          }, 2000);
        }
      }
    }
  }, [goalStatuses, goals, currentMetrics, sessionEnded, endSession]);

  if (!scenario) {
    return null;
  }

  // 录制完成时的处理器

  // 使用当前情绪状态生成影响渲染的类名
  const emotionClassName = `emotion-${currentEmotion}`;

  return (
    <Box
      className={`conversation-container ${emotionClassName}`}
      sx={{
        height: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 页头 */}
      <ConversationHeader
        scenario={scenario}
        sessionStarted={sessionStarted}
        sessionEnded={sessionEnded}
        onManualEnd={handleManualEnd}
        messageCount={messages.length}
        onToggleRightPanels={() => setRightPanelsVisible((v) => !v)}
        onToggleMetrics={() => setMetricsVisible((v) => !v)}
        onOpenSettings={() => setShowSettings(true)}
        rightPanelsVisible={rightPanelsVisible}
        metricsVisible={metricsVisible}
      />

      {/* 合规违规通知 - 页头下方滑入 */}
      {showComplianceAlert && activeViolation && (
        <ComplianceAlert
          violation={activeViolation}
          open={showComplianceAlert}
          onClose={() => setShowComplianceAlert(false)}
        />
      )}

      {/* 主区域 */}
      <Box
        sx={{
          flex: 1,
          position: "relative",
          display: "flex",
          // 会话开始后为 3 栏横排，开始前为原有的纵向堆叠
          flexDirection: sessionStarted ? "row" : "column",
          minHeight: 0,
          overflow: "hidden",
          // 预留左右边距以防内容被截断
          px: sessionStarted ? 1 : 0,
        }}
      >
        {/* ===== 左栏：头像 + 指标 + 幻灯片 ===== */}
        {sessionStarted && avatarVisible && (
          <Box
            sx={{
              width: "22%",
              minWidth: 260,
              maxWidth: 360,
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* 头像舞台（使用整个栏） */}
            <AvatarProvider>
              <Box sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}>
                <AvatarStage
                  avatarId={scenarioAvatarId}
                  avatarS3Key={scenarioAvatarS3Key}
                  angerLevel={currentMetrics.angerLevel}
                  trustLevel={currentMetrics.trustLevel}
                  progressLevel={currentMetrics.progressLevel}
                  isSpeaking={isSpeaking}
                  directEmotion={npcDirectEmotion}
                  gesture={npcGesture}
                  onEmotionChange={handleEmotionChange}
                  npcName={scenario.npc.name}
                />
              </Box>
            </AvatarProvider>

            {/* 占位符（将提案资料压至底部） */}
            <Box sx={{ flex: 1 }} />

            {/* 幻灯片托盘（提案资料，叠加在头像之上） */}
            {slideImages.length > 0 && (
              <Box sx={{
                position: "relative",
                zIndex: 10,
                maxHeight: 100,
                overflow: "auto",
                background: "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(4px)",
              }}>
                <SlideTray
                  slides={slideImages}
                  currentIndex={currentSlideIndex}
                  presentedPages={presentedSlidePages}
                  onSlideSelect={setCurrentSlideIndex}
                  onPresent={handleSlidePresent}
                  onUnpresent={handleSlideUnpresent}
                  onClearAll={handleSlideClearAll}
                  onZoom={() => setIsSlideZoomOpen(true)}
                />
              </Box>
            )}

            {/* 相机预览（左栏下部） */}
            {videoRecordingEnabled && (
              <Box
                data-testid="video-manager-container"
                sx={{
                  borderTop: "1px solid",
                  borderColor: "divider",
                  p: 1,
                }}
              >
                <VideoManager
                  ref={undefined}
                  sessionId={sessionId}
                  sessionStarted={sessionStarted}
                  sessionEnded={sessionEnded}
                  onCameraInitialized={handleCameraInitialized}
                />
              </Box>
            )}
          </Box>
        )}

        {/* ===== 中央栏：聊天记录 + 输入 ===== */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            // 会话开始前以 absolute 定位显示指标
            position: "relative",
          }}
        >
          {/* 无头像时：指标仅显示在右栏（与有头像版本统一） */}

          {/* 会话开始前的相机预览 */}
          {videoRecordingEnabled && !sessionStarted && (
            <Box
              data-testid="video-manager-container"
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 10,
                width: 180,
                borderRadius: 2,
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
            >
              <VideoManager
                ref={undefined}
                sessionId={sessionId}
                sessionStarted={sessionStarted}
                sessionEnded={sessionEnded}
                onCameraInitialized={handleCameraInitialized}
              />
            </Box>
          )}

          {/* 聊天记录 */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              ...((!sessionStarted) && {
                cursor: "default",
                backgroundColor: "#fafafa",
              }),
            }}
            role="region"
            aria-label={
              chatLogExpanded
                ? t("conversation.chatLog.collapse")
                : t("conversation.chatLog.expand")
            }
          >
            <MessageList
              messages={messages}
              isProcessing={isProcessing}
              sessionStarted={sessionStarted}
              sessionEnded={sessionEnded}
              currentMetrics={currentMetrics}
              scenario={scenario}
              onStartConversation={startConversation}
              isCameraInitialized={isCameraInitialized}
              cameraError={cameraError}
              videoRecordingEnabled={videoRecordingEnabled}
              slideImages={slideImages}
              onSlideClick={(idx) => { setCurrentSlideIndex(idx); setIsSlideZoomOpen(true); }}
            />
          </Box>

          {/* 教练提示栏 */}
          <Box sx={{ flexShrink: 0 }}>
            <CoachingHintBar hint={currentMetrics.analysis} />
          </Box>

          {/* 建议回复按钮（显示在教练提示与输入框之间） */}
          {sessionStarted && !sessionEnded && suggestionEnabled && (
            <Box sx={{ flexShrink: 0 }}>
              <SuggestionBar
                suggestions={suggestions}
                onSelect={(text) => sendMessage(text)}
                disabled={isProcessing}
              />
            </Box>
          )}

          {/* 消息输入区域 */}
          <Box sx={{ flexShrink: 0 }}>
            <MessageInput
              userInput={userInput}
              setUserInput={setUserInput}
              sendMessage={sendMessage}
              isProcessing={isProcessing}
              isListening={isListening}
              isConnecting={connectionState === ConnectionState.CONNECTING}
              speechRecognitionError={speechRecognitionError}
              startSpeechRecognition={startSpeechRecognition}
              switchToTextInput={switchToTextInput}
              handleKeyDown={handleKeyDown}
              sessionStarted={sessionStarted}
              sessionEnded={sessionEnded}
              continuousListening={continuousListening}
            />
          </Box>
        </Box>

        {/* ===== 右栏：指标 + 目标 + 场景信息 ===== */}
        {sessionStarted && rightPanelsVisible && (
          <Box
            sx={{
              width: "25%",
              minWidth: 240,
              maxWidth: 320,
              borderLeft: "1px solid",
              borderColor: "divider",
              overflow: "auto",
            }}
          >
            {/* 指标面板（右栏上部） */}
            {metricsVisible && (
              <Box sx={{
                borderBottom: "1px solid",
                borderColor: "divider",
                "& > [role='region']": {
                  position: "static",
                  borderRadius: 0,
                  boxShadow: "none",
                  background: "transparent",
                  m: 0,
                  maxWidth: "none",
                },
              }}>
                <MetricsOverlay
                  currentMetrics={currentMetrics}
                  prevMetrics={prevMetrics}
                  metricsUpdating={metricsUpdating}
                  visible={metricsVisible}
                />
              </Box>
            )}
            <RightPanelContainer
              visible={true}
              goals={goals}
              goalStatuses={goalStatuses}
              scenario={scenario}
            />
          </Box>
        )}

      </Box>

      {/* 幻灯片放大模态框 */}
      {slideImages.length > 0 && (
        <SlideZoomModal
          open={isSlideZoomOpen}
          slides={slideImages}
          currentIndex={currentSlideIndex}
          presentedPages={presentedSlidePages}
          onSlideChange={setCurrentSlideIndex}
          onPresent={handleSlidePresent}
          onUnpresent={handleSlideUnpresent}
          onClose={() => setIsSlideZoomOpen(false)}
        />
      )}

      {/* 设置模态框（音频设置 + 头像显示切换） */}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        aria-labelledby="settings-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="settings-dialog-title">
          {t("conversation.settings.title")}
        </DialogTitle>
        <DialogContent>
          <SessionSettingsPanel
            audioEnabled={audioEnabled}
            setAudioEnabled={setAudioEnabled}
            audioVolume={audioVolume}
            setAudioVolume={setAudioVolume}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            avatarVisible={avatarVisible}
            setAvatarVisible={setAvatarVisible}
            avatarEnabled={enableAvatar}
            videoRecordingEnabled={videoRecordingEnabled}
            setVideoRecordingEnabled={setVideoRecordingEnabled}
            recordingSettingLocked={sessionStarted}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ConversationPage;
