import { AppShell } from "./AppShell";

/**
 * Root renderer component.
 * AppShell owns the session guard (loading → LoginScreen | Inbox+Settings tabs).
 * All Electron/Node access goes through window.desktopBridge (preload bridge).
 */
export function App() {
  return <AppShell />;
}
