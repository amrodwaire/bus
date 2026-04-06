import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Aggressive pull-to-refresh prevention for Android WebView / APK
let startY = 0;
let startX = 0;

document.addEventListener("touchstart", (e) => {
    startY = e.touches[0].pageY;
    startX = e.touches[0].pageX;
}, { passive: true });

document.addEventListener("touchmove", (e) => {
    const dy = e.touches[0].pageY - startY;
    const dx = e.touches[0].pageX - startX;

    if (Math.abs(dy) <= Math.abs(dx)) return;

    let el = e.target as HTMLElement | null;
    while (el && el !== document.documentElement) {
        if (el.scrollHeight > el.clientHeight) {
            const style = window.getComputedStyle(el);
            const overflow = style.overflowY;
            if (overflow === "auto" || overflow === "scroll") {
                if (dy > 0 && el.scrollTop <= 0) {
                    e.preventDefault();
                    return;
                }
                if (dy < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight) {
                    e.preventDefault();
                    return;
                }
                return;
            }
        }
        el = el.parentElement;
    }

    if (dy > 0) {
        e.preventDefault();
    }
}, { passive: false });

createRoot(document.getElementById("root")!).render(<App />);
