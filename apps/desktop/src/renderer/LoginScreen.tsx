import React from "react";
import type { SupabaseSession } from "../shared/ipc-types";

interface Props {
  onAuthenticated: (session: SupabaseSession) => void;
}

export function LoginScreen(_props: Props) {
  return null;
}
