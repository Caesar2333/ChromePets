import React from "react";
import { createRoot } from "react-dom/client";
import { ControlPanel } from "./ControlPanel";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ControlPanel />
  </React.StrictMode>
);
