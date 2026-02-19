import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo } from "react";
import type { UsedPanel, PlacedPiece } from "@/lib/maxrects";

// ── Dimension annotation outside pieces (panel-level measurements) ──────────
interface DimLine {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
  orientation: 'h' | 'v';
}

/**
 * Compute dimension lines along panel edges only (right edge = widths, bottom edge = heights).
 * These are placed outside the SVG piece area to avoid overlapping piece labels.
 */
function computePanelDimLines(
  pieces: PlacedPiece[],
  panelW: number,
  panelH: number,
  scale: number
): DimLine[] {
  const lines: DimLine[] = [];

  // For each piece: right-side annotation (height) and bottom annotation (width)
  // Only the outermost pieces get panel-edge measurements to avoid clutter
  for (const p of pieces) {
    const rx = p.x * scale;
    const ry = p.y * scale;
    const rw = p.width * scale;
    const rh = p.height * scale;

    // Width annotation along bottom, just below piece bottom edge
    lines.push({
      x1: rx, y1: ry + rh,
      x2: rx + rw, y2: ry + rh,
      label: `${p.width}`,
      orientation: 'h',
    });

    // Height annotation along right, just right of piece right edge
    lines.push({
      x1: rx + rw, y1: ry,
      x2: rx + rw, y2: ry + rh,
      label: `${p.height}`,
      orientation: 'v',
    });
  }

  // Gap between pieces and panel borders (horizontal — panel width segments)
  // Collect unique X boundaries across all pieces and panel
  const xPositions = new Set<number>([0, panelW]);
  pieces.forEach(p => { xPositions.add(p.x); xPositions.add(p.x + p.width); });
  const xSorted = Array.from(xPositions).sort((a, b) => a - b);

  for (let i = 0; i < xSorted.length - 1; i++) {
    const x1 = xSorted[i];
    const x2 = xSorted[i + 1];
    const gap = x2 - x1;
    if (gap <= 0) continue;

    // Check if this gap is free (no piece spans it fully)
    const isFreeGap = !pieces.some(p => p.x <= x1 && p.x + p.width >= x2);
    if (isFreeGap && gap > 5) {
      lines.push({
        x1: x1 * scale, y1: panelH * scale,
        x2: x2 * scale, y2: panelH * scale,
        label: `${gap}`,
        orientation: 'h',
      });
    }
  }

  // Collect unique Y boundaries
  const yPositions = new Set<number>([0, panelH]);
  pieces.forEach(p => { yPositions.add(p.y); yPositions.add(p.y + p.height); });
  const ySorted = Array.from(yPositions).sort((a, b) => a - b);

  for (let i = 0; i < ySorted.length - 1; i++) {
    const y1 = ySorted[i];
    const y2 = ySorted[i + 1];
    const gap = y2 - y1;
    if (gap <= 0) continue;

    const isFreeGap = !pieces.some(p => p.y <= y1 && p.y + p.height >= y2);
    if (isFreeGap && gap > 5) {
      lines.push({
        x1: panelW * scale, y1: y1 * scale,
        x2: panelW * scale, y2: y2 * scale,
        label: `${gap}`,
        orientation: 'v',
      });
    }
  }

  return lines;
}

// ── SVG rendering helpers ────────────────────────────────────────────────────

