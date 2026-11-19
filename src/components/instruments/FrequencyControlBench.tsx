import React, { useMemo, useState } from 'react';
import { TF_PRESETS } from '../../data/instruments';
import { computeBode, computeNichols, computeNyquist } from '../../math/controlFrequency';
import type { Complex, MetricReadout } from '../../types/bench';
import { downloadCsv, formatNumber } from '../../utils/format';
import { EngineeringPlot, type PlotMarker, type PlotSeries } from '../charts/EngineeringPlot';
import { ComplexListEditor } from '../ui/ComplexListEditor';
import { DataTable } from '../ui/DataTable';
import { ErrorBanner } from '../ui/ErrorBanner';
import { MetricsGrid } from '../ui/MetricsGrid';
import { NumericField } from '../ui/NumericField';

interface FrequencyControlBenchProps {
  mode: 'nyquist' | 'bode' | 'nichols';
}

export const FrequencyControlBench: React.FC<FrequencyControlBenchProps> = ({ mode }) => {
  const [gain, setGain] = useState<number>(8);
  const [poles, setPoles] = useState<Complex[]>([
    { re: 0, im: 0 },
    { re: -2, im: 0 },
    { re: -5, im: 0 },
  ]);
  const [zeros, setZeros] = useState<Complex[]>([]);
  const [wMin, setWMin] = useState<number>(0.05);
  const [wMax, setWMax] = useState<number>(100);
  const [timeDelay, setTimeDelay] = useState<number>(0);
  const [compensatorEnabled, setCompensatorEnabled] = useState<boolean>(false);
  const [compGain, setCompGain] = useState<number>(1);
  const [compTauZ, setCompTauZ] = useState<number>(0.4);
  const [compTauP, setCompTauP] = useState<number>(0.1);

  const applyPreset = (idx: number) => {
    const p = TF_PRESETS[idx];
    if (!p) return;
    setGain(p.gain);
    setPoles(p.poles.map((x) => ({ ...x })));
    setZeros(p.zeros.map((x) => ({ ...x })));
    setTimeDelay(p.timeDelay);
  };

  const freqParams = useMemo(
    () => ({
      zeros,
      poles,
      gain,
      wMin,
      wMax,
      timeDelay: mode === 'bode' || mode === 'nyquist' ? timeDelay : 0,
      compensatorEnabled: mode === 'bode' ? compensatorEnabled : false,
      compGain,
      compTauZ,
      compTauP,
    }),
    [zeros, poles, gain, wMin, wMax, timeDelay, compensatorEnabled, compGain, compTauZ, compTauP, mode]
  );

  const nyquistRes = useMemo(
    () => (mode === 'nyquist' ? computeNyquist(freqParams) : null),
    [mode, freqParams]
  );
  const bodeRes = useMemo(
    () => (mode === 'bode' ? computeBode(freqParams) : null),
    [mode, freqParams]
  );
  const nicholsRes = useMemo(
    () => (mode === 'nichols' ? computeNichols(freqParams) : null),
    [mode, freqParams]
  );

  const controlsPanel = (
    <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
      <div>
        <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Plant Preset
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TF_PRESETS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(i)}
              className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <NumericField
        id="tf-gain"
        label="System Gain (K)"
        value={gain}
        onChange={setGain}
        min={0.01}
        step={0.5}
        slider
        sliderMin={0.1}
        sliderMax={60}
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

      <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <NumericField
          id="w-min"
          label="ω min"
          value={wMin}
          onChange={setWMin}
          unit="rad/s"
          min={0.001}
          step={0.05}
        />
        <NumericField
          id="w-max"
          label="ω max"
          value={wMax}
          onChange={setWMax}
          unit="rad/s"
          min={1}
          step={10}
        />
      </div>

      {(mode === 'bode' || mode === 'nyquist') && (
        <NumericField
          id="time-delay"
          label="Transport Delay (τ)"
          value={timeDelay}
          onChange={setTimeDelay}
          unit="s"
          min={0}
          step={0.05}
          slider
          sliderMin={0}
          sliderMax={2}
        />
      )}

      {mode === 'bode' && (
        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <span>Lead-Lag Compensator C(s)</span>
            <input
              type="checkbox"
              checked={compensatorEnabled}
              onChange={(e) => setCompensatorEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
          </label>
          {compensatorEnabled && (
            <div className="space-y-2.5">
              <NumericField
                id="comp-kc"
                label="Compensator Gain (Kc)"
                value={compGain}
                onChange={setCompGain}
                min={0.05}
                step={0.1}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <NumericField
                  id="comp-tz"
                  label="Zero τz"
                  value={compTauZ}
                  onChange={setCompTauZ}
                  unit="s"
                  min={0}
                  step={0.05}
                />
                <NumericField
                  id="comp-tp"
                  label="Pole τp"
                  value={compTauP}
                  onChange={setCompTauP}
                  unit="s"
                  min={0}
                  step={0.05}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );

  // Render Nyquist
  if (mode === 'nyquist' && nyquistRes) {
    if (!nyquistRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controlsPanel}
          <div>
            <ErrorBanner message={nyquistRes.error} />
          </div>
        </div>
      );
    }

    const d = nyquistRes.data;
    const nyquistSeries: PlotSeries[] = [
      {
        id: 'nyq-pos',
        label: 'G(jω), ω > 0',
        color: '#2563EB',
        points: d.points.map((pt) => ({
          x: pt.re,
          y: pt.im,
          tooltipTitle: `ω = ${formatNumber(pt.omega, 3)} rad/s`,
          tooltipRows: [
            { label: 'Re{G(jω)}', value: formatNumber(pt.re, 4) },
            { label: 'Im{G(jω)}', value: formatNumber(pt.im, 4) },
            { label: '|G(jω)|', value: `${formatNumber(pt.mag, 4)} (${formatNumber(pt.magDb, 2)} dB)` },
            { label: '∠G(jω)', value: `${formatNumber(pt.phaseDeg, 2)}°` },
          ],
        })),
      },
      {
        id: 'nyq-neg',
        label: 'G(−jω) Conjugate Mirror',
        color: '#94A3B8',
        dashed: true,
        strokeWidth: 1.5,
        points: d.mirrorPoints.map((pt) => ({
          x: pt.re,
          y: pt.im,
          tooltipTitle: `ω = −${formatNumber(pt.omega, 3)} rad/s`,
          tooltipRows: [
            { label: 'Re{G(−jω)}', value: formatNumber(pt.re, 4) },
            { label: 'Im{G(−jω)}', value: formatNumber(pt.im, 4) },
            { label: '∠G(−jω)', value: `${formatNumber(pt.phaseDeg, 2)}°` },
          ],
        })),
      },
    ];

    const markers: PlotMarker[] = [
      {
        id: 'crit-point',
        x: -1,
        y: 0,
        shape: 'cross',
        color: '#DC2626',
        label: '−1 + j0',
        tooltipTitle: 'Nyquist Critical Point',
        tooltipRows: [
          { label: 'Coordinate', value: '−1.000 + j0.000' },
          { label: 'Encirclements (N)', value: String(d.encirclementsN) },
          { label: 'Min Distance', value: formatNumber(d.minDistToCritical, 4) },
        ],
      },
    ];

    // Clamp display bounds sensibly when origin poles blow up at low omega
    const finiteRe = d.points.map((p) => p.re).filter((v) => Math.abs(v) < 12);
    const finiteIm = d.points.map((p) => p.im).filter((v) => Math.abs(v) < 12);
    const maxAbs = Math.max(
      2,
      Math.min(
        10,
        Math.max(
          ...finiteRe.map(Math.abs),
          ...finiteIm.map(Math.abs),
          1.5
        ) * 1.15
      )
    );

    const metrics: MetricReadout[] = [
      {
        label: 'Closed-Loop Stability',
        value: d.isClosedLoopStable ? 'Stable' : 'Unstable',
        status: d.isClosedLoopStable ? 'nominal' : 'critical',
        statusText: `Z = ${d.closedLoopRhpPoles} RHP poles (P=${d.openLoopRhpPoles}, N=${d.encirclementsN})`,
      },
      {
        label: 'Gain Margin',
        value: d.gainMarginDb !== null ? formatNumber(d.gainMarginDb, 2) : '∞',
        unit: d.gainMarginDb !== null ? 'dB' : undefined,
        sublabel: d.omegaPc ? `ω_pc = ${formatNumber(d.omegaPc, 3)} rad/s` : 'No −180° crossing',
      },
      {
        label: 'Phase Margin',
        value: d.phaseMarginDeg !== null ? formatNumber(d.phaseMarginDeg, 2) : '∞',
        unit: d.phaseMarginDeg !== null ? 'deg' : undefined,
        sublabel: d.omegaGc ? `ω_gc = ${formatNumber(d.omegaGc, 3)} rad/s` : 'No 0 dB crossing',
      },
      {
        label: 'Vector Margin (Min Dist)',
        value: formatNumber(d.minDistToCritical, 3),
        sublabel: 'Min |1 + G(jω)|',
      },
    ];

    const sampleRows = d.points
      .filter((_, i) => i % 40 === 0 || i === d.points.length - 1)
      .map((pt) => [
        formatNumber(pt.omega, 3),
        formatNumber(pt.re, 4),
        formatNumber(pt.im, 4),
        formatNumber(pt.magDb, 2),
        formatNumber(pt.phaseDeg, 2),
      ]);

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controlsPanel}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Nyquist Polar Contour"
            subtitle="Complex G(jω) plane with unit circle & critical point (−1 + j0)"
            xLabel="Real Axis Re{G(jω)}"
            yLabel="Imaginary Axis Im{G(jω)}"
            series={nyquistSeries}
            markers={markers}
            circles={[
              {
                id: 'unit-circle',
                cx: 0,
                cy: 0,
                r: 1,
                color: '#94A3B8',
                dashed: true,
                label: '|G|=1',
              },
            ]}
            xBounds={[-maxAbs, maxAbs]}
            yBounds={[-maxAbs, maxAbs]}
            aspectEqual
            onExportCsv={() =>
              downloadCsv(
                'nyquist_response.csv',
                ['omega_rad_s', 'Re', 'Im', 'Mag_dB', 'Phase_deg'],
                d.points.map((pt) => [pt.omega, pt.re, pt.im, pt.magDb, pt.phaseDeg])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
          <DataTable
            caption="Frequency Sweep Samples"
            headers={['ω (rad/s)', 'Re{G}', 'Im{G}', '|G| (dB)', '∠G (deg)']}
            rows={sampleRows}
          />
        </div>
      </div>
    );
  }

  // Render Bode
  if (mode === 'bode' && bodeRes) {
    if (!bodeRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controlsPanel}
          <div>
            <ErrorBanner message={bodeRes.error} />
          </div>
        </div>
      );
    }

    const d = bodeRes.data;
    const magSeries: PlotSeries[] = [
      {
        id: 'bode-mag',
        label: 'Open-Loop |G(jω)| (dB)',
        color: '#2563EB',
        points: d.points.map((pt) => ({
          x: pt.omega,
          y: pt.magDb,
          tooltipTitle: `ω = ${formatNumber(pt.omega, 3)} rad/s`,
          tooltipRows: [
            { label: '|G(jω)|', value: `${formatNumber(pt.magDb, 2)} dB` },
            { label: 'Linear |G|', value: formatNumber(pt.magLinear, 4) },
            { label: '∠G(jω)', value: `${formatNumber(pt.phaseDeg, 2)}°` },
            { label: 'Closed-Loop |T|', value: `${formatNumber(pt.clMagDb, 2)} dB` },
          ],
        })),
      },
      {
        id: 'bode-cl',
        label: 'Closed-Loop |T(jω)| (dB)',
        color: '#0D9488',
        dashed: true,
        strokeWidth: 1.6,
        points: d.points.map((pt) => ({
          x: pt.omega,
          y: pt.clMagDb,
          tooltipTitle: `ω = ${formatNumber(pt.omega, 3)} rad/s`,
          tooltipRows: [
            { label: 'Closed-Loop |T|', value: `${formatNumber(pt.clMagDb, 2)} dB` },
            { label: 'Open-Loop |G|', value: `${formatNumber(pt.magDb, 2)} dB` },
          ],
        })),
      },
    ];

    const phaseSeries: PlotSeries[] = [
      {
        id: 'bode-phase',
        label: 'Phase Shift ∠G(jω) (deg)',
        color: '#D97706',
        points: d.points.map((pt) => ({
          x: pt.omega,
          y: pt.phaseDeg,
          tooltipTitle: `ω = ${formatNumber(pt.omega, 3)} rad/s`,
          tooltipRows: [
            { label: '∠G(jω)', value: `${formatNumber(pt.phaseDeg, 2)}°` },
            { label: '|G(jω)|', value: `${formatNumber(pt.magDb, 2)} dB` },
          ],
        })),
      },
    ];

    const magMarkers: PlotMarker[] = [];
    if (d.gainCrossoverRad) {
      magMarkers.push({
        id: 'wgc',
        x: d.gainCrossoverRad,
        y: 0,
        shape: 'circle',
        color: '#059669',
        label: `ωgc=${formatNumber(d.gainCrossoverRad, 2)}`,
        tooltipTitle: 'Gain Crossover (0 dB)',
        tooltipRows: [
          { label: 'ω_gc', value: `${formatNumber(d.gainCrossoverRad, 3)} rad/s` },
          { label: 'Phase Margin', value: d.phaseMarginDeg !== null ? `${formatNumber(d.phaseMarginDeg, 2)}°` : '—' },
        ],
      });
    }

    const phaseMarkers: PlotMarker[] = [];
    if (d.phaseCrossoverRad) {
      phaseMarkers.push({
        id: 'wpc',
        x: d.phaseCrossoverRad,
        y: -180,
        shape: 'diamond',
        color: '#DC2626',
        label: `ωpc=${formatNumber(d.phaseCrossoverRad, 2)}`,
        tooltipTitle: 'Phase Crossover (−180°)',
        tooltipRows: [
          { label: 'ω_pc', value: `${formatNumber(d.phaseCrossoverRad, 3)} rad/s` },
          { label: 'Gain Margin', value: d.gainMarginDb !== null ? `${formatNumber(d.gainMarginDb, 2)} dB` : '—' },
        ],
      });
    }

    const metrics: MetricReadout[] = [
      {
        label: 'Gain Margin (GM)',
        value: d.gainMarginDb !== null ? formatNumber(d.gainMarginDb, 2) : '∞',
        unit: d.gainMarginDb !== null ? 'dB' : undefined,
        status:
          d.gainMarginDb === null
            ? 'nominal'
            : d.gainMarginDb > 6
              ? 'nominal'
              : d.gainMarginDb > 0
                ? 'warning'
                : 'critical',
        statusText: d.phaseCrossoverRad ? `ω_pc = ${formatNumber(d.phaseCrossoverRad, 3)} rad/s` : 'No −180° crossing',
      },
      {
        label: 'Phase Margin (PM)',
        value: d.phaseMarginDeg !== null ? formatNumber(d.phaseMarginDeg, 2) : '∞',
        unit: d.phaseMarginDeg !== null ? 'deg' : undefined,
        status:
          d.phaseMarginDeg === null
            ? 'nominal'
            : d.phaseMarginDeg > 30
              ? 'nominal'
              : d.phaseMarginDeg > 0
                ? 'warning'
                : 'critical',
        statusText: d.gainCrossoverRad ? `ω_gc = ${formatNumber(d.gainCrossoverRad, 3)} rad/s` : 'No 0 dB crossing',
      },
      {
        label: '−3 dB Bandwidth',
        value: d.bandwidthRad !== null ? formatNumber(d.bandwidthRad, 3) : '—',
        unit: d.bandwidthRad !== null ? 'rad/s' : undefined,
        sublabel: 'Closed-loop T(jω)',
      },
      {
        label: 'Low-Freq Gain',
        value: formatNumber(d.dcGainDb, 2),
        unit: 'dB',
        sublabel: `At ω = ${formatNumber(wMin, 2)} rad/s`,
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controlsPanel}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Bode Magnitude Plot"
            subtitle="Logarithmic frequency response |G(jω)| in dB"
            xLabel="Frequency ω (rad/s)"
            yLabel="Magnitude (dB)"
            xScale="log"
            xBounds={[wMin, wMax]}
            heightPx={290}
            series={magSeries}
            markers={magMarkers}
            onExportCsv={() =>
              downloadCsv(
                'bode_response.csv',
                ['omega_rad_s', 'Mag_dB', 'Phase_deg', 'ClosedLoop_dB'],
                d.points.map((pt) => [pt.omega, pt.magDb, pt.phaseDeg, pt.clMagDb])
              )
            }
          />
          <EngineeringPlot
            title="Bode Phase Plot"
            subtitle="Unwrapped phase shift ∠G(jω) in degrees"
            xLabel="Frequency ω (rad/s)"
            yLabel="Phase (deg)"
            xScale="log"
            xBounds={[wMin, wMax]}
            heightPx={270}
            series={phaseSeries}
            markers={phaseMarkers}
          />
          <MetricsGrid metrics={metrics} />
        </div>
      </div>
    );
  }

  // Render Nichols
  if (mode === 'nichols' && nicholsRes) {
    if (!nicholsRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controlsPanel}
          <div>
            <ErrorBanner message={nicholsRes.error} />
          </div>
        </div>
      );
    }

    const d = nicholsRes.data;
    const contourSeries: PlotSeries[] = d.contours.flatMap((cItem) =>
      cItem.segments.map((seg, idx) => ({
        id: `m-${cItem.mDb}-${idx}`,
        label: '',
        color: cItem.mDb === 0 ? 'rgba(217, 119, 6, 0.55)' : 'rgba(148, 163, 184, 0.45)',
        strokeWidth: cItem.mDb === 0 ? 1.4 : 1,
        dashed: cItem.mDb !== 0,
        interactive: false,
        points: seg.map((pt) => ({
          x: pt.phaseDeg,
          y: pt.magDb,
          tooltipRows: [],
        })),
      }))
    );

    const mainSeries: PlotSeries = {
      id: 'nichols-curve',
      label: 'Open-Loop G(jω) Locus',
      color: '#2563EB',
      strokeWidth: 2.5,
      points: d.points.map((pt) => ({
        x: pt.phaseDeg,
        y: pt.magDb,
        tooltipTitle: `ω = ${formatNumber(pt.omega, 3)} rad/s`,
        tooltipRows: [
          { label: 'OL Mag', value: `${formatNumber(pt.magDb, 2)} dB` },
          { label: 'OL Phase', value: `${formatNumber(pt.phaseDeg, 2)}°` },
          { label: 'CL Mag (M)', value: `${formatNumber(pt.clMagDb, 2)} dB` },
          { label: 'CL Phase (N)', value: `${formatNumber(pt.clPhaseDeg, 2)}°` },
        ],
      })),
    };

    const markers: PlotMarker[] = [
      {
        id: 'critical-nichols',
        x: -180,
        y: 0,
        shape: 'cross',
        color: '#DC2626',
        label: '(−180°, 0 dB)',
        tooltipTitle: 'Critical Stability Point',
        tooltipRows: [
          { label: 'Phase', value: '−180.0°' },
          { label: 'Magnitude', value: '0.00 dB' },
        ],
      },
    ];

    const metrics: MetricReadout[] = [
      {
        label: 'Resonant Peak (Mr)',
        value: formatNumber(d.resonantPeakDb, 2),
        unit: 'dB',
        status: d.resonantPeakDb < 3 ? 'nominal' : d.resonantPeakDb < 6 ? 'warning' : 'critical',
        statusText: `At ω_r = ${formatNumber(d.resonantFreqRad, 3)} rad/s`,
      },
      {
        label: 'Gain Margin',
        value: d.gainMarginDb !== null ? formatNumber(d.gainMarginDb, 2) : '∞',
        unit: d.gainMarginDb !== null ? 'dB' : undefined,
        sublabel: 'At −180° axis',
      },
      {
        label: 'Phase Margin',
        value: d.phaseMarginDeg !== null ? formatNumber(d.phaseMarginDeg, 2) : '∞',
        unit: d.phaseMarginDeg !== null ? 'deg' : undefined,
        sublabel: 'At 0 dB axis',
      },
      {
        label: 'Closed-Loop BW',
        value: d.bandwidthRad !== null ? formatNumber(d.bandwidthRad, 3) : '—',
        unit: d.bandwidthRad !== null ? 'rad/s' : undefined,
        sublabel: '−3 dB cutoff',
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controlsPanel}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Nichols Chart (with Constant M-Contours)"
            subtitle="Open-loop gain (dB) vs phase (deg) overlaid on closed-loop magnitude contours"
            xLabel="Open-Loop Phase ∠G(jω) (deg)"
            yLabel="Open-Loop Gain |G(jω)| (dB)"
            xBounds={[-300, 0]}
            yBounds={[-30, 30]}
            series={[...contourSeries, mainSeries]}
            markers={markers}
            onExportCsv={() =>
              downloadCsv(
                'nichols_chart.csv',
                ['omega_rad_s', 'OL_Phase_deg', 'OL_Mag_dB', 'CL_Mag_dB'],
                d.points.map((pt) => [pt.omega, pt.phaseDeg, pt.magDb, pt.clMagDb])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
        </div>
      </div>
    );
  }

  return null;
};
