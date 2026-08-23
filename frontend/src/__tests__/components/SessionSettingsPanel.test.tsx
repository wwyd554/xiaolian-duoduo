import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionSettingsPanel from "../../components/conversation/SessionSettingsPanel";

// i18n mock（将 key 转换为对应中文返回）
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: { [key: string]: string } = {
        "conversation.settings.recordingOn": "视频录制 ON",
        "conversation.settings.recordingOff": "视频录制 OFF",
        "conversation.settings.recordingNote":
          "※ 关闭录制后，将不使用摄像头，视频分析功能不可用",
        "conversation.settings.recordingLockedNote":
          "※ 录制设置仅在商谈开始前可修改",
        "conversation.audioSettings.outputOn": "音频输出 ON",
        "conversation.audioSettings.outputOff": "音频输出 OFF",
        "conversation.audioSettings.volume": `音量: ${options?.volume ?? ""}%`,
        "conversation.audioSettings.speechRate": `朗读速度: ${options?.rate ?? ""}x`,
        "conversation.audioSettings.npcResponseNote":
          "※ NPC 的回复将通过语音播放",
      };
      return translations[key] || key;
    },
  }),
}));

/**
 * 获取录制切换开关（通过无障碍名称定位）
 * MUI 的 Switch 以 role="switch" 渲染，并从标签文本计算
 * 无障碍名称。兼容中英文的 ON/OFF 标签。
 */
const getRecordingToggle = () =>
  screen.getByRole("switch", {
    name: /视频录制 (ON|OFF)|Video Recording (ON|OFF)/,
  });

const queryRecordingToggle = () =>
  screen.queryByRole("switch", {
    name: /视频录制 (ON|OFF)|Video Recording (ON|OFF)/,
  });

describe("SessionSettingsPanel - 视频录制切换", () => {
  const defaultProps = {
    audioEnabled: true,
    setAudioEnabled: jest.fn(),
    audioVolume: 80,
    setAudioVolume: jest.fn(),
    speechRate: 1.0,
    setSpeechRate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("传入 setVideoRecordingEnabled 时，显示录制切换", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={jest.fn()}
      />,
    );

    expect(getRecordingToggle()).toBeInTheDocument();
  });

  test("未传入 setVideoRecordingEnabled 时，不显示录制切换", () => {
    render(<SessionSettingsPanel {...defaultProps} />);

    expect(queryRecordingToggle()).not.toBeInTheDocument();
  });

  test("录制开启时切换为已选中", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={jest.fn()}
      />,
    );

    expect(getRecordingToggle()).toBeChecked();
  });

  test("录制关闭时切换为未选中", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={false}
        setVideoRecordingEnabled={jest.fn()}
      />,
    );

    expect(getRecordingToggle()).not.toBeChecked();
  });

  test("切换操作调用 setVideoRecordingEnabled", () => {
    const setVideoRecordingEnabled = jest.fn();
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={setVideoRecordingEnabled}
      />,
    );

    fireEvent.click(getRecordingToggle());
    expect(setVideoRecordingEnabled).toHaveBeenCalledWith(false);
  });

  test("recordingSettingLocked=true 时，切换被禁用", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={jest.fn()}
        recordingSettingLocked={true}
      />,
    );

    expect(getRecordingToggle()).toBeDisabled();
  });

  test("recordingSettingLocked=false 时，切换可用", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={jest.fn()}
        recordingSettingLocked={false}
      />,
    );

    expect(getRecordingToggle()).toBeEnabled();
  });

  test("锁定时显示锁定说明", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={jest.fn()}
        recordingSettingLocked={true}
      />,
    );

    expect(
      screen.getByText("※ 录制设置仅在商谈开始前可修改"),
    ).toBeInTheDocument();
  });

  test("未锁定时显示常规说明", () => {
    render(
      <SessionSettingsPanel
        {...defaultProps}
        videoRecordingEnabled={true}
        setVideoRecordingEnabled={jest.fn()}
        recordingSettingLocked={false}
      />,
    );

    expect(
      screen.getByText(
        "※ 关闭录制后，将不使用摄像头，视频分析功能不可用",
      ),
    ).toBeInTheDocument();
  });
});