function renderPieceSVG(p: PlacedPiece, pi: number, scale: number): string {
  const rx = p.x * scale;
  const ry = p.y * scale;
  const rw = p.width * scale;
  const rh = p.height * scale;

  // Font sizes — all text must stay inside piece
  const maxFontName = Math.min(rw / (Math.max(p.name?.length || 4, 4) * 0.65), rh / 4, 13);
  const maxFontDim = Math.min(rw / 7, rh / 5, 11);
  const fontName = Math.max(maxFontName, 5);
  const fontDim = Math.max(maxFontDim, 4.5);

  // Only show text if piece is large enough
  const showName = p.name && rw > 30 && rh > 20 && fontName >= 5;
  const showDim = rw > 25 && rh > 15 && fontDim >= 4.5;
  const showRotated = p.rotated && rh > (showName ? fontName * 3 : fontDim * 2.5);

  // Alternating light/dark fill for B&W pattern
  const fillGray = pi % 2 === 0 ? "#f0f0f0" : "#e0e0e0";
  const strokeColor = "#333";
  const textColor = "#111";

  // Vertical centering: stack name + dim + rotated symbol
  const lineCount = (showName ? 1 : 0) + (showDim ? 1 : 0) + (showRotated ? 1 : 0);
  const lineH = showName ? fontName * 1.5 : fontDim * 1.5;
  let textY = ry + rh / 2 - ((lineCount - 1) * lineH) / 2;

  let txt = "";
  if (showName) {
    txt += `<text x="${rx + rw / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle"
      fill="${textColor}" font-size="${fontName}" font-family="'Courier New',monospace" font-weight="700"
      clip-path="url(#clip-${pi})">${p.name}</text>`;
    textY += lineH;
  }
  if (showDim) {
    txt += `<text x="${rx + rw / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle"
      fill="${textColor}" font-size="${fontDim}" font-family="'Courier New',monospace"
      clip-path="url(#clip-${pi})">${p.label} ${p.width}×${p.height}</text>`;
    textY += lineH;
  }
  if (showRotated) {
    txt += `<text x="${rx + rw / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle"
      fill="${textColor}" font-size="${fontDim * 0.85}" font-family="'Courier New',monospace"
      clip-path="url(#clip-${pi})">↻</text>`;
  }

  return `<g>
    <clipPath id="clip-${pi}">
      <rect x="${rx + 1}" y="${ry + 1}" width="${rw - 2}" height="${rh - 2}"/>
    </clipPath>
    <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"
      fill="${fillGray}" stroke="${strokeColor}" stroke-width="1"/>
    ${txt}
  </g>`;
}

function renderDimLineSVG(d: DimLine, idx: number): string {
  const isH = d.orientation === 'h';
  const len = isH ? Math.abs(d.x2 - d.x1) : Math.abs(d.y2 - d.y1);
  if (len < 6) return "";

  const midX = (d.x1 + d.x2) / 2;
  const midY = (d.y1 + d.y2) / 2;
  const fontSize = Math.min(8, Math.max(5.5, len * 0.12));
  const tickSize = 3.5;
  const labelW = Math.max(fontSize * (d.label.length * 0.65 + 0.6), fontSize * 2.5);
  const labelH = fontSize * 1.4;

  const ticks = isH
    ? `<line x1="${d.x1}" y1="${d.y1 - tickSize}" x2="${d.x1}" y2="${d.y1 + tickSize}" stroke="#888" stroke-width="0.6"/>
       <line x1="${d.x2}" y1="${d.y2 - tickSize}" x2="${d.x2}" y2="${d.y2 + tickSize}" stroke="#888" stroke-width="0.6"/>`
    : `<line x1="${d.x1 - tickSize}" y1="${d.y1}" x2="${d.x1 + tickSize}" y2="${d.y1}" stroke="#888" stroke-width="0.6"/>
       <line x1="${d.x2 - tickSize}" y1="${d.y2}" x2="${d.x2 + tickSize}" y2="${d.y2}" stroke="#888" stroke-width="0.6"/>`;

  return `<g key="dim-${idx}">
    <line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="#aaa" stroke-width="0.5" stroke-dasharray="3,2"/>
    ${ticks}
    <rect x="${midX - labelW / 2}" y="${midY - labelH / 2}" width="${labelW}" height="${labelH}" fill="white" opacity="0.92" rx="1"/>
    <text x="${midX}" y="${midY}" text-anchor="middle" dominant-baseline="middle"
      fill="#444" font-size="${fontSize}" font-family="'Courier New',monospace" font-weight="600">${d.label}</text>
  </g>`;
}

// ── Public component ─────────────────────────────────────────────────────────

export interface PanelResultHandle {
  save: () => void;
  getSVGString: (index: number) => string;
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

    // Scale to fit display
    const maxDisplayWidth = 800;
    const MARGIN = 30; // px margin for external dim lines
    const scale = Math.min(
      (maxDisplayWidth - MARGIN * 2) / panel.stockPanel.width,
      (380 - MARGIN * 2) / panel.stockPanel.height,
      1
    );
    const svgW = panel.stockPanel.width * scale;
    const svgH = panel.stockPanel.height * scale;

    const usedM2 = panel.usedAreaMm2 / 1_000_000;
    const wasteM2 = panel.wasteAreaMm2 / 1_000_000;
    const usedPrice = usedM2 * pricePerSqm;
    const wastePrice = wasteM2 * pricePerSqm;

    const dimLines = useMemo(
      () => computePanelDimLines(panel.pieces, panel.stockPanel.width, panel.stockPanel.height, scale),
      [panel.pieces, panel.stockPanel.width, panel.stockPanel.height, scale]
    );

