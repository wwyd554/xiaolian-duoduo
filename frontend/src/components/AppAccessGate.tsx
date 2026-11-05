import { useLocation } from "react-router-dom";
import AppContent from "./AppContent";
import DevLoginGate from "./DevLoginGate";
import InviteLogin from "./InviteLogin";
import { DEV_BYPASS_ENABLED } from "../services/LocalAuth";

/** The packaged example is public; real practice and saved data keep the existing login gate. */
export default function AppAccessGate({ authed, onLoginSuccess }: { authed: boolean; onLoginSuccess: () => void }) {
  const { pathname } = useLocation();
  if (authed || pathname === "/demo") return <AppContent />;
  return DEV_BYPASS_ENABLED ? <DevLoginGate onSuccess={onLoginSuccess} /> : <InviteLogin onSuccess={onLoginSuccess} />;
}
