import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ReviewSessionProvider } from "./review/ReviewSessionContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ReviewSessionProvider>
        <App />
      </ReviewSessionProvider>
    </HashRouter>
  </StrictMode>,
);
