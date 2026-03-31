import React from "react";
import type { SupabaseSession } from "../shared/ipc-types";

interface Props {
  session: SupabaseSession;
  onSignOut: () => void;
}

export function SettingsScreen(_props: Props) {
  return null;
}
