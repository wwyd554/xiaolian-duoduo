import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import AppAccessGate from "../../components/AppAccessGate";

jest.mock("../../components/AppContent", () => () => <div>静态产品示例<Link to="/conversation/demo-store-value-v1">开始真实练习</Link></div>);
jest.mock("../../components/DevLoginGate", () => () => <div>真实功能需要登录</div>);
jest.mock("../../components/InviteLogin", () => () => <div>邀请码登录</div>);
jest.mock("../../services/LocalAuth", () => ({ DEV_BYPASS_ENABLED: true }));

test("an unauthenticated visitor can read the example but real practice still requires login", () => {
  render(<MemoryRouter initialEntries={["/demo?step=review"]}><AppAccessGate authed={false} onLoginSuccess={jest.fn()} /></MemoryRouter>);
  expect(screen.getByText("静态产品示例")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "开始真实练习" }));
  expect(screen.getByText("真实功能需要登录")).toBeInTheDocument();
});

test.each(["/", "/history", "/result/real-session"])("the public demo exemption does not expose protected route %s", (path) => {
  render(<MemoryRouter initialEntries={[path]}><AppAccessGate authed={false} onLoginSuccess={jest.fn()} /></MemoryRouter>);
  expect(screen.getByText("真实功能需要登录")).toBeInTheDocument();
  expect(screen.queryByText("静态产品示例")).not.toBeInTheDocument();
});
