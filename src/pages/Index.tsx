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

  // Save all
  const saveAll = () => {
    panelResultRefs.current.forEach((r) => r?.save());
  };

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

  // CSV Import Pieces
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

  // CSV Export
  const exportPanelsCSV = () => {
    const csv = panels
      .map((p) => `${p.width},${p.height},${p.qty}`)
      .join("\n");
    downloadFile(csv, "pannelli.csv", "text/csv");
  };
  const exportPiecesCSV = () => {
    const csv = pieces
      .map((p) => `${p.width},${p.height},${p.qty},${p.name}`)
      .join("\n");
    downloadFile(csv, "pezzi.csv", "text/csv");
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF
  const openPDF = () => {
    if (!result) return;
    const pw = window.open("", "_blank");
    if (!pw) return;
    let h = `<html><head><title>SimonCutter - Lista di Taglio</title>
      <style>body{font-family:monospace;padding:20px}table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{text-align:left;padding:4px 8px;border:1px solid #ccc;font-size:12px}
      th{background:#eee}.no-print{margin:20px 0}
      @media print{.no-print{display:none}}</style></head><body>
      <h1>Lista di Taglio - SimonCutter</h1>
      <p><strong>${result.totalPanels}</strong> Pannelli utilizzati | 
      <strong>${result.averageUsage}%</strong> Utilizzo medio</p>`;

    result.usedPanels.forEach((panel, i) => {
      const usedM2 = (panel.usedAreaMm2 / 1_000_000).toFixed(4);
      const wasteM2 = (panel.wasteAreaMm2 / 1_000_000).toFixed(4);
      h += `<h2>Pannello ${i + 1} - ${panel.stockPanel.width}×${panel.stockPanel.height} 
        (Utilizzo: ${panel.usagePercent}% | ${usedM2} m² | Spreco: ${panel.wastePercent}% | ${wasteM2} m²)</h2>
        <table><tr><th>Pezzo</th><th>Nome</th><th>X</th><th>Y</th><th>Larghezza</th><th>Altezza</th><th>Ruotato</th></tr>`;
      panel.pieces.forEach((p) => {
        h += `<tr><td>${p.label}</td><td>${p.name || "—"}</td><td>${p.x}</td><td>${p.y}</td><td>${p.width}</td><td>${p.height}</td><td>${p.rotated ? "Sì" : "No"}</td></tr>`;
      });
      h += "</table>";
    });

    if (result.unplacedPieces.length > 0) {
      h += "<h2 style='color:red'>Pezzi non allocati</h2><ul>";
      result.unplacedPieces.forEach((u) => {
        h += `<li>${u.piece.width}×${u.piece.height}${u.piece.name ? ` (${u.piece.name})` : ""} - ${u.remaining} pz</li>`;
      });
      h += "</ul>";
    }

    h += `<div class="no-print"><button onclick="window.print()">Stampa PDF</button></div></body></html>`;
    pw.document.write(h);
    pw.document.close();
  };

  // Stats calculations
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
        <div className="flex gap-2">
          <button
            onClick={exportPiecesCSV}
            className="text-xs px-3.5 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
          >
            CSV
          </button>
          <button
            onClick={openPDF}
            disabled={!result}
            className="text-xs px-3.5 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            PDF
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* Input grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Panels card */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold">
                Pannelli disponibili
              </h2>
              <div className="flex gap-2">
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
                  onChange={(e) =>
                    updatePanel(i, "width", parseInt(e.target.value))
                  }
                  className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                />
                <input
                  type="number"
                  value={p.height}
                  onChange={(e) =>
                    updatePanel(i, "height", parseInt(e.target.value))
                  }
                  className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                />
                <input
                  type="number"
                  value={p.qty}
                  onChange={(e) =>
                    updatePanel(i, "qty", parseInt(e.target.value))
                  }
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
                <button
                  onClick={addPiece}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-transparent text-foreground hover:border-primary hover:text-primary transition-all font-mono"
                >
                  + Aggiungi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[36px_minmax(60px,1fr)_1fr_1fr_60px_40px_32px] gap-2 text-[11px] text-muted-foreground px-1 mb-1">
              <span>#</span>
              <span>Nome</span>
              <span>Larghezza</span>
              <span>Altezza</span>
              <span>Qta</span>
              <span>Rot.</span>
              <span></span>
            </div>
            <div className="max-h-[400px] overflow-y-auto pr-1">
              {pieces.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[36px_minmax(60px,1fr)_1fr_1fr_60px_40px_32px] gap-2 items-center mb-1.5"
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
                    onChange={(e) =>
                      updatePiece(i, "width", parseInt(e.target.value))
                    }
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <input
                    type="number"
                    value={p.height}
                    onChange={(e) =>
                      updatePiece(i, "height", parseInt(e.target.value))
                    }
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <input
                    type="number"
                    value={p.qty}
                    onChange={(e) =>
                      updatePiece(i, "qty", parseInt(e.target.value))
                    }
                    className="bg-input border border-border rounded px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary w-full font-mono"
                  />
                  <button
                    onClick={() =>
                      updatePiece(i, "canRotate", !p.canRotate)
                    }
                    className={`w-9 h-8 flex items-center justify-center rounded border text-sm transition-all cursor-pointer ${
                      p.canRotate
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-transparent border-border text-muted-foreground"
                    }`}
                  >
                    ↻
                  </button>
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
            <div className="mt-3 flex justify-end gap-2">
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
              onChange={(e) =>
                setPricePerSqm(parseFloat(e.target.value) || 0)
              }
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
            EXECUTE
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
                <div className="text-xs text-muted-foreground mt-1">
                  Pannelli
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-[28px] font-bold text-primary">
                  {result.averageUsage}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Utilizzo medio
                </div>
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
                <div className="text-xs text-muted-foreground mt-1">
                  Spreco medio
                </div>
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
                <div className="text-xs text-muted-foreground mt-1">
                  Non allocati
                </div>
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
                    <li
                      key={i}
                      className="text-[13px] text-destructive mb-1"
                    >
                      {u.piece.width}×{u.piece.height}
                      {u.piece.name ? ` (${u.piece.name})` : ""} —{" "}
                      {u.remaining} pz
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
            {result.usedPanels.length > 1 && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={saveAll}
                  className="bg-primary text-primary-foreground border border-primary font-bold text-sm px-10 py-2.5 rounded tracking-[3px] uppercase hover:bg-primary-dim hover:border-primary-dim transition-all font-mono"
                >
                  💾 SALVA TUTTI I PANNELLI
                </button>
              </div>
            )}
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
