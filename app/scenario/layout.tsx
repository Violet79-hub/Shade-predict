"use client";

import { useEffect } from "react";
import 'maplibre-gl/dist/maplibre-gl.css';
import './workspace.css';

export default function ScenarioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const relabelBaselineCards = () => {
      document
        .querySelectorAll<HTMLElement>(".comparison-label")
        .forEach((label) => {
          const text = label.textContent ?? "";
          if (text.startsWith("Baseline ·")) {
            label.textContent = text.replace("Baseline ·", "No intervention ·");
          }
        });
    };

    relabelBaselineCards();

    const observer = new MutationObserver(relabelBaselineCards);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
