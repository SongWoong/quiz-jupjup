import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TDSMobileProvider } from "@toss/tds-mobile";
import App from "./App.tsx";
import "./index.css";

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/i.test(ua);
const isAndroid = /Android/i.test(ua);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TDSMobileProvider
      userAgent={{
        fontA11y: undefined,
        fontScale: undefined,
        isAndroid,
        isIOS,
      }}
    >
      <App />
    </TDSMobileProvider>
  </StrictMode>
);
