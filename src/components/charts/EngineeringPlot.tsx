import React, { useMemo, useRef, useState } from 'react';
import { Download, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { formatNumber } from '../../utils/format';

export interface TooltipRow {
  label: string;
  value: string;
}

export interface PlotPoint {
  x: number;
  y: number;
  tooltipTitle?: string;
  tooltipRows: TooltipRow[];
}

export interface PlotSeries {
  id: string;
  label: string;
  points: PlotPoint[];
  color: string;
  strokeWidth?: number;
  dashed?: boolean;
  areaFill?: string;
  interactive?: boolean;
}

export interface PlotMarker {
  id: string;
  x: number;
  y: number;
  shape: 'circle' | 'cross' | 'diamond' | 'square';
  color: string;
  label?: string;
  tooltipTitle?: string;
  tooltipRows: TooltipRow[];
}

export interface PlotVector {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label: string;
  dashed?: boolean;
  tooltipTitle?: string;
  tooltipRows: TooltipRow[];
}

export interface PlotCircle {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  dashed?: boolean;
  label?: string;
}

export interface PlotRegion {
  id: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  fill: string;
  label?: string;
}

export interface EngineeringPlotProps {
  title: string;
  subtitle?: string;
  xLabel: string;
  yLabel: string;
  xScale?: 'linear' | 'log';
  series: PlotSeries[];
  markers?: PlotMarker[];
  vectors?: PlotVector[];
  circles?: PlotCircle[];
  regions?: PlotRegion[];
  xBounds?: [number, number];
  yBounds?: [number, number];
  aspectEqual?: boolean;
  heightPx?: number;
  onExportCsv?: () => void;
}

interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function niceTicks(min: number, max: number, count = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [0];
  const span = max - min;
  const rawStep = span / Math.max(2, count);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step = mag;
  if (norm >= 5) step = 5 * mag;
  else if (norm >= 2) step = 2 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < 1e-10 ? 0 : v);
  }
  return ticks;
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const startExp = Math.floor(Math.log10(Math.max(min, 1e-6)));
  const endExp = Math.ceil(Math.log10(Math.max(max, min * 10)));
  for (let e = startExp; e <= endExp; e++) {
    const val = Math.pow(10, e);
    if (val >= min * 0.999 && val <= max * 1.001) ticks.push(val);
  }
  return ticks;
}

