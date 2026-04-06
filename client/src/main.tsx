import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent pull-to-refresh in Android WebView / PWA
let lastTouchY = 0;
document.addEventListener("touchstart", (e) => {
    lastTouchY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener("touchmove", (e) => {
    const touchY = e.touches[0].clientY;
    const scrollTop = (document.scrollingElement || document.documentElement).scrollTop;
    if (scrollTop === 0 && touchY > lastTouchY) {
        e.preventDefault();
    }
}, { passive: false });

createRoot(document.getElementById("root")!).render(<App />);
