import { useEffect, useState } from "react";
import "./WorkspaceBackground.css";

/** Decorative, compositor-driven light fields behind the practice workspace. */
export default function WorkspaceBackground() {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <div
      className="workspace-background"
      aria-hidden="true"
      data-paused={hidden}
    >
      <div className="workspace-background__field workspace-background__field--blue" />
      <div className="workspace-background__field workspace-background__field--violet" />
      <div className="workspace-background__veil" />
    </div>
  );
}
