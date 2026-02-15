// ============================================================
// MaxRects Bin Packing Algorithm - Best Short Side Fit
// ============================================================

export interface StockPanel {
  width: number;
  height: number;
  qty: number;
}

export interface CutPiece {
  width: number;
  height: number;
  qty: number;
  canRotate: boolean;
  name: string;
}

export interface PlacedPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
  name: string;
  originalWidth: number;
  originalHeight: number;
}

export interface UsedPanel {
  stockPanel: { width: number; height: number };
  pieces: PlacedPiece[];
  usagePercent: string;
  wastePercent: string;
  usedAreaMm2: number;
  wasteAreaMm2: number;
}

export interface UnplacedInfo {
  piece: { width: number; height: number; name: string };
  remaining: number;
}

export interface CutResult {
  usedPanels: UsedPanel[];
  unplacedPieces: UnplacedInfo[];
  totalPanels: number;
  averageUsage: string;
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersects(a: FreeRect, b: FreeRect): boolean {
  return !(
    a.x >= b.x + b.width ||
    a.x + a.width <= b.x ||
    a.y >= b.y + b.height ||
    a.y + a.height <= b.y
  );
}

function isContainedIn(a: FreeRect, b: FreeRect): boolean {
  return (
    a.x >= b.x &&
    a.y >= b.y &&
    a.x + a.width <= b.x + b.width &&
    a.y + a.height <= b.y + b.height
  );
}

function pruneContained(rects: FreeRect[]): FreeRect[] {
  const result: FreeRect[] = [];
  for (let i = 0; i < rects.length; i++) {
    let dominated = false;
    for (let j = 0; j < rects.length; j++) {
      if (i !== j && isContainedIn(rects[i], rects[j])) {
        dominated = true;
        break;
      }
    }
    if (!dominated) result.push(rects[i]);
  }
  return result;
}

function findBestPosition(
  freeRects: FreeRect[],
  width: number,
  height: number,
  canRotate: boolean
) {
  let bestScore1 = Infinity;
  let bestScore2 = Infinity;
  let bestRect: FreeRect | null = null;
  let bestRotated = false;

  for (const fr of freeRects) {
    if (width <= fr.width && height <= fr.height) {
      const leftoverH = Math.abs(fr.width - width);
      const leftoverV = Math.abs(fr.height - height);
      const shortSide = Math.min(leftoverH, leftoverV);
      const longSide = Math.max(leftoverH, leftoverV);
      if (
        shortSide < bestScore1 ||
        (shortSide === bestScore1 && longSide < bestScore2)
      ) {
        bestRect = { x: fr.x, y: fr.y, width, height };
        bestScore1 = shortSide;
        bestScore2 = longSide;
        bestRotated = false;
      }
    }
    if (canRotate && height <= fr.width && width <= fr.height) {
      const leftoverH = Math.abs(fr.width - height);
      const leftoverV = Math.abs(fr.height - width);
      const shortSide = Math.min(leftoverH, leftoverV);
      const longSide = Math.max(leftoverH, leftoverV);
      if (
        shortSide < bestScore1 ||
        (shortSide === bestScore1 && longSide < bestScore2)
      ) {
        bestRect = { x: fr.x, y: fr.y, width: height, height: width };
        bestScore1 = shortSide;
        bestScore2 = longSide;
        bestRotated = true;
      }
    }
  }

  return { rect: bestRect, rotated: bestRotated };
}

function splitFreeRects(freeRects: FreeRect[], placed: FreeRect): FreeRect[] {
  const newFree: FreeRect[] = [];

  for (const fr of freeRects) {
    if (!intersects(fr, placed)) {
      newFree.push(fr);
      continue;
    }
    if (placed.x > fr.x) {
      newFree.push({
        x: fr.x,
        y: fr.y,
        width: placed.x - fr.x,
        height: fr.height,
      });
    }
    if (placed.x + placed.width < fr.x + fr.width) {
      newFree.push({
        x: placed.x + placed.width,
        y: fr.y,
        width: fr.x + fr.width - (placed.x + placed.width),
        height: fr.height,
      });
    }
    if (placed.y > fr.y) {
      newFree.push({
        x: fr.x,
        y: fr.y,
        width: fr.width,
        height: placed.y - fr.y,
      });
    }
    if (placed.y + placed.height < fr.y + fr.height) {
      newFree.push({
        x: fr.x,
        y: placed.y + placed.height,
        width: fr.width,
        height: fr.y + fr.height - (placed.y + placed.height),
      });
    }
  }

  return pruneContained(newFree);
}

interface InternalPanel {
  stockPanel: { width: number; height: number };
  pieces: PlacedPiece[];
  freeRects: FreeRect[];
}

export function maxRectsPack(
  stockPanels: StockPanel[],
  pieces: CutPiece[]
): CutResult {
  const allPieces: {
    width: number;
    height: number;
    canRotate: boolean;
    label: string;
    name: string;
  }[] = [];

  pieces.forEach((p, idx) => {
    for (let i = 0; i < p.qty; i++) {
      allPieces.push({
        width: p.width,
        height: p.height,
        canRotate: p.canRotate,
        label: `P${idx + 1}`,
        name: p.name,
      });
    }
  });

  allPieces.sort((a, b) => b.width * b.height - a.width * a.height);

  const availableStock: { width: number; height: number }[] = [];
  stockPanels.forEach((s) => {
    for (let i = 0; i < s.qty; i++) {
      availableStock.push({ width: s.width, height: s.height });
    }
  });

  const usedPanels: InternalPanel[] = [];
  const unplacedMap = new Map<string, UnplacedInfo>();

  for (const piece of allPieces) {
    let placed = false;

    for (const panel of usedPanels) {
      const result = findBestPosition(
        panel.freeRects,
        piece.width,
        piece.height,
        piece.canRotate
      );
      if (result.rect) {
        panel.pieces.push({
          x: result.rect.x,
          y: result.rect.y,
          width: result.rect.width,
          height: result.rect.height,
          rotated: result.rotated,
          label: piece.label,
          name: piece.name,
          originalWidth: piece.width,
          originalHeight: piece.height,
        });
        panel.freeRects = splitFreeRects(panel.freeRects, result.rect);
        placed = true;
        break;
      }
    }

    if (!placed) {
      for (let si = 0; si < availableStock.length; si++) {
        const stock = availableStock[si];
        const freeRects: FreeRect[] = [
          { x: 0, y: 0, width: stock.width, height: stock.height },
        ];
        const result = findBestPosition(
          freeRects,
          piece.width,
          piece.height,
          piece.canRotate
        );
        if (result.rect) {
          usedPanels.push({
            stockPanel: { width: stock.width, height: stock.height },
            pieces: [
              {
                x: result.rect.x,
                y: result.rect.y,
                width: result.rect.width,
                height: result.rect.height,
                rotated: result.rotated,
                label: piece.label,
                name: piece.name,
                originalWidth: piece.width,
                originalHeight: piece.height,
              },
            ],
            freeRects: splitFreeRects(freeRects, result.rect),
          });
          availableStock.splice(si, 1);
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      const key = `${piece.width}x${piece.height}`;
      const existing = unplacedMap.get(key);
      if (existing) {
        existing.remaining++;
      } else {
        unplacedMap.set(key, {
          piece: {
            width: piece.width,
            height: piece.height,
            name: piece.name,
          },
          remaining: 1,
        });
      }
    }
  }

  const resultPanels: UsedPanel[] = usedPanels.map((panel) => {
    const totalArea = panel.stockPanel.width * panel.stockPanel.height;
    const usedArea = panel.pieces.reduce(
      (sum, p) => sum + p.width * p.height,
      0
    );
    return {
      stockPanel: panel.stockPanel,
      pieces: panel.pieces,
      usagePercent: ((usedArea / totalArea) * 100).toFixed(1),
      wastePercent: (((totalArea - usedArea) / totalArea) * 100).toFixed(1),
      usedAreaMm2: usedArea,
      wasteAreaMm2: totalArea - usedArea,
    };
  });

  const avgUsage =
    resultPanels.length > 0
      ? (
          resultPanels.reduce((s, p) => s + parseFloat(p.usagePercent), 0) /
          resultPanels.length
        ).toFixed(1)
      : "0";

  return {
    usedPanels: resultPanels,
    unplacedPieces: Array.from(unplacedMap.values()),
    totalPanels: resultPanels.length,
    averageUsage: avgUsage,
  };
}