    // Build full SVG string (used for PDF export)
    const buildSVGString = useCallback((svgScale?: number): string => {
      const s = svgScale ?? scale;
      const W = panel.stockPanel.width * s;
      const H = panel.stockPanel.height * s;
      const M = 28;
      const totalW = W + M * 2;
      const totalH = H + M * 2;

      const dims = computePanelDimLines(panel.pieces, panel.stockPanel.width, panel.stockPanel.height, s);

      const piecesHTML = panel.pieces
        .map((p, pi) => renderPieceSVG(p, pi, s))
        .join("\n");

      const dimsHTML = dims
        .map((d, di) => {
          // Offset by margin
          const shifted: DimLine = {
            ...d,
            x1: d.x1 + M, y1: d.y1 + M,
            x2: d.x2 + M, y2: d.y2 + M,
          };
          return renderDimLineSVG(shifted, di);
        })
        .join("\n");

      return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="background:white">
  <!-- Panel outline -->
  <rect x="${M}" y="${M}" width="${W}" height="${H}" fill="none" stroke="#999" stroke-width="1"/>
  <!-- Pieces -->
  <g>${piecesHTML}</g>
  <!-- Dimension lines -->
  <g>${dimsHTML}</g>
</svg>`;
    }, [panel, scale]);

    const save = useCallback(() => {
      const svgStr = buildSVGString();
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pannello-${index + 1}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }, [buildSVGString, index]);

    const getSVGString = useCallback((idx: number): string => {
      // For PDF we use a fixed scale fitting A4 landscape (roughly 240mm x 170mm usable)
      const pdfMaxW = 700; // px approx
      const pdfMaxH = 460;
      const pdfScale = Math.min(
        pdfMaxW / panel.stockPanel.width,
        pdfMaxH / panel.stockPanel.height,
        1.2
      );
      return buildSVGString(pdfScale);
    }, [buildSVGString, panel]);

    useImperativeHandle(ref, () => ({ save, getSVGString }));

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
              className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                parseFloat(panel.usagePercent) >= 80
                  ? "border-foreground text-foreground"
                  : "border-destructive text-destructive"
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
            <div className="text-foreground font-bold">{panel.usagePercent}%</div>
            <div className="text-muted-foreground">{usedM2.toFixed(4)} m²</div>
            {pricePerSqm > 0 && <div className="text-foreground">€{usedPrice.toFixed(2)}</div>}
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Perso</div>
            <div className="text-destructive font-bold">{panel.wastePercent}%</div>
            <div className="text-muted-foreground">{wasteM2.toFixed(4)} m²</div>
            {pricePerSqm > 0 && <div className="text-destructive">€{wastePrice.toFixed(2)}</div>}
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
            width={svgW + MARGIN * 2}
            height={svgH + MARGIN * 2}
            viewBox={`0 0 ${svgW + MARGIN * 2} ${svgH + MARGIN * 2}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ background: "#ffffff" }}
          >
            {/* Panel outline */}
            <rect
              x={MARGIN}
              y={MARGIN}
              width={svgW}
              height={svgH}
              fill="none"
              stroke="#999"
              strokeWidth={1}
            />

