import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from "react";
import type { UsedPanel } from "@/lib/maxrects";

const COLORS = [
  "#00ff41", "#00bcd4", "#ff9800", "#e91e63", "#9c27b0", "#ffeb3b",
  "#4caf50", "#2196f3", "#ff5722", "#795548", "#607d8b", "#cddc39",
];

export interface PanelResultHandle {
  save: () => void;
}

interface PanelResultProps {
  panel: UsedPanel;
  index: number;
  pricePerSqm: number;
}

const PanelResult = forwardRef<PanelResultHandle, PanelResultProps>(
  ({ panel, index, pricePerSqm }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const maxDisplayWidth = 800;
    const scale = Math.min(
      maxDisplayWidth / panel.stockPanel.width,
      400 / panel.stockPanel.height,
      1
    );
    const svgW = panel.stockPanel.width * scale;
    const svgH = panel.stockPanel.height * scale;

    const usedM2 = panel.usedAreaMm2 / 1_000_000;
    const wasteM2 = panel.wasteAreaMm2 / 1_000_000;
    const usedPrice = usedM2 * pricePerSqm;
    const wastePrice = wasteM2 * pricePerSqm;

    const save = useCallback(() => {
      if (!svgRef.current) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgRef.current);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pannello-${index + 1}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }, [index]);

    useImperativeHandle(ref, () => ({ save }));

    return (
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">
            Pannello {index + 1}
            <span className="font-normal text-xs text-muted-foreground ml-2">
              {panel.stockPanel.width}×{panel.stockPanel.height}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                parseFloat(panel.usagePercent) >= 80 ? "badge-green" : "badge-red"
              }`}
            >
              {panel.usagePercent}% utilizzato
            </span>
            <button
              onClick={save}
              className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
            >
              💾 Salva
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Utilizzato</div>
            <div className="text-primary font-bold">{panel.usagePercent}%</div>
            <div className="text-muted-foreground">{usedM2.toFixed(4)} m²</div>
            {pricePerSqm > 0 && (
              <div className="text-primary">€{usedPrice.toFixed(2)}</div>
            )}
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Perso</div>
            <div className="text-destructive font-bold">{panel.wastePercent}%</div>
            <div className="text-muted-foreground">{wasteM2.toFixed(4)} m²</div>
            {pricePerSqm > 0 && (
              <div className="text-destructive">€{wastePrice.toFixed(2)}</div>
            )}
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Pezzi</div>
            <div className="text-foreground font-bold">{panel.pieces.length}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Dimensione</div>
            <div className="text-foreground font-bold">
              {panel.stockPanel.width}×{panel.stockPanel.height}
            </div>
          </div>
        </div>

        {/* SVG visualization */}
        <div className="overflow-x-auto">
          <svg
            ref={svgRef}
            width={svgW + 2}
            height={svgH + 2}
            viewBox={`-1 -1 ${svgW + 2} ${svgH + 2}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ background: "#0d0d0d" }}
          >
            {/* Panel outline */}
            <rect
              x={0}
              y={0}
              width={svgW}
              height={svgH}
              fill="none"
              stroke="#333"
              strokeWidth={1}
            />
            {/* Placed pieces */}
            {panel.pieces.map((p, pi) => {
              const color = COLORS[pi % COLORS.length];
              const rx = p.x * scale;
              const ry = p.y * scale;
              const rw = p.width * scale;
              const rh = p.height * scale;
              const fontSize = Math.min(rw / 8, rh / 4, 12);
              const showText = fontSize >= 5;

              return (
                <g key={pi}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={color + "33"}
                    stroke={color}
                    strokeWidth={1}
                  />
                  {showText && (
                    <>
                      {p.name && (
                        <text
                          x={rx + rw / 2}
                          y={ry + rh / 2 - fontSize * 0.8}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={color}
                          fontSize={fontSize}
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="700"
                        >
                          {p.name}
                        </text>
                      )}
                      <text
                        x={rx + rw / 2}
                        y={ry + rh / 2 + (p.name ? fontSize * 0.5 : 0)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={color}
                        fontSize={fontSize * 0.85}
                        fontFamily="'JetBrains Mono', monospace"
                      >
                        {p.label} {p.width}×{p.height}
                      </text>
                      {p.rotated && (
                        <text
                          x={rx + rw / 2}
                          y={ry + rh / 2 + fontSize * (p.name ? 1.4 : 1)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={color}
                          fontSize={fontSize * 0.7}
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          ↻
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Details table */}
        <div className="mt-3">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {detailsOpen ? "▾" : "▸"} Dettagli pezzi ({panel.pieces.length})
          </button>
          {detailsOpen && (
            <table className="w-full mt-2 text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left p-1.5 border-b border-border">Pezzo</th>
                  <th className="text-left p-1.5 border-b border-border">Nome</th>
                  <th className="text-left p-1.5 border-b border-border">X</th>
                  <th className="text-left p-1.5 border-b border-border">Y</th>
                  <th className="text-left p-1.5 border-b border-border">Larg.</th>
                  <th className="text-left p-1.5 border-b border-border">Alt.</th>
                  <th className="text-left p-1.5 border-b border-border">Ruotato</th>
                </tr>
              </thead>
              <tbody>
                {panel.pieces.map((p, pi) => (
                  <tr
                    key={pi}
                    className="hover:bg-secondary/30"
                  >
                    <td className="p-1.5 border-b border-border">{p.label}</td>
                    <td className="p-1.5 border-b border-border">{p.name || "—"}</td>
                    <td className="p-1.5 border-b border-border">{p.x}</td>
                    <td className="p-1.5 border-b border-border">{p.y}</td>
                    <td className="p-1.5 border-b border-border">{p.width}</td>
                    <td className="p-1.5 border-b border-border">{p.height}</td>
                    <td className="p-1.5 border-b border-border">
                      {p.rotated ? "Sì" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }
);

PanelResult.displayName = "PanelResult";

export default PanelResult;
