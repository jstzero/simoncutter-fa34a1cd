import { useState, useRef, useCallback } from "react";
import {
  maxRectsPack,
  type StockPanel,
  type CutPiece,
  type CutResult,
} from "@/lib/maxrects";
import PanelResult, { type PanelResultHandle } from "@/components/PanelResult";

const Index = () => {
  const [panels, setPanels] = useState<StockPanel[]>([
    { width: 1200, height: 600, qty: 10 },
  ]);
  const [pieces, setPieces] = useState<CutPiece[]>([
    { width: 400, height: 300, qty: 1, canRotate: true, name: "" },
  ]);
  const [result, setResult] = useState<CutResult | null>(null);
  const [pricePerSqm, setPricePerSqm] = useState<number>(0);
  const panelResultRefs = useRef<(PanelResultHandle | null)[]>([]);
  const panelCsvRef = useRef<HTMLInputElement>(null);
  const pieceCsvRef = useRef<HTMLInputElement>(null);

  const totalPieceCount = pieces.reduce((s, p) => s + p.qty, 0);

  // Panel CRUD
  const addPanel = () =>
    setPanels([...panels, { width: 1200, height: 600, qty: 1 }]);
  const removePanel = (i: number) => {
    if (panels.length <= 1) return;
    setPanels(panels.filter((_, idx) => idx !== i));
  };
  const updatePanel = (i: number, field: keyof StockPanel, val: number) => {
    const next = [...panels];
    next[i] = { ...next[i], [field]: Math.max(1, val || 0) };
    setPanels(next);
  };

  // Piece CRUD
  const addPiece = () =>
    setPieces([
      ...pieces,
      { width: 400, height: 300, qty: 1, canRotate: true, name: "" },
    ]);
  const addMargin = () =>
    setPieces(pieces.map(p => ({ ...p, width: p.width + 10, height: p.height + 10 })));
  const removeMargin = () =>
    setPieces(pieces.map(p => ({ ...p, width: Math.max(1, p.width - 10), height: Math.max(1, p.height - 10) })));
  const removePiece = (i: number) => {
    if (pieces.length <= 1) return;
    setPieces(pieces.filter((_, idx) => idx !== i));
  };
  const updatePiece = (i: number, field: string, val: unknown) => {
    const next = [...pieces];
    if (field === "canRotate") {
      next[i] = { ...next[i], canRotate: val as boolean };
    } else if (field === "name") {
      next[i] = { ...next[i], name: val as string };
    } else {
      next[i] = {
        ...next[i],
        [field]: Math.max(1, (val as number) || 0),
      };
    }
    setPieces(next);
  };

  // Execute
  const execute = useCallback(() => {
    const res = maxRectsPack(panels, pieces);
    setResult(res);
    panelResultRefs.current = [];
  }, [panels, pieces]);

  // Export pieces as CSV
  const exportPiecesCSV = useCallback(() => {
    const header = "Larghezza,Altezza,Quota,Nome\n";
    const rows = pieces
      .map(p => `${p.width},${p.height},${p.qty},${p.name || ""}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pezzi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [pieces]);

  // CSV Import Panels
  const importPanelsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      const newPanels: StockPanel[] = [];
      lines.forEach((line) => {
        const parts = line.split(/[,;\t]/).map((s) => parseInt(s.trim()));
        if (parts.length >= 3 && parts.every((n) => !isNaN(n) && n > 0)) {
          newPanels.push({ width: parts[0], height: parts[1], qty: parts[2] });
        }
      });
      if (newPanels.length > 0) setPanels(newPanels);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // CSV Import Pieces (format: Larghezza,Altezza,Quota,nome)
  const importPiecesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      const newPieces: CutPiece[] = [];
      lines.forEach((line) => {
        const parts = line.split(/[,;\t]/);
        const w = parseInt(parts[0]?.trim());
        const h = parseInt(parts[1]?.trim());
        const q = parseInt(parts[2]?.trim());
        const name = parts[3]?.trim() || "";
        if (!isNaN(w) && !isNaN(h) && !isNaN(q) && w > 0 && h > 0 && q > 0) {
          newPieces.push({
            width: w,
            height: h,
            qty: q,
            canRotate: true,
            name,
          });
        }
      });
      if (newPieces.length > 0) setPieces(newPieces);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // PDF Save all — one panel per page, landscape
  const saveAll = useCallback(() => {
    if (!result) return;

    const pw = window.open("", "_blank");
    if (!pw) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString("it-IT") + ", " + now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

    // Get PNG data URL for each panel
    const panelPNGs = panelResultRefs.current
      .map((r) => {
        if (!r) return null;
        return r.getPNGDataURL();
      })
      .filter(Boolean) as string[];

    let html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>SimonCutter — Pannelli</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: white; }
  .page {
    width: 297mm;
    height: 210mm;
    position: relative;
    page-break-after: always;
    overflow: hidden;
    padding: 5mm 5mm 3mm 5mm;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9pt;
    color: #555;
    margin-bottom: 3mm;
    flex-shrink: 0;
  }
  .panel-title {
    font-size: 11pt;
    font-weight: bold;
    color: #111;
  }
  .page-body {
    flex: 1;
    display: flex;
    flex-direction: row;
    gap: 4mm;
    min-height: 0;
    overflow: hidden;
  }
  .svg-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 0;
    min-width: 0;
  }
  .svg-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }
  .piece-list {
    width: 42mm;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    font-size: 6.5pt;
    color: #222;
    border-left: 0.3mm solid #ccc;
    padding-left: 3mm;
    overflow: hidden;
  }
  .piece-list-title {
    font-size: 7.5pt;
    font-weight: bold;
    margin-bottom: 1.5mm;
    color: #111;
    border-bottom: 0.3mm solid #ddd;
    padding-bottom: 1mm;
  }
  .piece-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 6pt;
    flex: 1;
    overflow: hidden;
  }
  .piece-table th {
    text-align: left;
    color: #666;
    font-weight: normal;
    border-bottom: 0.2mm solid #ddd;
    padding: 0.5mm 0;
  }
  .piece-table td {
    padding: 0.6mm 0.5mm;
    border-bottom: 0.15mm solid #eee;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 22mm;
  }
  .piece-table tr:nth-child(even) { background: #f8f8f8; }
  .piece-list-stats {
    margin-top: 2mm;
    font-size: 6pt;
    color: #555;
    border-top: 0.3mm solid #ddd;
    padding-top: 1.5mm;
    line-height: 1.6;
  }
  .page-footer {
    font-size: 7.5pt;
    color: #888;
    display: flex;
    justify-content: space-between;
    margin-top: 2mm;
    flex-shrink: 0;
  }
  @media print {
    @page { size: A4 landscape; margin: 0; }
    body { margin: 0; }
  }
  .no-print {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 999;
    display: flex;
    gap: 8px;
  }
  .no-print button {
    padding: 8px 16px;
    background: #111;
    color: white;
    border: none;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
  }
</style>
</head><body>
<div class="no-print">
  <button onclick="window.print()">🖨 Stampa / Salva PDF</button>
  <button onclick="window.close()">✕ Chiudi</button>
</div>`;

    result.usedPanels.forEach((panel, i) => {
      const pngSrc = panelPNGs[i] || "";
      const usedM2 = (panel.usedAreaMm2 / 1_000_000).toFixed(3);
      const wasteM2 = (panel.wasteAreaMm2 / 1_000_000).toFixed(3);
      const pageNum = `${i + 1}/${result.usedPanels.length}`;

      const pieceRows = panel.pieces.map((p, pi) =>
        `<tr>
          <td>${p.label}</td>
          <td>${p.name || "—"}</td>
          <td>${p.width}×${p.height}</td>
          <td>${p.rotated ? "↻" : ""}</td>
        </tr>`
      ).join("");

      html += `
<div class="page">
  <div class="page-header">
    <span>${dateStr}</span>
    <span class="panel-title">Pannello ${i + 1} — ${panel.stockPanel.width}×${panel.stockPanel.height} mm</span>
    <span>SimonCutter</span>
  </div>
  <div class="page-body">
    <div class="svg-container"><img src="${pngSrc}" /></div>
    <div class="piece-list">
      <div class="piece-list-title">Pezzi (${panel.pieces.length})</div>
      <table class="piece-table">
        <thead><tr><th>#</th><th>Nome</th><th>Dim.</th><th></th></tr></thead>
        <tbody>${pieceRows}</tbody>
      </table>
      <div class="piece-list-stats">
        Utilizzo: ${panel.usagePercent}%<br/>
        ${usedM2} m² usati<br/>
        ${wasteM2} m² spreco
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span>Utilizzo: ${panel.usagePercent}% | Spreco: ${panel.wastePercent}%</span>
    <span>${pageNum}</span>
  </div>
</div>`;
    });

    html += `</body></html>`;
    pw.document.write(html);
    pw.document.close();
    setTimeout(() => pw.print(), 500);
  }, [result]);

  // Stats
  const totalUsedM2 = result
    ? result.usedPanels.reduce((s, p) => s + p.usedAreaMm2, 0) / 1_000_000
    : 0;
  const totalWasteM2 = result
    ? result.usedPanels.reduce((s, p) => s + p.wasteAreaMm2, 0) / 1_000_000
    : 0;
  const avgWaste = result
    ? (
        result.usedPanels.reduce(
          (s, p) => s + parseFloat(p.wastePercent),
          0
        ) / (result.usedPanels.length || 1)
      ).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-[4px] uppercase text-primary">
          SimonCutter
        </h1>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* Input grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Panels card */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold">Pannelli disponibili</h2>
              <div className="flex gap-2">
                <input
                  ref={panelCsvRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={importPanelsCSV}
                  className="hidden"
                />
                <button
                  onClick={() => panelCsvRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
                >
                  CSV
                </button>
                <button
                  onClick={addPanel}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
                >
                  + Aggiungi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_1fr_70px_32px] gap-2 text-[11px] text-muted-foreground px-1 mb-1">
              <span>Larghezza</span>
              <span>Altezza</span>
              <span>Qta</span>
              <span></span>
            </div>
            {panels.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_70px_32px] gap-2 items-center mb-1.5"
              >
                <input
                  type="number"
                  value={p.width}
                  onChange={(e) => updatePanel(i, "width", parseInt(e.target.value))}
                  className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                />
                <input
                  type="number"
                  value={p.height}
                  onChange={(e) => updatePanel(i, "height", parseInt(e.target.value))}
                  className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                />
                <input
                  type="number"
                  value={p.qty}
                  onChange={(e) => updatePanel(i, "qty", parseInt(e.target.value))}
                  className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                />
                <button
                  onClick={() => removePanel(i)}
                  disabled={panels.length <= 1}
                  className="p-1 bg-transparent border-none text-muted-foreground hover:text-destructive cursor-pointer text-base disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Pieces card */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold">
                Pezzi da tagliare
                <span className="font-normal text-xs text-muted-foreground ml-2">
                  ({totalPieceCount} totali)
                </span>
              </h2>
              <div className="flex gap-2">
                <input
                  ref={pieceCsvRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={importPiecesCSV}
                  className="hidden"
                />
                <button
                  onClick={() => pieceCsvRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
                >
                  ↑ CSV
                </button>
                <button
                  onClick={exportPiecesCSV}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
                >
                  ↓ CSV
                </button>
                <button
                  onClick={addPiece}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
                >
                  + Aggiungi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[36px_minmax(60px,1fr)_1fr_1fr_60px_40px_80px_32px] gap-2 text-[11px] text-muted-foreground px-1 mb-1">
              <span>#</span>
              <span>Nome</span>
              <span>Larghezza</span>
              <span>Altezza</span>
              <span>Qta</span>
              <span>Rot.</span>
              <span>Perimetro</span>
              <span></span>
            </div>
            <div className="max-h-[400px] overflow-y-auto pr-1">
              {pieces.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[36px_minmax(60px,1fr)_1fr_1fr_60px_40px_80px_32px] gap-2 items-center mb-1.5"
                >
                  <span className="text-[11px] text-muted-foreground text-center">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updatePiece(i, "name", e.target.value)}
                    placeholder="—"
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <input
                    type="number"
                    value={p.width}
                    onChange={(e) => updatePiece(i, "width", parseInt(e.target.value))}
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <input
                    type="number"
                    value={p.height}
                    onChange={(e) => updatePiece(i, "height", parseInt(e.target.value))}
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <input
                    type="number"
                    value={p.qty}
                    onChange={(e) => updatePiece(i, "qty", parseInt(e.target.value))}
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <button
                    onClick={() => updatePiece(i, "canRotate", !p.canRotate)}
                    className={`w-9 h-8 flex items-center justify-center rounded border text-sm transition-all cursor-pointer ${
                      p.canRotate
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-transparent border-border text-muted-foreground"
                    }`}
                  >
                    ↻
                  </button>
                  <span className="text-[12px] text-muted-foreground text-center font-mono">
                    {2 * (p.width + p.height)}
                  </span>
                  <button
                    onClick={() => removePiece(i)}
                    disabled={pieces.length <= 1}
                    className="p-1 bg-transparent border-none text-muted-foreground hover:text-destructive cursor-pointer text-base disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 px-1 text-[13px] font-bold text-foreground text-right border-t border-border pt-2">
              Perimetro totale: {pieces.reduce((sum, p) => sum + 2 * (p.width + p.height) * p.qty, 0)} mm
            </div>
            <div className="mt-3 flex justify-end gap-2 flex-wrap">
              <button
                onClick={removeMargin}
                className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
              >
                − 1cm a tutti
              </button>
              <button
                onClick={addMargin}
                className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
              >
                + 1cm a tutti
              </button>
              <button
                onClick={() => setPieces(pieces.map(p => ({ ...p, canRotate: true })))}
                className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
              >
                Tinta Unita
              </button>
              <button
                onClick={() => setPieces(pieces.map(p => ({ ...p, canRotate: false })))}
                className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
              >
                Venature
              </button>
            </div>
          </div>
        </div>

        {/* Price + Execute row */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Prezzo €/m²
            </label>
            <input
              type="number"
              value={pricePerSqm || ""}
              onChange={(e) => setPricePerSqm(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              min={0}
              step={0.01}
              className="bg-input border border-border rounded px-2 py-2.5 text-sm text-foreground outline-none focus:border-primary w-28 font-mono"
            />
          </div>
          <button
            onClick={execute}
            className="bg-primary text-primary-foreground border border-primary font-bold text-sm px-10 py-2.5 rounded tracking-[3px] uppercase hover:bg-primary-dim hover:border-primary-dim transition-all font-mono"
          >
            TAGLIA
          </button>
        </div>

        {/* Results */}
        {result && (
          <div id="results-section">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-[28px] font-bold text-primary">
                  {result.totalPanels}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Pannelli</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-[28px] font-bold text-primary">
                  {result.averageUsage}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Utilizzo medio</div>
                <div className="text-xs text-muted-foreground">
                  {totalUsedM2.toFixed(4)} m²
                </div>
                {pricePerSqm > 0 && (
                  <div className="text-xs text-primary">
                    €{(totalUsedM2 * pricePerSqm).toFixed(2)}
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-[28px] font-bold text-destructive">
                  {avgWaste}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Spreco medio</div>
                <div className="text-xs text-muted-foreground">
                  {totalWasteM2.toFixed(4)} m²
                </div>
                {pricePerSqm > 0 && (
                  <div className="text-xs text-destructive">
                    €{(totalWasteM2 * pricePerSqm).toFixed(2)}
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div
                  className={`text-[28px] font-bold ${
                    result.unplacedPieces.length > 0
                      ? "text-destructive"
                      : "text-primary"
                  }`}
                >
                  {result.unplacedPieces.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Non allocati</div>
              </div>
            </div>

            {/* Unplaced pieces */}
            {result.unplacedPieces.length > 0 && (
              <div className="unplaced-box rounded-lg p-4 mb-6">
                <h3 className="font-bold text-destructive text-sm mb-2">
                  ⚠ Pezzi non allocati
                </h3>
                <ul className="list-none">
                  {result.unplacedPieces.map((u, i) => (
                    <li key={i} className="text-[13px] text-destructive mb-1">
                      {u.piece.width}×{u.piece.height}
                      {u.piece.name ? ` (${u.piece.name})` : ""} — {u.remaining} pz
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Panel results */}
            {result.usedPanels.map((panel, i) => (
              <PanelResult
                key={i}
                ref={(el) => {
                  panelResultRefs.current[i] = el;
                }}
                panel={panel}
                index={i}
                pricePerSqm={pricePerSqm}
              />
            ))}

            {/* Save all button */}
            <div className="flex justify-center mt-6 mb-4">
              <button
                onClick={saveAll}
                className="bg-primary text-primary-foreground border border-primary font-bold text-sm px-10 py-2.5 rounded tracking-[3px] uppercase hover:opacity-90 transition-all font-mono"
              >
                💾 SALVA TUTTI I PANNELLI
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-4 text-center text-[11px] text-muted-foreground mt-10">
        SimonCutter — MaxRects 2D Optimization
      </footer>
    </div>
  );
};

export default Index;