            {/* Placed pieces */}
            {panel.pieces.map((p, pi) => {
              const rx = p.x * scale + MARGIN;
              const ry = p.y * scale + MARGIN;
              const rw = p.width * scale;
              const rh = p.height * scale;

              const maxFontName = Math.min(rw / (Math.max(p.name?.length || 4, 4) * 0.65), rh / 4, 13);
              const maxFontDim = Math.min(rw / 7, rh / 5, 11);
              const fontName = Math.max(maxFontName, 5);
              const fontDim = Math.max(maxFontDim, 4.5);

              const showName = !!p.name && rw > 30 && rh > 20 && fontName >= 5;
              const showDim = rw > 25 && rh > 15 && fontDim >= 4.5;
              const showRotated = p.rotated && rh > (showName ? fontName * 3 : fontDim * 2.5);

              const fillGray = pi % 2 === 0 ? "#f0f0f0" : "#e0e0e0";

              const lineCount = (showName ? 1 : 0) + (showDim ? 1 : 0) + (showRotated ? 1 : 0);
              const lineH = showName ? fontName * 1.5 : fontDim * 1.5;
              let textY = ry + rh / 2 - ((lineCount - 1) * lineH) / 2;

              return (
                <g key={pi}>
                  <clipPath id={`clip-${pi}-${index}`}>
                    <rect x={rx + 1} y={ry + 1} width={rw - 2} height={rh - 2} />
                  </clipPath>
                  <rect
                    x={rx} y={ry} width={rw} height={rh}
                    fill={fillGray}
                    stroke="#333"
                    strokeWidth={1}
                  />
                  {showName && (() => {
                    const y = textY;
                    textY += lineH;
                    return (
                      <text
                        key="name"
                        x={rx + rw / 2} y={y}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="#111" fontSize={fontName}
                        fontFamily="'Courier New',monospace" fontWeight="700"
                        clipPath={`url(#clip-${pi}-${index})`}
                      >
                        {p.name}
                      </text>
                    );
                  })()}
                  {showDim && (() => {
                    const y = textY;
                    textY += lineH;
                    return (
                      <text
                        key="dim"
                        x={rx + rw / 2} y={y}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="#111" fontSize={fontDim}
                        fontFamily="'Courier New',monospace"
                        clipPath={`url(#clip-${pi}-${index})`}
                      >
                        {p.label} {p.width}×{p.height}
                      </text>
                    );
                  })()}
                  {showRotated && (() => {
                    const y = textY;
                    return (
                      <text
                        key="rot"
                        x={rx + rw / 2} y={y}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="#111" fontSize={fontDim * 0.85}
                        fontFamily="'Courier New',monospace"
                        clipPath={`url(#clip-${pi}-${index})`}
                      >
                        ↻
                      </text>
                    );
                  })()}
                </g>
              );
            })}

            {/* Dimension lines (outside pieces, along edges) */}
            {dimLines.map((d, di) => {
              const shifted: DimLine = {
                ...d,
                x1: d.x1 + MARGIN, y1: d.y1 + MARGIN,
                x2: d.x2 + MARGIN, y2: d.y2 + MARGIN,
              };
              const isH = shifted.orientation === 'h';
              const len = isH ? Math.abs(shifted.x2 - shifted.x1) : Math.abs(shifted.y2 - shifted.y1);
              if (len < 6) return null;

              const midX = (shifted.x1 + shifted.x2) / 2;
              const midY = (shifted.y1 + shifted.y2) / 2;
              const fontSize = Math.min(8, Math.max(5.5, len * 0.12));
              const tickSize = 3.5;
              const labelW = Math.max(fontSize * (d.label.length * 0.65 + 0.6), fontSize * 2.5);
              const labelH = fontSize * 1.4;

              return (
                <g key={`dim-${di}`}>
                  <line
                    x1={shifted.x1} y1={shifted.y1}
                    x2={shifted.x2} y2={shifted.y2}
                    stroke="#aaa" strokeWidth={0.5} strokeDasharray="3,2"
                  />
                  {isH ? (
                    <>
                      <line x1={shifted.x1} y1={shifted.y1 - tickSize} x2={shifted.x1} y2={shifted.y1 + tickSize} stroke="#888" strokeWidth={0.6} />
                      <line x1={shifted.x2} y1={shifted.y2 - tickSize} x2={shifted.x2} y2={shifted.y2 + tickSize} stroke="#888" strokeWidth={0.6} />
                    </>
                  ) : (
                    <>
                      <line x1={shifted.x1 - tickSize} y1={shifted.y1} x2={shifted.x1 + tickSize} y2={shifted.y1} stroke="#888" strokeWidth={0.6} />
                      <line x1={shifted.x2 - tickSize} y1={shifted.y2} x2={shifted.x2 + tickSize} y2={shifted.y2} stroke="#888" strokeWidth={0.6} />
                    </>
                  )}
                  <rect
                    x={midX - labelW / 2} y={midY - labelH / 2}
                    width={labelW} height={labelH}
                    fill="white" opacity={0.92} rx={1}
                  />
                  <text
                    x={midX} y={midY}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#444" fontSize={fontSize}
                    fontFamily="'Courier New',monospace" fontWeight="600"
                  >
                    {d.label}
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
                  <tr key={pi} className="hover:bg-secondary/30">
                    <td className="p-1.5 border-b border-border">{p.label}</td>
                    <td className="p-1.5 border-b border-border">{p.name || "—"}</td>
                    <td className="p-1.5 border-b border-border">{p.x}</td>
                    <td className="p-1.5 border-b border-border">{p.y}</td>
                    <td className="p-1.5 border-b border-border">{p.width}</td>
                    <td className="p-1.5 border-b border-border">{p.height}</td>
                    <td className="p-1.5 border-b border-border">{p.rotated ? "Sì" : "No"}</td>
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
