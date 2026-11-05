import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DevLoginGate from "../../components/DevLoginGate";
import { devLogin } from "../../services/LocalAuth";

jest.mock("../../services/LocalAuth", () => ({ devLogin: jest.fn() }));
const login = devLogin as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  login.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

test("waits for login and reuses one request in StrictMode", async () => {
  let resolve!: () => void;
  login.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const success = jest.fn();
  render(
    <StrictMode>
      <DevLoginGate onSuccess={success} />
    </StrictMode>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("正在连接");
  expect(login).toHaveBeenCalledTimes(1);
  expect(success).not.toHaveBeenCalled();
  await act(async () => {
    resolve();
  });
  expect(success).toHaveBeenCalledTimes(1);
});

test("retries a temporarily unavailable backend before entering the app", async () => {
  login
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce({});
  const success = jest.fn();
  render(<DevLoginGate onSuccess={success} />);
  await act(async () => {});
  expect(screen.getByRole("status")).toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(login).toHaveBeenCalledTimes(2);
  expect(success).toHaveBeenCalledTimes(1);
});

test("limits automatic retries and lets the user reconnect after persistent failure", async () => {
  login.mockRejectedValue(new TypeError("Failed to fetch"));
  const success = jest.fn();
  render(<DevLoginGate onSuccess={success} />);
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(login).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("alert")).toHaveTextContent("暂时连接不上服务");
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  login.mockResolvedValueOnce({});
  fireEvent.click(screen.getByRole("button", { name: "重新连接" }));
  await act(async () => {});
  expect(login).toHaveBeenCalledTimes(4);
  expect(success).toHaveBeenCalledTimes(1);
});
