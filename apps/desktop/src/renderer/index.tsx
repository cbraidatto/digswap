import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./AppShell";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");
const root = createRoot(container);
root.render(<AppShell />);
