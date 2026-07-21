import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import LacalleFinance from "./LacalleFinance.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LacalleFinance />
  </StrictMode>
);
