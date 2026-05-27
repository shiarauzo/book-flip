import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function render() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Pages are drawn to <canvas>, which needs the book serif fully loaded before it
// paints — otherwise text renders in the fallback face. Wait for it (max ~1.5s).
const faces = [
  "400 1em 'EB Garamond'",
  "500 1em 'EB Garamond'",
  "700 1em 'EB Garamond'",
  "italic 400 1em 'EB Garamond'",
];

if ("fonts" in document) {
  const loaded = Promise.allSettled(faces.map((f) => document.fonts.load(f)));
  const timeout = new Promise((r) => setTimeout(r, 1500));
  Promise.race([loaded, timeout]).finally(render);
} else {
  render();
}
