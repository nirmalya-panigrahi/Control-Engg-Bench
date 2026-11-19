import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ROUTH_PRESETS } from '../../data/instruments';
import { cFormat } from '../../math/complex';
import { computeRootLocus, computeRouthHurwitz } from '../../math/controlSPlane';
import type { Complex, MetricReadout } from '../../types/bench';
import { downloadCsv, formatNumber } from '../../utils/format';
import { EngineeringPlot, type PlotMarker, type PlotSeries } from '../charts/EngineeringPlot';
import { ComplexListEditor } from '../ui/ComplexListEditor';
import { DataTable } from '../ui/DataTable';
import { ErrorBanner } from '../ui/ErrorBanner';
import { MetricsGrid } from '../ui/MetricsGrid';
import { NumericField } from '../ui/NumericField';

interface SPlaneControlBenchProps {
  mode: 'root-locus' | 'routh-hurwitz';
}

const BRANCH_COLORS = ['#2563EB', '#0D9488', '#D97706', '#7C3AED', '#DB2777', '#059669'];

export const SPlaneControlBench: React.FC<SPlaneControlBenchProps> = ({ mode }) => {
  // Root Locus state
  const [poles, setPoles] = useState<Complex[]>([
    { re: 0, im: 0 },
    { re: -2, im: 0 },
    { re: -4, im: 0 },
  ]);
  const [zeros, setZeros] = useState<Complex[]>([]);
  const [gainK, setGainK] = useState<number>(12);
  const [kSweepMax, setKSweepMax] = useState<number>(80);

  // Routh-Hurwitz polynomial coefficients [a_n, ..., a_0]
  const [coeffs, setCoeffs] = useState<number[]>([1, 6, 11, 6, 2]);

  const rootLocusRes = useMemo(
    () => (mode === 'root-locus' ? computeRootLocus(poles, zeros, gainK, kSweepMax) : null),
    [mode, poles, zeros, gainK, kSweepMax]
  );

  const routhRes = useMemo(
    () => (mode === 'routh-hurwitz' ? computeRouthHurwitz(coeffs) : null),
    [mode, coeffs]
  );

  if (mode === 'root-locus' && rootLocusRes) {
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <NumericField
          id="rl-gain"
          label="Variable Gain Slider (K)"
          value={gainK}
          onChange={setGainK}
          min={0}
          step={0.5}
          slider
          sliderMin={0}
          sliderMax={kSweepMax}
          helperText="Drag slider to track active closed-loop poles along the locus."
        />

        <NumericField
          id="rl-ksweep"
          label="Sweep Upper Bound (K_max)"
          value={kSweepMax}
          onChange={setKSweepMax}
          min={5}
          step={10}
        />

        <ComplexListEditor
          title="Open-Loop Poles"
          items={poles}
          onChange={setPoles}
          minItems={1}
          symbolPrefix="p"
        />

        <ComplexListEditor
          title="Open-Loop Zeros"
          items={zeros}
          onChange={setZeros}
          minItems={0}
          symbolPrefix="z"
        />
      </aside>
    );

    if (!rootLocusRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={rootLocusRes.error} />
          </div>
        </div>
      );
    }

    const d = rootLocusRes.data;
    const series: PlotSeries[] = d.branches.map((br, idx) => ({
      id: `branch-${idx}`,
      label: `Branch ${idx + 1}`,
      color: BRANCH_COLORS[idx % BRANCH_COLORS.length],
      strokeWidth: 2.2,
      points: br.map((pt) => ({
        x: pt.re,
        y: pt.im,
        tooltipTitle: `Branch ${idx + 1} · K = ${formatNumber(pt.k, 2)}`,
        tooltipRows: [
          { label: 'Real (σ)', value: formatNumber(pt.re, 4) },
          { label: 'Imag (jω)', value: formatNumber(pt.im, 4) },
          { label: 'Damping ζ', value: Math.hypot(pt.re, pt.im) > 1e-6 ? formatNumber(-pt.re / Math.hypot(pt.re, pt.im), 3) : '—' },
        ],
      })),
    }));

    const markers: PlotMarker[] = [
      ...d.openLoopPoles.map((p, i) => ({
        id: `olp-${i}`,
        x: p.re,
        y: p.im,
        shape: 'cross' as const,
        color: '#475569',
        tooltipTitle: `Open-Loop Pole p${i + 1}`,
        tooltipRows: [{ label: 'Location', value: cFormat(p, 3) }],
      })),
      ...d.openLoopZeros.map((z, i) => ({
        id: `olz-${i}`,
        x: z.re,
        y: z.im,
        shape: 'circle' as const,
        color: '#0D9488',
        tooltipTitle: `Open-Loop Zero z${i + 1}`,
        tooltipRows: [{ label: 'Location', value: cFormat(z, 3) }],
      })),
      ...d.activePoles.map((p, i) => ({
        id: `clp-${i}`,
        x: p.re,
        y: p.im,
        shape: 'square' as const,
        color: p.re > 1e-5 ? '#DC2626' : '#2563EB',
        label: `s${i + 1}`,
        tooltipTitle: `Closed-Loop Pole s${i + 1} (K=${formatNumber(gainK, 2)})`,
        tooltipRows: [
          { label: 'Pole s', value: cFormat(p, 4) },
          { label: 'ωn', value: `${formatNumber(Math.hypot(p.re, p.im), 3)} rad/s` },
          { label: 'ζ', value: Math.hypot(p.re, p.im) > 1e-6 ? formatNumber(-p.re / Math.hypot(p.re, p.im), 3) : '—' },
        ],
      })),
      ...d.breakawayPoints.map((bx, i) => ({
        id: `brk-${i}`,
        x: bx,
        y: 0,
        shape: 'diamond' as const,
        color: '#D97706',
        tooltipTitle: 'Breakaway / Break-in Point',
        tooltipRows: [{ label: 'Real Axis σ', value: formatNumber(bx, 4) }],
      })),
    ];

    const allStable = d.activePoles.every((p) => p.re <= 1e-6);
    const metrics: MetricReadout[] = [
      {
        label: 'Closed-Loop Status',
        value: allStable ? 'Stable' : 'Unstable',
        status: allStable ? 'nominal' : 'critical',
        statusText: `At K = ${formatNumber(gainK, 2)}`,
      },
      {
        label: 'Instability Gain (K_max)',
        value: d.kMax !== null ? formatNumber(d.kMax, 3) : '∞',
        sublabel:
          d.oscillationFreqRad !== null
            ? `ω_osc = ${formatNumber(d.oscillationFreqRad, 3)} rad/s`
            : 'Always stable for K ≥ 0',
      },
      {
        label: 'Breakaway Points',
        value: d.breakawayPoints.length > 0 ? d.breakawayPoints.map((b) => formatNumber(b, 2)).join(', ') : 'None',
        sublabel: 'Real-axis σ',
      },
      {
        label: 'Asymptote Centroid',
        value: d.asymptoteCentroid !== null ? formatNumber(d.asymptoteCentroid, 3) : '—',
        sublabel:
          d.asymptoteAnglesDeg.length > 0
            ? `Angles: ${d.asymptoteAnglesDeg.map((a) => `${formatNumber(a, 0)}°`).join(', ')}`
            : 'Relative degree 0',
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Root Locus s-Plane Trajectory"
            subtitle="Closed-loop pole paths as gain K increases from 0; blue squares indicate poles at active K"
            xLabel="Real Axis σ (s⁻¹)"
            yLabel="Imaginary Axis jω (rad/s)"
            aspectEqual
            series={series}
            markers={markers}
            regions={[
              {
                id: 'lhp',
                xMin: -100,
                xMax: 0,
                yMin: -100,
                yMax: 100,
                fill: 'rgba(16, 185, 129, 0.04)',
              },
              {
                id: 'rhp',
                xMin: 0,
                xMax: 100,
                yMin: -100,
                yMax: 100,
                fill: 'rgba(244, 63, 94, 0.05)',
              },
            ]}
            onExportCsv={() =>
              downloadCsv(
                'root_locus_active_poles.csv',
                ['Pole_Index', 'Gain_K', 'Real', 'Imag'],
                d.activePoles.map((p, idx) => [idx + 1, gainK, p.re, p.im])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
          <DataTable
            caption={`Active Closed-Loop Poles at K = ${formatNumber(gainK, 2)}`}
            headers={['Pole', 'Re (σ)', 'Im (jω)', 'ωn (rad/s)', 'Damping ζ']}
            rows={d.activePoles.map((p, i) => {
              const wn = Math.hypot(p.re, p.im);
              return [
                `s${i + 1}`,
                formatNumber(p.re, 4),
                formatNumber(p.im, 4),
                formatNumber(wn, 3),
                wn > 1e-6 ? formatNumber(-p.re / wn, 3) : '—',
              ];
            })}
          />
        </div>
      </div>
    );
  }

  // Render Routh-Hurwitz
  if (mode === 'routh-hurwitz' && routhRes) {
    const degree = coeffs.length - 1;
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <div>
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Polynomial Presets
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ROUTH_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setCoeffs([...p.coeffs])}
                className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Coefficients (Degree {degree})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={coeffs.length >= 9}
              onClick={() => setCoeffs([1, ...coeffs])}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus className="h-3 w-3" />
              Order
            </button>
            <button
              type="button"
              disabled={coeffs.length <= 2}
              onClick={() => setCoeffs(coeffs.slice(1))}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Trash2 className="h-3 w-3" />
              Order
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {coeffs.map((val, idx) => {
            const pow = degree - idx;
            return (
              <div key={`coeff-${pow}`} className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {pow === 0 ? 's⁰' : pow === 1 ? 's¹' : `s^${pow}`}
                </span>
                <input
                  type="number"
                  step="any"
                  aria-label={`Coefficient s^${pow}`}
                  value={Number.isFinite(val) ? val : ''}
                  onChange={(e) => {
                    const parsed = e.target.value === '' ? Number.NaN : Number(e.target.value);
                    setCoeffs(coeffs.map((c, i) => (i === idx ? parsed : c)));
                  }}
                  className="h-9 w-full min-w-0 rounded border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400"
                />
              </div>
            );
          })}
        </div>
      </aside>
    );

    if (!routhRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={routhRes.error} />
          </div>
        </div>
      );
    }

    const d = routhRes.data;
    const maxAbsCoord = Math.max(
      2,
      ...d.roots.map((r) => Math.max(Math.abs(r.re), Math.abs(r.im)))
    ) * 1.25;

    const markers: PlotMarker[] = d.roots.map((r, i) => {
      const isRhp = r.re > 1e-5;
      const isJw = Math.abs(r.re) <= 1e-5;
      return {
        id: `routh-root-${i}`,
        x: r.re,
        y: r.im,
        shape: 'cross',
        color: isRhp ? '#DC2626' : isJw ? '#D97706' : '#059669',
        label: `r${i + 1}`,
        tooltipTitle: `Root r${i + 1} (${isRhp ? 'RHP Unstable' : isJw ? 'jω Marginal' : 'LHP Stable'})`,
        tooltipRows: [
          { label: 's', value: cFormat(r, 4) },
          { label: 'Re(s)', value: formatNumber(r.re, 4) },
          { label: 'Im(s)', value: formatNumber(r.im, 4) },
        ],
      };
    });

    const metrics: MetricReadout[] = [
      {
        label: 'System Stability',
        value: d.isStable ? 'Stable' : d.isMarginallyStable ? 'Marginal' : 'Unstable',
        status: d.isStable ? 'nominal' : d.isMarginallyStable ? 'warning' : 'critical',
        statusText: d.isStable
          ? 'All roots in LHP'
          : d.isMarginallyStable
            ? 'Sustained oscillation on jω'
            : `${d.rhpRootsCount} unstable RHP root(s)`,
      },
      {
        label: 'RHP Roots (Unstable)',
        value: String(d.rhpRootsCount),
        sublabel: 'Re(s) > 0',
      },
      {
        label: 'LHP Roots (Stable)',
        value: String(d.lhpRootsCount),
        sublabel: 'Re(s) < 0',
      },
      {
        label: 'Marginal Oscillation ω',
        value: d.marginalFreqRad !== null ? formatNumber(d.marginalFreqRad, 3) : '—',
        unit: d.marginalFreqRad !== null ? 'rad/s' : undefined,
        sublabel: `${d.jwRootsCount} root(s) on jω-axis`,
      },
    ];

    const colHeaders = ['Row', ...Array.from({ length: d.routhTable[0]?.values.length ?? 1 }, (_, i) => `c${i + 1}`), 'Notes'];
    const tableRows = d.routhTable.map((row) => [
      `s^${row.power}`,
      ...row.values.map((v) => formatNumber(v, 3)),
      row.fromAuxiliary ? 'Auxiliary dA/ds' : row.hasEpsilonSub ? 'ε-substitution' : '—',
    ]);

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Routh–Hurwitz s-Plane Root Map"
            subtitle="Left-half plane (stable) vs right-half plane (unstable) characteristic roots"
            xLabel="Real Axis σ"
            yLabel="Imaginary Axis jω"
            aspectEqual
            xBounds={[-maxAbsCoord, maxAbsCoord]}
            yBounds={[-maxAbsCoord, maxAbsCoord]}
            series={[]}
            markers={markers}
            regions={[
              {
                id: 'lhp-region',
                xMin: -maxAbsCoord * 2,
                xMax: 0,
                yMin: -maxAbsCoord * 2,
                yMax: maxAbsCoord * 2,
                fill: 'rgba(16, 185, 129, 0.07)',
                label: 'LHP (Stable)',
              },
              {
                id: 'rhp-region',
                xMin: 0,
                xMax: maxAbsCoord * 2,
                yMin: -maxAbsCoord * 2,
                yMax: maxAbsCoord * 2,
                fill: 'rgba(244, 63, 94, 0.08)',
                label: 'RHP (Unstable)',
              },
            ]}
            onExportCsv={() =>
              downloadCsv(
                'routh_roots.csv',
                ['Root_Index', 'Real', 'Imag', 'Region'],
                d.roots.map((r, idx) => [
                  idx + 1,
                  r.re,
                  r.im,
                  r.re > 1e-5 ? 'RHP' : Math.abs(r.re) <= 1e-5 ? 'jω' : 'LHP',
                ])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
          <DataTable caption="Routh Stability Array" headers={colHeaders} rows={tableRows} />
        </div>
      </div>
    );
  }

  return null;
};