export const EngineeringPlot: React.FC<EngineeringPlotProps> = ({
  title,
  subtitle,
  xLabel,
  yLabel,
  xScale = 'linear',
  series,
  markers = [],
  vectors = [],
  circles = [],
  regions = [],
  xBounds,
  yBounds,
  aspectEqual = false,
  heightPx = 420,
  onExportCsv,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [hoverInfo, setHoverInfo] = useState<{
    svgX: number;
    svgY: number;
    dataX: number;
    dataY: number;
    snapSvgX: number;
    snapSvgY: number;
    title: string;
    rows: TooltipRow[];
    accentColor: string;
  } | null>(null);

  const width = 820;
  const height = heightPx;
  const pad = { top: 24, right: 28, bottom: 48, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const bounds: Bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const s of series) {
      for (const pt of s.points) {
        if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
          xs.push(pt.x);
          ys.push(pt.y);
        }
      }
    }
    for (const m of markers) {
      if (Number.isFinite(m.x) && Number.isFinite(m.y)) {
        xs.push(m.x);
        ys.push(m.y);
      }
    }
    for (const v of vectors) {
      xs.push(v.x1, v.x2);
      ys.push(v.y1, v.y2);
    }

    let xMin = xBounds ? xBounds[0] : xs.length ? Math.min(...xs) : -1;
    let xMax = xBounds ? xBounds[1] : xs.length ? Math.max(...xs) : 1;
    let yMin = yBounds ? yBounds[0] : ys.length ? Math.min(...ys) : -1;
    let yMax = yBounds ? yBounds[1] : ys.length ? Math.max(...ys) : 1;

    if (xScale === 'linear') {
      if (Math.abs(xMax - xMin) < 1e-6) {
        xMin -= 1;
        xMax += 1;
      } else if (!xBounds) {
        const dx = (xMax - xMin) * 0.1;
        xMin -= dx;
        xMax += dx;
      }
    }

    if (Math.abs(yMax - yMin) < 1e-6) {
      yMin -= 1;
      yMax += 1;
    } else if (!yBounds) {
      const dy = (yMax - yMin) * 0.12;
      yMin -= dy;
      yMax += dy;
    }

    if (aspectEqual && xScale === 'linear') {
      const xSpan = xMax - xMin;
      const ySpan = yMax - yMin;
      const plotRatio = plotW / plotH;
      const dataRatio = xSpan / ySpan;
      if (dataRatio < plotRatio) {
        const targetXSpan = ySpan * plotRatio;
        const cx = 0.5 * (xMin + xMax);
        xMin = cx - targetXSpan / 2;
        xMax = cx + targetXSpan / 2;
      } else {
        const targetYSpan = xSpan / plotRatio;
        const cy = 0.5 * (yMin + yMax);
        yMin = cy - targetYSpan / 2;
        yMax = cy + targetYSpan / 2;
      }
    }

    if (zoomFactor !== 1 && xScale === 'linear') {
      const cx = 0.5 * (xMin + xMax);
      const cy = 0.5 * (yMin + yMax);
      const hx = (0.5 * (xMax - xMin)) / zoomFactor;
      const hy = (0.5 * (yMax - yMin)) / zoomFactor;
      xMin = cx - hx;
      xMax = cx + hx;
      yMin = cy - hy;
      yMax = cy + hy;
    }

    return { xMin, xMax, yMin, yMax };
  }, [series, markers, vectors, xBounds, yBounds, aspectEqual, xScale, plotW, plotH, zoomFactor]);

  const toSvgX = (x: number): number => {
    if (xScale === 'log') {
      const lMin = Math.log10(Math.max(bounds.xMin, 1e-6));
      const lMax = Math.log10(Math.max(bounds.xMax, bounds.xMin * 10));
      const lx = Math.log10(Math.max(x, 1e-6));
      return pad.left + ((lx - lMin) / (lMax - lMin)) * plotW;
    }
    return pad.left + ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * plotW;
  };

  const toSvgY = (y: number): number => {
    return pad.top + ((bounds.yMax - y) / (bounds.yMax - bounds.yMin)) * plotH;
  };

  const fromSvgX = (sx: number): number => {
    const frac = (sx - pad.left) / plotW;
    if (xScale === 'log') {
      const lMin = Math.log10(Math.max(bounds.xMin, 1e-6));
      const lMax = Math.log10(Math.max(bounds.xMax, bounds.xMin * 10));
      return Math.pow(10, lMin + frac * (lMax - lMin));
    }
    return bounds.xMin + frac * (bounds.xMax - bounds.xMin);
  };

  const fromSvgY = (sy: number): number => {
    const frac = (sy - pad.top) / plotH;
    return bounds.yMax - frac * (bounds.yMax - bounds.yMin);
  };

  const xTicks = useMemo(
    () =>
      xScale === 'log'
        ? logTicks(bounds.xMin, bounds.xMax)
        : niceTicks(bounds.xMin, bounds.xMax, 7),
    [bounds.xMin, bounds.xMax, xScale]
  );

  const yTicks = useMemo(
    () => niceTicks(bounds.yMin, bounds.yMax, 6),
    [bounds.yMin, bounds.yMax]
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const svgY = ((e.clientY - rect.top) / rect.height) * height;

    if (
      svgX < pad.left ||
      svgX > width - pad.right ||
      svgY < pad.top ||
      svgY > height - pad.bottom
    ) {
      setHoverInfo(null);
      return;
    }

    const dataX = fromSvgX(svgX);
    const dataY = fromSvgY(svgY);

    // Priority 1: Check critical markers within 18px
    let bestDist = 18;
    let chosen: typeof hoverInfo = null;

    for (const m of markers) {
      const mx = toSvgX(m.x);
      const my = toSvgY(m.y);
      const d = Math.hypot(mx - svgX, my - svgY);
      if (d < bestDist) {
        bestDist = d;
        chosen = {
          svgX,
          svgY,
          dataX,
          dataY,
          snapSvgX: mx,
          snapSvgY: my,
          title: m.tooltipTitle || m.label || 'Marker',
          rows: m.tooltipRows,
          accentColor: m.color,
        };
      }
    }

    // Priority 2: Check vector endpoints within 20px
    if (!chosen) {
      let vecDist = 20;
      for (const v of vectors) {
        const vx = toSvgX(v.x2);
        const vy = toSvgY(v.y2);
        const d = Math.hypot(vx - svgX, vy - svgY);
        if (d < vecDist) {
          vecDist = d;
          chosen = {
            svgX,
            svgY,
            dataX,
            dataY,
            snapSvgX: vx,
            snapSvgY: vy,
            title: v.tooltipTitle || v.label,
            rows: v.tooltipRows,
            accentColor: v.color,
          };
        }
      }
    }

    // Priority 3: Snap to nearest interactive curve sample
    if (!chosen) {
      let curveBest = Number.POSITIVE_INFINITY;
      for (const s of series) {
        if (s.interactive === false) continue;
        for (const pt of s.points) {
          if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
          const px = toSvgX(pt.x);
          const py = toSvgY(pt.y);
          const d = Math.hypot(px - svgX, py - svgY);
          if (d < curveBest) {
            curveBest = d;
            chosen = {
              svgX,
              svgY,
              dataX,
              dataY,
              snapSvgX: px,
              snapSvgY: py,
              title: pt.tooltipTitle || s.label,
              rows: pt.tooltipRows,
              accentColor: s.color,
            };
          }
        }
      }
    }

    if (chosen) {
      setHoverInfo(chosen);
    } else {
      setHoverInfo({
        svgX,
        svgY,
        dataX,
        dataY,
        snapSvgX: svgX,
        snapSvgY: svgY,
        title: 'Cursor Coordinates',
        rows: [
          { label: xLabel, value: formatNumber(dataX, 3) },
          { label: yLabel, value: formatNumber(dataY, 3) },
        ],
        accentColor: '#2563EB',
      });
    }
  };

  const clipId = useMemo(
    () => `plot-clip-${title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
    [title]
  );

  // Zero axis pixel positions
  const xZeroPx = bounds.xMin <= 0 && bounds.xMax >= 0 && xScale === 'linear' ? toSvgX(0) : null;
  const yZeroPx = bounds.yMin <= 0 && bounds.yMax >= 0 ? toSvgY(0) : null;

  // Smart tooltip positioning inside plot container (%)
  const tooltipLeftPct = hoverInfo
    ? hoverInfo.snapSvgX > width * 0.62
      ? Math.max(4, ((hoverInfo.snapSvgX - 210) / width) * 100)
      : Math.min(72, ((hoverInfo.snapSvgX + 14) / width) * 100)
    : 0;
  const tooltipTopPct = hoverInfo
    ? hoverInfo.snapSvgY > height * 0.6
      ? Math.max(4, ((hoverInfo.snapSvgY - 115) / height) * 100)
      : Math.min(68, ((hoverInfo.snapSvgY + 12) / height) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F1522]">
      {/* Plot Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {subtitle && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {showGrid ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Grid
          </button>

          {xScale === 'linear' && (
            <>
              <button
                type="button"
                onClick={() => setZoomFactor((z) => Math.min(4, Number((z * 1.4).toFixed(2))))}
                className="inline-flex h-8 items-center rounded border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title="Zoom In"
              >
                +Zoom
              </button>
              <button
                type="button"
                onClick={() => setZoomFactor((z) => Math.max(0.5, Number((z / 1.4).toFixed(2))))}
                className="inline-flex h-8 items-center rounded border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title="Zoom Out"
              >
                −Zoom
              </button>
              {zoomFactor !== 1 && (
                <button
                  type="button"
                  onClick={() => setZoomFactor(1)}
                  className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3 w-3" />
                  1×
                </button>
              )}
            </>
          )}

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Interactive SVG Stage */}
      <div className="relative select-none p-2 sm:p-3">
        {/* Live Corner Coordinate HUD */}
        <div
          aria-live="polite"
          className="pointer-events-none absolute right-5 top-5 z-10 rounded border border-slate-200/90 bg-white/90 px-2.5 py-1 font-mono text-[11px] text-slate-700 tabular-nums backdrop-blur-xs dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-300"
        >
          {hoverInfo ? (
            <span>
              x={formatNumber(hoverInfo.dataX, 3)} · y={formatNumber(hoverInfo.dataY, 3)}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">
              Hover plot for fine-print readout
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverInfo(null)}
          className="block w-full cursor-crosshair touch-none"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.left} y={pad.top} width={plotW} height={plotH} />
            </clipPath>
            <marker
              id="phasor-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" />
            </marker>
          </defs>

          {/* Plot Area Backdrop */}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            className="fill-slate-50/70 stroke-slate-200 dark:fill-[#0B101B] dark:stroke-slate-800"
            strokeWidth={1}
          />

          <g clipPath={`url(#${clipId})`}>
            {/* Optional Background Regions (e.g. LHP/RHP, +/-2% Band) */}
            {regions.map((reg) => {
              const rx1 = toSvgX(reg.xMin);
              const rx2 = toSvgX(reg.xMax);
              const ry1 = toSvgY(reg.yMax);
              const ry2 = toSvgY(reg.yMin);
              const rw = Math.max(0, Math.abs(rx2 - rx1));
              const rh = Math.max(0, Math.abs(ry2 - ry1));
              return (
                <g key={reg.id}>
                  <rect
                    x={Math.min(rx1, rx2)}
                    y={Math.min(ry1, ry2)}
                    width={rw}
                    height={rh}
                    fill={reg.fill}
                  />
                  {reg.label && (
                    <text
                      x={Math.min(rx1, rx2) + 8}
                      y={Math.min(ry1, ry2) + 16}
                      className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                    >
                      {reg.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Gridlines */}
            {showGrid &&
              xTicks.map((t) => {
                const sx = toSvgX(t);
                return (
                  <line
                    key={`gx-${t}`}
                    x1={sx}
                    y1={pad.top}
                    x2={sx}
                    y2={height - pad.bottom}
                    className="stroke-slate-200/80 dark:stroke-slate-800/80"
                    strokeWidth={1}
                  />
                );
              })}

            {showGrid &&
              yTicks.map((t) => {
                const sy = toSvgY(t);
                return (
                  <line
                    key={`gy-${t}`}
                    x1={pad.left}
                    y1={sy}
                    x2={width - pad.right}
                    y2={sy}
                    className="stroke-slate-200/80 dark:stroke-slate-800/80"
                    strokeWidth={1}
                  />
                );
              })}

            {/* Principal Zero Axes */}
            {xZeroPx !== null && (
              <line
                x1={xZeroPx}
                y1={pad.top}
                x2={xZeroPx}
                y2={height - pad.bottom}
                className="stroke-slate-400/80 dark:stroke-slate-600"
                strokeWidth={1.25}
              />
            )}
            {yZeroPx !== null && (
              <line
                x1={pad.left}
                y1={yZeroPx}
                x2={width - pad.right}
                y2={yZeroPx}
                className="stroke-slate-400/80 dark:stroke-slate-600"
                strokeWidth={1.25}
              />
            )}

            {/* Circles / Capability Arcs */}
            {circles.map((cItem) => {
              const scx = toSvgX(cItem.cx);
              const scy = toSvgY(cItem.cy);
              const rx = Math.abs(toSvgX(cItem.cx + cItem.r) - scx);
              const ry = Math.abs(toSvgY(cItem.cy + cItem.r) - scy);
              return (
                <g key={cItem.id}>
                  <ellipse
                    cx={scx}
                    cy={scy}
                    rx={rx}
                    ry={ry}
                    fill="none"
                    stroke={cItem.color}
                    strokeWidth={1.25}
                    strokeDasharray={cItem.dashed ? '4 4' : undefined}
                  />
                  {cItem.label && (
                    <text
                      x={scx + rx * 0.72}
                      y={scy - ry * 0.72}
                      fill={cItem.color}
                      className="font-mono text-[10px]"
                    >
                      {cItem.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Curve Series */}
            {series.map((s) => {
              if (s.points.length === 0) return null;
              const dParts: string[] = [];
              let started = false;
              for (const pt of s.points) {
                if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
                  started = false;
                  continue;
                }
                const sx = toSvgX(pt.x);
                const sy = toSvgY(pt.y);
                dParts.push(`${started ? 'L' : 'M'} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
                started = true;
              }
              const pathD = dParts.join(' ');
              const baselineY = Math.min(height - pad.bottom, Math.max(pad.top, toSvgY(0)));
              const areaD =
                s.areaFill && s.points.length > 1
                  ? `${pathD} L ${toSvgX(s.points[s.points.length - 1].x).toFixed(2)} ${baselineY.toFixed(2)} L ${toSvgX(s.points[0].x).toFixed(2)} ${baselineY.toFixed(2)} Z`
                  : null;

              return (
                <g key={s.id}>
                  {areaD && <path d={areaD} fill={s.areaFill} />}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 2.2}
                    strokeDasharray={s.dashed ? '6 4' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Phasor / Operating Vectors */}
            {vectors.map((v) => {
              const x1 = toSvgX(v.x1);
              const y1 = toSvgY(v.y1);
              const x2 = toSvgX(v.x2);
              const y2 = toSvgY(v.y2);
              return (
                <g key={v.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={v.color}
                    strokeWidth={2.4}
                    strokeDasharray={v.dashed ? '5 4' : undefined}
                    markerEnd="url(#phasor-arrow)"
                  />
                  <text
                    x={x2 + (x2 >= x1 ? 6 : -6)}
                    y={y2 + (y2 <= y1 ? -6 : 12)}
                    textAnchor={x2 >= x1 ? 'start' : 'end'}
                    fill={v.color}
                    className="font-mono text-[11px] font-semibold"
                  >
                    {v.label}
                  </text>
                </g>
              );
            })}

            {/* Critical Markers */}
            {markers.map((m) => {
              const mx = toSvgX(m.x);
              const my = toSvgY(m.y);
              return (
                <g key={m.id}>
                  {m.shape === 'circle' && (
                    <circle
                      cx={mx}
                      cy={my}
                      r={5}
                      fill={m.color}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  )}
                  {m.shape === 'square' && (
                    <rect
                      x={mx - 4.5}
                      y={my - 4.5}
                      width={9}
                      height={9}
                      fill={m.color}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  )}
                  {m.shape === 'diamond' && (
                    <polygon
                      points={`${mx},${my - 6} ${mx + 6},${my} ${mx},${my + 6} ${mx - 6},${my}`}
                      fill={m.color}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  )}
                  {m.shape === 'cross' && (
                    <g stroke={m.color} strokeWidth={2.2} strokeLinecap="round">
                      <line x1={mx - 5} y1={my - 5} x2={mx + 5} y2={my + 5} />
                      <line x1={mx - 5} y1={my + 5} x2={mx + 5} y2={my - 5} />
                    </g>
                  )}
                  {m.label && (
                    <text
                      x={mx + 8}
                      y={my - 7}
                      fill={m.color}
                      className="font-mono text-[10px] font-medium"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Active Crosshair Snap Overlay */}
            {hoverInfo && (
              <g pointerEvents="none">
                <line
                  x1={hoverInfo.snapSvgX}
                  y1={pad.top}
                  x2={hoverInfo.snapSvgX}
                  y2={height - pad.bottom}
                  className="stroke-slate-500/70 dark:stroke-slate-400/70"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <line
                  x1={pad.left}
                  y1={hoverInfo.snapSvgY}
                  x2={width - pad.right}
                  y2={hoverInfo.snapSvgY}
                  className="stroke-slate-500/70 dark:stroke-slate-400/70"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={hoverInfo.snapSvgX}
                  cy={hoverInfo.snapSvgY}
                  r={6}
                  fill="none"
                  stroke={hoverInfo.accentColor}
                  strokeWidth={2}
                />
                <circle
                  cx={hoverInfo.snapSvgX}
                  cy={hoverInfo.snapSvgY}
                  r={2.5}
                  fill={hoverInfo.accentColor}
                />
              </g>
            )}
          </g>

          {/* X Axis Ticks & Label */}
          {xTicks.map((t) => {
            const sx = toSvgX(t);
            if (sx < pad.left - 2 || sx > width - pad.right + 2) return null;
            return (
              <g key={`xt-${t}`}>
                <line
                  x1={sx}
                  y1={height - pad.bottom}
                  x2={sx}
                  y2={height - pad.bottom + 5}
                  className="stroke-slate-400 dark:stroke-slate-600"
                />
                <text
                  x={sx}
                  y={height - pad.bottom + 18}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[10px] tabular-nums dark:fill-slate-400"
                >
                  {formatNumber(t, xScale === 'log' && t < 1 ? 2 : Math.abs(t) >= 100 ? 0 : 1)}
                </text>
              </g>
            );
          })}
          <text
            x={pad.left + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-600 text-[11px] font-medium dark:fill-slate-300"
          >
            {xLabel}
          </text>

          {/* Y Axis Ticks & Label */}
          {yTicks.map((t) => {
            const sy = toSvgY(t);
            if (sy < pad.top - 2 || sy > height - pad.bottom + 2) return null;
            return (
              <g key={`yt-${t}`}>
                <line
                  x1={pad.left - 5}
                  y1={sy}
                  x2={pad.left}
                  y2={sy}
                  className="stroke-slate-400 dark:stroke-slate-600"
                />
                <text
                  x={pad.left - 9}
                  y={sy + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px] tabular-nums dark:fill-slate-400"
                >
                  {formatNumber(t, Math.abs(t) >= 100 ? 0 : 1)}
                </text>
              </g>
            );
          })}
          <text
            x={16}
            y={pad.top + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${pad.top + plotH / 2})`}
            className="fill-slate-600 text-[11px] font-medium dark:fill-slate-300"
          >
            {yLabel}
          </text>
        </svg>

        {/* Fine-Print Floating Tooltip */}
        {hoverInfo && (
          <div
            data-testid="chart-tooltip"
            style={{
              left: `${tooltipLeftPct}%`,
              top: `${tooltipTopPct}%`,
            }}
            className="pointer-events-none absolute z-20 min-w-[185px] max-w-[260px] rounded-md border border-slate-300 bg-white/95 px-3 py-2 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95"
          >
            <div className="mb-1 flex items-center gap-1.5 border-b border-slate-200 pb-1 dark:border-slate-800">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-xs"
                style={{ backgroundColor: hoverInfo.accentColor }}
              />
              <span className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                {hoverInfo.title}
              </span>
            </div>
            <dl className="space-y-0.5 font-mono text-[11px] tabular-nums">
              {hoverInfo.rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{r.label}</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Compact Legend Strip */}
      {series.some((s) => s.label) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
          {series
            .filter((s) => s.label)
            .map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <svg width="20" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="20"
                    y2="3"
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeDasharray={s.dashed ? '4 3' : undefined}
                  />
                </svg>
                <span>{s.label}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
