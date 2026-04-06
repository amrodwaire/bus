import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent pull-to-refresh in Android WebView / PWA
const rootEl = document.getElementById("root")!;
let lastTouchY = 0;
rootEl.addEventListener("touchstart", (e) => {
    lastTouchY = e.touches[0].clientY;
}, { passive: true });
rootEl.addEventListener("touchmove", (e) => {
    const touchY = e.touches[0].clientY;
    if (rootEl.scrollTop === 0 && touchY > lastTouchY) {
        e.preventDefault();
    }
}, { passive: false });

createRoot(document.getElementById("root")!).render(<App />);
