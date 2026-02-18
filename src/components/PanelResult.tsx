import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo } from "react";
import type { UsedPanel, PlacedPiece } from "@/lib/maxrects";

const COLORS = [
  "#2563eb", "#0891b2", "#ea580c", "#db2777", "#7c3aed", "#ca8a04",
  "#6366f1", "#0284c7", "#dc2626", "#78716c", "#475569", "#d97706",
];

interface GapAnnotation {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
  orientation: 'h' | 'v';
}

function computeGaps(pieces: PlacedPiece[], panelW: number, panelH: number, scale: number): GapAnnotation[] {
  const gaps: GapAnnotation[] = [];

  for (const p of pieces) {
    // Left gap: nearest obstacle to the left
    let nearestRight = 0;
    for (const other of pieces) {
      if (other === p) continue;
      const otherRight = other.x + other.width;
      if (otherRight <= p.x) {
        const yOverlap = Math.min(p.y + p.height, other.y + other.height) - Math.max(p.y, other.y);
        if (yOverlap > 0 && otherRight > nearestRight) nearestRight = otherRight;
      }
    }
    const leftGap = p.x - nearestRight;
    if (leftGap > 0) {
      const midY = (p.y + p.height / 2) * scale;
      gaps.push({ x1: nearestRight * scale, y1: midY, x2: p.x * scale, y2: midY, label: `${leftGap}`, orientation: 'h' });
    }

    // Top gap: nearest obstacle above
    let nearestBottom = 0;
    for (const other of pieces) {
      if (other === p) continue;
      const otherBottom = other.y + other.height;
      if (otherBottom <= p.y) {
        const xOverlap = Math.min(p.x + p.width, other.x + other.width) - Math.max(p.x, other.x);
        if (xOverlap > 0 && otherBottom > nearestBottom) nearestBottom = otherBottom;
      }
    }
    const topGap = p.y - nearestBottom;
    if (topGap > 0) {
      const midX = (p.x + p.width / 2) * scale;
      gaps.push({ x1: midX, y1: nearestBottom * scale, x2: midX, y2: p.y * scale, label: `${topGap}`, orientation: 'v' });
    }

    // Right gap to panel edge (only if no neighbor to the right)
    const pRight = p.x + p.width;
    let hasRightNeighbor = false;
    for (const other of pieces) {
      if (other === p) continue;
      if (other.x >= pRight) {
        const yOverlap = Math.min(p.y + p.height, other.y + other.height) - Math.max(p.y, other.y);
        if (yOverlap > 0) { hasRightNeighbor = true; break; }
      }
    }
    if (!hasRightNeighbor && panelW - pRight > 0) {
      const midY = (p.y + p.height / 2) * scale;
      gaps.push({ x1: pRight * scale, y1: midY, x2: panelW * scale, y2: midY, label: `${panelW - pRight}`, orientation: 'h' });
    }

    // Bottom gap to panel edge (only if no neighbor below)
    const pBottom = p.y + p.height;
    let hasBottomNeighbor = false;
    for (const other of pieces) {
      if (other === p) continue;
      if (other.y >= pBottom) {
        const xOverlap = Math.min(p.x + p.width, other.x + other.width) - Math.max(p.x, other.x);
        if (xOverlap > 0) { hasBottomNeighbor = true; break; }
      }
    }
    if (!hasBottomNeighbor && panelH - pBottom > 0) {
      const midX = (p.x + p.width / 2) * scale;
      gaps.push({ x1: midX, y1: pBottom * scale, x2: midX, y2: panelH * scale, label: `${panelH - pBottom}`, orientation: 'v' });
    }
  }

  // Deduplicate
  const unique: GapAnnotation[] = [];
  for (const g of gaps) {
    if (!unique.some(u => Math.abs(u.x1 - g.x1) < 2 && Math.abs(u.y1 - g.y1) < 2 && Math.abs(u.x2 - g.x2) < 2 && Math.abs(u.y2 - g.y2) < 2)) {
      unique.push(g);
    }
  }
  return unique;
}

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

    const gapAnnotations = useMemo(
      () => computeGaps(panel.pieces, panel.stockPanel.width, panel.stockPanel.height, scale),
      [panel.pieces, panel.stockPanel.width, panel.stockPanel.height, scale]
    );

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
            style={{ background: "#ffffff" }}
          >
            {/* Panel outline */}
            <rect
              x={0}
              y={0}
              width={svgW}
              height={svgH}
              fill="none"
              stroke="#ccc"
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
                    fill={color + "22"}
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

            {/* Distance annotations */}
            {gapAnnotations.map((g, gi) => {
              const tickSize = 4;
              const isH = g.orientation === 'h';
              const len = isH ? Math.abs(g.x2 - g.x1) : Math.abs(g.y2 - g.y1);
              if (len < 8) return null;

              const midX = (g.x1 + g.x2) / 2;
              const midY = (g.y1 + g.y2) / 2;
              const fontSize = Math.min(9, Math.max(6, len * 0.25));

              return (
                <g key={`gap-${gi}`}>
                  <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#999" strokeWidth={0.6} strokeDasharray="3,2" />
                  {isH ? (
                    <>
                      <line x1={g.x1} y1={g.y1 - tickSize} x2={g.x1} y2={g.y1 + tickSize} stroke="#999" strokeWidth={0.6} />
                      <line x1={g.x2} y1={g.y2 - tickSize} x2={g.x2} y2={g.y2 + tickSize} stroke="#999" strokeWidth={0.6} />
                    </>
                  ) : (
                    <>
                      <line x1={g.x1 - tickSize} y1={g.y1} x2={g.x1 + tickSize} y2={g.y1} stroke="#999" strokeWidth={0.6} />
                      <line x1={g.x2 - tickSize} y1={g.y2} x2={g.x2 + tickSize} y2={g.y2} stroke="#999" strokeWidth={0.6} />
                    </>
                  )}
                  <rect
                    x={midX - fontSize * 1.8}
                    y={midY - fontSize * 0.65}
                    width={fontSize * 3.6}
                    height={fontSize * 1.3}
                    fill="white"
                    opacity={0.9}
                    rx={1}
                  />
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#666"
                    fontSize={fontSize}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="600"
                  >
                    {g.label}
                  </text>
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
