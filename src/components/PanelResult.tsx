import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from "react";
import type { UsedPanel, PlacedPiece } from "@/lib/maxrects";

// ── Canvas rendering ─────────────────────────────────────────────────────────

function drawPanel(
  ctx: CanvasRenderingContext2D,
  pieces: PlacedPiece[],
  panelW: number,
  panelH: number,
  scale: number,
  margin: number,
  fontScale = 1
) {
  const W = panelW * scale;
  const H = panelH * scale;
  const M = margin;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W + M * 2, H + M * 2);

  // Panel outline
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(M, M, W, H);

  // Pieces
  pieces.forEach((p, pi) => {
    const rx = M + p.x * scale;
    const ry = M + p.y * scale;
    const rw = p.width * scale;
    const rh = p.height * scale;

    // Alternating B&W fill
    ctx.fillStyle = pi % 2 === 0 ? "#f0f0f0" : "#e0e0e0";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);

    // Clip to piece bounds for text
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.clip();

    const maxFontName = Math.min(rw / (Math.max(p.name?.length || 4, 4) * 0.55), rh / 3, 22 * fontScale);
    const maxFontDim = Math.min(rw / 5.5, rh / 4, 16 * fontScale);
    const fontName = Math.max(maxFontName, 7 * fontScale);
    const fontDim = Math.max(maxFontDim, 6 * fontScale);

    const showName = !!p.name && rw > 25 && rh > 16 && fontName >= 5;
    const showDim = rw > 20 && rh > 12 && fontDim >= 4;
    const showRotated = p.rotated && rh > (showName ? fontName * 3 : fontDim * 2.5);

    const lineCount = (showName ? 1 : 0) + (showDim ? 1 : 0) + (showRotated ? 1 : 0);
    const lineH = showName ? fontName * 1.5 : fontDim * 1.5;
    let textY = ry + rh / 2 - ((lineCount - 1) * lineH) / 2;

    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (showName) {
      ctx.font = `bold ${fontName}px 'Courier New', monospace`;
      ctx.fillText(p.name || "", rx + rw / 2, textY, rw - 4);
      textY += lineH;
    }
    if (showDim) {
      ctx.font = `${fontDim}px 'Courier New', monospace`;
      ctx.fillText(`${p.label} ${p.width}×${p.height}`, rx + rw / 2, textY, rw - 4);
      textY += lineH;
    }
    if (showRotated) {
      ctx.font = `${fontDim * 0.85}px 'Courier New', monospace`;
      ctx.fillText("↻", rx + rw / 2, textY, rw - 4);
    }

    ctx.restore();
  });

  // Dimension lines
  const drawDimLine = (
    x1: number, y1: number, x2: number, y2: number,
    label: string, isH: boolean
  ) => {
    const len = isH ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
    if (len < 6) return;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const fontSize = Math.min(10 * fontScale, Math.max(6 * fontScale, len * 0.12));
    const tickSize = 3.5 * fontScale;

    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#888";
    ctx.lineWidth = 0.6;
    if (isH) {
      ctx.beginPath(); ctx.moveTo(x1, y1 - tickSize); ctx.lineTo(x1, y1 + tickSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2 - tickSize); ctx.lineTo(x2, y2 + tickSize); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x1 - tickSize, y1); ctx.lineTo(x1 + tickSize, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2 - tickSize, y2); ctx.lineTo(x2 + tickSize, y2); ctx.stroke();
    }

    ctx.font = `600 ${fontSize}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelW = Math.max(fontSize * (label.length * 0.65 + 0.6), fontSize * 2.5);
    const labelH = fontSize * 1.4;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
    ctx.fillStyle = "#444";
    ctx.fillText(label, midX, midY);
  };

  // Compute and draw dimension annotations
  // Per-piece: width along bottom, height along right
  pieces.forEach((p) => {
    const rx = M + p.x * scale;
    const ry = M + p.y * scale;
    const rw = p.width * scale;
    const rh = p.height * scale;
    drawDimLine(rx, ry + rh, rx + rw, ry + rh, `${p.width}`, true);
    drawDimLine(rx + rw, ry, rx + rw, ry + rh, `${p.height}`, false);
  });

  // Gap annotations along panel edges
  const xPositions = new Set<number>([0, panelW]);
  pieces.forEach(p => { xPositions.add(p.x); xPositions.add(p.x + p.width); });
  const xSorted = Array.from(xPositions).sort((a, b) => a - b);
  for (let i = 0; i < xSorted.length - 1; i++) {
    const x1 = xSorted[i], x2 = xSorted[i + 1];
    const gap = x2 - x1;
    if (gap <= 0) continue;
    const isFree = !pieces.some(p => p.x <= x1 && p.x + p.width >= x2);
    if (isFree && gap > 5) {
      drawDimLine(M + x1 * scale, M + panelH * scale, M + x2 * scale, M + panelH * scale, `${gap}`, true);
    }
  }

  const yPositions = new Set<number>([0, panelH]);
  pieces.forEach(p => { yPositions.add(p.y); yPositions.add(p.y + p.height); });
  const ySorted = Array.from(yPositions).sort((a, b) => a - b);
  for (let i = 0; i < ySorted.length - 1; i++) {
    const y1 = ySorted[i], y2 = ySorted[i + 1];
    const gap = y2 - y1;
    if (gap <= 0) continue;
    const isFree = !pieces.some(p => p.y <= y1 && p.y + p.height >= y2);
    if (isFree && gap > 5) {
      drawDimLine(M + panelW * scale, M + y1 * scale, M + panelW * scale, M + y2 * scale, `${gap}`, false);
    }
  }
}

// ── Public component ─────────────────────────────────────────────────────────

export interface PanelResultHandle {
  save: () => void;
  getPNGDataURL: () => string;
}

interface PanelResultProps {
  panel: UsedPanel;
  index: number;
  pricePerSqm: number;
}

const MARGIN = 30;
const MAX_DISPLAY_W = 800;

const PanelResult = forwardRef<PanelResultHandle, PanelResultProps>(
  ({ panel, index, pricePerSqm }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [pngDataUrl, setPngDataUrl] = useState<string>("");

    const scale = Math.min(
      (MAX_DISPLAY_W - MARGIN * 2) / panel.stockPanel.width,
      (380 - MARGIN * 2) / panel.stockPanel.height,
      1
    );

    // Render to canvas
    const renderCanvas = useCallback((cvs: HTMLCanvasElement, s: number, m: number, fScale = 1) => {
      const W = panel.stockPanel.width * s;
      const H = panel.stockPanel.height * s;
      cvs.width = W + m * 2;
      cvs.height = H + m * 2;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      drawPanel(ctx, panel.pieces, panel.stockPanel.width, panel.stockPanel.height, s, m, fScale);
    }, [panel]);

    useEffect(() => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      renderCanvas(cvs, scale, MARGIN, 1);
      setPngDataUrl(cvs.toDataURL("image/png"));
    }, [renderCanvas, scale]);

    const getPNGDataURL = useCallback((): string => {
      // High-res for PDF (2× scale for sharpness, 2× font scale for readability)
      const pdfMaxW = 1400;
      const pdfMaxH = 920;
      const pdfScale = Math.min(
        pdfMaxW / panel.stockPanel.width,
        pdfMaxH / panel.stockPanel.height,
        2.0
      );
      const offscreen = document.createElement("canvas");
      renderCanvas(offscreen, pdfScale, MARGIN * 2, 2);
      return offscreen.toDataURL("image/png");
    }, [renderCanvas, panel]);

    const save = useCallback(() => {
      const url = pngDataUrl;
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `pannello-${index + 1}.png`;
      a.click();
    }, [pngDataUrl, index]);

    useImperativeHandle(ref, () => ({ save, getPNGDataURL }));

    const usedM2 = panel.usedAreaMm2 / 1_000_000;
    const wasteM2 = panel.wasteAreaMm2 / 1_000_000;
    const usedPrice = usedM2 * pricePerSqm;
    const wastePrice = wasteM2 * pricePerSqm;

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

        {/* Panel image — hidden canvas + visible img for native right-click copy */}
        <div className="overflow-x-auto">
          <canvas ref={canvasRef} className="hidden" />
          {pngDataUrl && (
            <img
              src={pngDataUrl}
              alt={`Pannello ${index + 1}`}
              style={{ imageRendering: "crisp-edges", display: "block" }}
            />
          )}
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
