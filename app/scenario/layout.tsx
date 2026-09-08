"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ScenarioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const resultsHeader = document.querySelector<HTMLElement>(".results-header");
    if (!resultsHeader) return;

    let comparisonHost = document.getElementById(
      "no-intervention-comparison-guide",
    );

    if (!comparisonHost) {
      comparisonHost = document.createElement("div");
      comparisonHost.id = "no-intervention-comparison-guide";
      resultsHeader.insertAdjacentElement("afterend", comparisonHost);
    }

    setHost(comparisonHost);

    return () => {
      comparisonHost?.remove();
    };
  }, []);

  return (
    <>
      {children}
      {host &&
        createPortal(
          <section
            aria-label="Scenario comparison explanation"
            style={{
              margin: "0 24px 18px",
              padding: "16px 18px",
              border: "1px solid #d8e7df",
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(244,250,247,0.98), rgba(255,255,255,0.98))",
              boxShadow: "0 8px 24px rgba(28, 76, 57, 0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: ".11em",
                    color: "#167453",
                    marginBottom: 4,
                  }}
                >
                  WHAT HAPPENS IF WE DO NOTHING?
                </div>
                <strong style={{ fontSize: 16, color: "#173f33" }}>
                  Every scenario includes a no-intervention future.
                </strong>
              </div>
              <span style={{ fontSize: 12, color: "#61756e" }}>
                No intervention = same area + same target year + 0 new trees
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: "11px 12px",
                  borderRadius: 12,
                  background: "#ffffff",
                  border: "1px solid #e2ebe7",
                }}
              >
                <small style={{ color: "#71837d", fontWeight: 700 }}>
                  01 · TODAY
                </small>
                <div style={{ marginTop: 4, fontWeight: 700, color: "#27473d" }}>
                  Current canopy & heat
                </div>
              </div>

              <div
                style={{
                  padding: "11px 12px",
                  borderRadius: 12,
                  background: "#f6f7f6",
                  border: "1px dashed #9caea7",
                }}
              >
                <small style={{ color: "#667872", fontWeight: 800 }}>
                  02 · NO INTERVENTION
                </small>
                <div style={{ marginTop: 4, fontWeight: 700, color: "#314a42" }}>
                  Future if no new trees are added
                </div>
              </div>

              <div
                style={{
                  padding: "11px 12px",
                  borderRadius: 12,
                  background: "#edf8f2",
                  border: "1px solid #b9dfcb",
                }}
              >
                <small style={{ color: "#167453", fontWeight: 800 }}>
                  03 · WITH YOUR PLAN
                </small>
                <div style={{ marginTop: 4, fontWeight: 700, color: "#18553f" }}>
                  Future after the selected planting intervention
                </div>
              </div>
            </div>

            <p
              style={{
                margin: "11px 0 0",
                fontSize: 12,
                lineHeight: 1.5,
                color: "#61756e",
              }}
            >
              The result cards, canopy trajectory, heat model and streetscape
              visualisation below compare the planting outcome directly against
              this no-intervention baseline, so the displayed benefit is the
              additional impact created by the plan rather than natural change.
            </p>
          </section>,
          host,
        )}
    </>
  );
}
