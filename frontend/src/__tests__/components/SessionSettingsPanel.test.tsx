import { render, screen, fireEvent } from "@testing-library/react";
import SessionSettingsPanel from "../../components/conversation/SessionSettingsPanel";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => ({
      "conversation.audioSettings.outputOn": "音频输出 ON",
      "conversation.audioSettings.outputOff": "音频输出 OFF",
      "conversation.audioSettings.volume": `音量: ${options?.volume ?? ""}%`,
      "conversation.audioSettings.speechRate": `朗读速度: ${options?.rate ?? ""}x`,
      "conversation.audioSettings.npcResponseNote": "NPC 的回复将通过语音播放",
      "conversation.settings.avatarOn": "形象显示 ON",
      "conversation.settings.avatarOff": "形象显示 OFF",
    })[key] || key,
  }),
}));

const props = { audioEnabled: true, setAudioEnabled: jest.fn(), audioVolume: 80, setAudioVolume: jest.fn(), speechRate: 1, setSpeechRate: jest.fn() };
beforeEach(() => jest.clearAllMocks());

test("legacy recording props never restore camera controls", () => {
  const recording = jest.fn();
  render(<SessionSettingsPanel {...props} videoRecordingEnabled setVideoRecordingEnabled={recording} recordingSettingLocked />);
  expect(screen.queryByRole("switch", { name: /视频录制|Video Recording/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/摄像头|视频分析|录制设置/)).not.toBeInTheDocument();
  expect(recording).not.toHaveBeenCalled();
});

test.each([true, false])("audio output toggles independently when enabled=%s", (enabled) => {
  render(<SessionSettingsPanel {...props} audioEnabled={enabled} />);
  const toggle = screen.getByRole("switch", { name: enabled ? "音频输出 ON" : "音频输出 OFF" });
  expect(toggle).toHaveProperty("checked", enabled);
  expect(screen.queryAllByRole("slider")).toHaveLength(enabled ? 2 : 0);
  fireEvent.click(toggle);
  expect(props.setAudioEnabled).toHaveBeenCalledWith(!enabled);
});

test("volume and speech rate remain adjustable through labeled controls", () => {
  render(<SessionSettingsPanel {...props} />);
  fireEvent.change(screen.getByRole("slider", { name: "音量: 80%" }), { target: { value: "60" } });
  fireEvent.change(screen.getByRole("slider", { name: "朗读速度: 1.0x" }), { target: { value: "1.5" } });
  expect(props.setAudioVolume).toHaveBeenCalledWith(60);
  expect(props.setSpeechRate).toHaveBeenCalledWith(1.5);
});

test.each([false, undefined])("avatar control stays hidden when the scene does not enable it: %s", (enabled) => {
  render(<SessionSettingsPanel {...props} avatarEnabled={enabled} setAvatarVisible={jest.fn()} />);
  expect(screen.queryByRole("switch", { name: /形象显示/ })).not.toBeInTheDocument();
});

test("an enabled scene allows toggling its avatar", () => {
  const visible = jest.fn();
  render(<SessionSettingsPanel {...props} avatarEnabled avatarVisible setAvatarVisible={visible} />);
  fireEvent.click(screen.getByRole("switch", { name: "形象显示 ON" }));
  expect(visible).toHaveBeenCalledWith(false);
});
