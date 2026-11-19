import React, { useMemo, useState } from 'react';
import { computePhasorDiagram, computePowerCircle, type CircuitTopology } from '../../math/acAndPower';
import type { MetricReadout } from '../../types/bench';
import { downloadCsv, formatNumber } from '../../utils/format';
import {
  EngineeringPlot,
  type PlotCircle,
  type PlotMarker,
  type PlotSeries,
  type PlotVector,
} from '../charts/EngineeringPlot';
import { DataTable } from '../ui/DataTable';
import { ErrorBanner } from '../ui/ErrorBanner';
import { MetricsGrid } from '../ui/MetricsGrid';
import { NumericField } from '../ui/NumericField';

interface AcPowerBenchProps {
  mode: 'phasor' | 'power-circle';
}

const VECTOR_COLORS: Record<'primary' | 'amber' | 'emerald' | 'rose' | 'slate', string> = {
  primary: '#2563EB',
  amber: '#D97706',
  emerald: '#059669',
  rose: '#DC2626',
  slate: '#475569',
};

export const AcPowerBench: React.FC<AcPowerBenchProps> = ({ mode }) => {
  // Phasor state
  const [topology, setTopology] = useState<CircuitTopology>('series');
  const [voltageRms, setVoltageRms] = useState<number>(230);
  const [frequencyHz, setFrequencyHz] = useState<number>(50);
  const [resistanceOhm, setResistanceOhm] = useState<number>(18);
  const [inductanceMh, setInductanceMh] = useState<number>(95);
  const [capacitanceUf, setCapacitanceUf] = useState<number>(150);

  // Power Circle state
  const [vsKv, setVsKv] = useState<number>(138);
  const [vrKv, setVrKv] = useState<number>(132);
  const [reactanceOhm, setReactanceOhm] = useState<number>(42);
  const [deltaDeg, setDeltaDeg] = useState<number>(28);
  const [armatureLimitMva, setArmatureLimitMva] = useState<number>(360);
  const [fieldLimitMva, setFieldLimitMva] = useState<number>(420);
  const [turbineMaxMw, setTurbineMaxMw] = useState<number>(320);

  const phasorRes = useMemo(
    () =>
      mode === 'phasor'
        ? computePhasorDiagram({
            topology,
            voltageRms,
            frequencyHz,
            resistanceOhm,
            inductanceMh,
            capacitanceUf,
          })
        : null,
    [mode, topology, voltageRms, frequencyHz, resistanceOhm, inductanceMh, capacitanceUf]
  );

  const powerRes = useMemo(
    () =>
      mode === 'power-circle'
        ? computePowerCircle({
            vsKv,
            vrKv,
            reactanceOhm,
            deltaDeg,
            armatureLimitMva,
            fieldLimitMva,
            turbineMaxMw,
          })
        : null,
    [mode, vsKv, vrKv, reactanceOhm, deltaDeg, armatureLimitMva, fieldLimitMva, turbineMaxMw]
  );

  if (mode === 'phasor' && phasorRes) {
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <div>
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            RLC Circuit Topology
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['series', 'parallel'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopology(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  topology === t
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {t} RLC
              </button>
            ))}
          </div>
        </div>

        <NumericField
          id="ac-voltage"
          label="Supply Voltage (Vrms)"
          value={voltageRms}
          onChange={setVoltageRms}
          unit="V"
          min={1}
          step={10}
        />
        <NumericField
          id="ac-freq"
          label="Supply Frequency (f)"
          value={frequencyHz}
          onChange={setFrequencyHz}
          unit="Hz"
          min={1}
          step={5}
          slider
          sliderMin={10}
          sliderMax={400}
        />
        <NumericField
          id="ac-r"
          label="Resistance (R)"
          value={resistanceOhm}
          onChange={setResistanceOhm}
          unit="Ω"
          min={0}
          step={1}
          slider
          sliderMin={1}
          sliderMax={100}
        />
        <NumericField
          id="ac-l"
          label="Inductance (L)"
          value={inductanceMh}
          onChange={setInductanceMh}
          unit="mH"
          min={0}
          step={5}
          slider
          sliderMin={0}
          sliderMax={300}
        />
        <NumericField
          id="ac-c"
          label="Capacitance (C)"
          value={capacitanceUf}
          onChange={setCapacitanceUf}
          unit="μF"
          min={1}
          step={5}
          slider
          sliderMin={10}
          sliderMax={500}
        />
      </aside>
    );

    if (!phasorRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={phasorRes.error} />
          </div>
        </div>
      );
    }

    const d = phasorRes.data;
    // Normalize current vectors visually onto the voltage scale so both voltage and current phasors are cleanly legible
    const maxV = Math.max(...d.voltagePhasors.map((v) => v.mag), 1);
    const maxI = Math.max(...d.currentPhasors.map((v) => v.mag), 0.001);
    const currentDisplayScale = (maxV * 0.65) / maxI;

    const vectors: PlotVector[] = [
      ...d.voltagePhasors.map((v) => ({
        id: v.id,
        x1: 0,
        y1: 0,
        x2: v.re,
        y2: v.im,
        color: VECTOR_COLORS[v.colorKey],
        label: v.id,
        tooltipTitle: v.label,
        tooltipRows: [
          { label: 'Magnitude', value: `${formatNumber(v.mag, 3)} ${v.unit}` },
          { label: 'Phase Angle', value: `${formatNumber(v.angleDeg, 2)}°` },
          { label: 'Real', value: `${formatNumber(v.re, 3)} ${v.unit}` },
          { label: 'Imag', value: `${formatNumber(v.im, 3)} ${v.unit}` },
        ],
      })),
      ...d.currentPhasors.map((cVec) => ({
        id: cVec.id,
        x1: 0,
        y1: 0,
        x2: cVec.re * currentDisplayScale,
        y2: cVec.im * currentDisplayScale,
        color: VECTOR_COLORS[cVec.colorKey],
        label: `${cVec.id} (scaled)`,
        dashed: true,
        tooltipTitle: `${cVec.label}`,
        tooltipRows: [
          { label: 'Magnitude', value: `${formatNumber(cVec.mag, 3)} ${cVec.unit}` },
          { label: 'Phase Angle', value: `${formatNumber(cVec.angleDeg, 2)}°` },
          { label: 'Real', value: `${formatNumber(cVec.re, 3)} ${cVec.unit}` },
          { label: 'Imag', value: `${formatNumber(cVec.im, 3)} ${cVec.unit}` },
        ],
      })),
    ];

    const extent = maxV * 1.2;
    const metrics: MetricReadout[] = [
      {
        label: 'Impedance |Z|',
        value: formatNumber(d.impedanceMagOhm, 3),
        unit: 'Ω',
        sublabel: `XL = ${formatNumber(d.xlOhm, 2)} Ω · XC = ${formatNumber(d.xcOhm, 2)} Ω`,
      },
      {
        label: 'Phase Angle (φ)',
        value: formatNumber(d.impedancePhaseDeg, 2),
        unit: 'deg',
        sublabel: `Current ${formatNumber(d.currentMagA, 3)} A @ ${formatNumber(d.currentPhaseDeg, 2)}°`,
      },
      {
        label: 'Power Factor (cos φ)',
        value: formatNumber(d.powerFactor, 4),
        status: d.powerFactor >= 0.85 ? 'nominal' : d.powerFactor >= 0.6 ? 'warning' : 'critical',
        statusText: `${d.pfType} · f₀ = ${d.resonantFreqHz ? formatNumber(d.resonantFreqHz, 2) + ' Hz' : '—'}`,
      },
      {
        label: 'Reactive Power (Q)',
        value: formatNumber(d.reactivePowerVar, 1),
        unit: 'var',
        sublabel: `P = ${formatNumber(d.activePowerW, 1)} W · S = ${formatNumber(d.apparentPowerVa, 1)} VA`,
      },
    ];

    const allPhasors = [...d.voltagePhasors, ...d.currentPhasors];
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="AC Phasor Vector Diagram"
            subtitle="Voltage phasors (solid) & scaled current phasors (dashed) referenced to Vs∠0°"
            xLabel="In-Phase Real Axis (V)"
            yLabel="Quadrature Imaginary Axis (V)"
            aspectEqual
            xBounds={[-extent, extent]}
            yBounds={[-extent, extent]}
            series={[]}
            vectors={vectors}
            circles={[
              {
                id: 'vs-ref',
                cx: 0,
                cy: 0,
                r: voltageRms,
                color: 'rgba(148, 163, 184, 0.35)',
                dashed: true,
              },
            ]}
            onExportCsv={() =>
              downloadCsv(
                'ac_phasors.csv',
                ['Phasor', 'Magnitude', 'Unit', 'Angle_deg', 'Real', 'Imag'],
                allPhasors.map((v) => [v.id, v.mag, v.unit, v.angleDeg, v.re, v.im])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
          <DataTable
            caption="Phasor Decomposition Table"
            headers={['Phasor', 'Magnitude', 'Angle (deg)', 'Real', 'Imaginary']}
            rows={allPhasors.map((v) => [
              v.label,
              `${formatNumber(v.mag, 3)} ${v.unit}`,
              `${formatNumber(v.angleDeg, 2)}°`,
              formatNumber(v.re, 3),
              formatNumber(v.im, 3),
            ])}
          />
        </div>
      </div>
    );
  }

  // Render Power Circle Diagram
  if (mode === 'power-circle' && powerRes) {
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <NumericField
          id="pc-delta"
          label="Power Angle (δ)"
          value={deltaDeg}
          onChange={setDeltaDeg}
          unit="deg"
          min={-90}
          max={180}
          step={1}
          slider
          sliderMin={0}
          sliderMax={120}
        />
        <NumericField
          id="pc-vs"
          label="Sending Bus Voltage (Vs)"
          value={vsKv}
          onChange={setVsKv}
          unit="kV"
          min={1}
          step={2}
        />
        <NumericField
          id="pc-vr"
          label="Receiving Bus Voltage (Vr)"
          value={vrKv}
          onChange={setVrKv}
          unit="kV"
          min={1}
          step={2}
        />
        <NumericField
          id="pc-x"
          label="Line / Sync Reactance (X)"
          value={reactanceOhm}
          onChange={setReactanceOhm}
          unit="Ω"
          min={0.5}
          step={2}
        />
        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <NumericField
            id="pc-arm"
            label="Armature Thermal Limit"
            value={armatureLimitMva}
            onChange={setArmatureLimitMva}
            unit="MVA"
            min={10}
            step={10}
          />
          <NumericField
            id="pc-field"
            label="Field Excitation Limit"
            value={fieldLimitMva}
            onChange={setFieldLimitMva}
            unit="MVA"
            min={10}
            step={10}
          />
          <NumericField
            id="pc-turb"
            label="Turbine Active Power Limit"
            value={turbineMaxMw}
            onChange={setTurbineMaxMw}
            unit="MW"
            min={10}
            step={10}
          />
        </div>
      </aside>
    );

    if (!powerRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={powerRes.error} />
          </div>
        </div>
      );
    }

    const d = powerRes.data;
    const series: PlotSeries[] = [
      {
        id: 'power-locus',
        label: 'Receiving-End Power Circle (δ = 0°…180°)',
        color: '#2563EB',
        points: d.locusPoints.map((pt) => ({
          x: pt.pMw,
          y: pt.qMvar,
          tooltipTitle: `Power Angle δ = ${pt.deltaDeg}°`,
          tooltipRows: [
            { label: 'Active Power (P)', value: `${formatNumber(pt.pMw, 2)} MW` },
            { label: 'Reactive Power (Q)', value: `${formatNumber(pt.qMvar, 2)} Mvar` },
            { label: 'Apparent Power (S)', value: `${formatNumber(Math.hypot(pt.pMw, pt.qMvar), 2)} MVA` },
          ],
        })),
      },
      {
        id: 'turbine-limit',
        label: `Turbine Limit (${formatNumber(turbineMaxMw, 0)} MW)`,
        color: '#D97706',
        dashed: true,
        strokeWidth: 1.5,
        interactive: false,
        points: [
          { x: turbineMaxMw, y: d.qCenterMvar - d.circleRadiusMva * 1.1, tooltipRows: [] },
          { x: turbineMaxMw, y: d.qCenterMvar + d.circleRadiusMva * 1.1, tooltipRows: [] },
        ],
      },
      {
        id: 'stability-boundary',
        label: 'Steady-State Stability Boundary (δ = 90°)',
        color: '#DC2626',
        dashed: true,
        strokeWidth: 1.5,
        interactive: false,
        points: [
          { x: 0, y: d.qCenterMvar, tooltipRows: [] },
          { x: d.steadyStateLimitMw * 1.1, y: d.qCenterMvar, tooltipRows: [] },
        ],
      },
    ];

    const circles: PlotCircle[] = [
      {
        id: 'armature-circle',
        cx: 0,
        cy: 0,
        r: armatureLimitMva,
        color: '#059669',
        dashed: true,
        label: 'Armature Limit',
      },
      {
        id: 'field-circle',
        cx: 0,
        cy: d.qCenterMvar,
        r: fieldLimitMva,
        color: '#7C3AED',
        dashed: true,
        label: 'Field Limit',
      },
    ];

    const vectors: PlotVector[] = [
      {
        id: 'op-vector',
        x1: 0,
        y1: d.qCenterMvar,
        x2: d.operatingP,
        y2: d.operatingQ,
        color: '#2563EB',
        label: `δ=${deltaDeg}°`,
        tooltipTitle: `Operating Point (δ = ${deltaDeg}°)`,
        tooltipRows: [
          { label: 'Active P', value: `${formatNumber(d.operatingP, 2)} MW` },
          { label: 'Reactive Q', value: `${formatNumber(d.operatingQ, 2)} Mvar` },
          { label: 'Apparent S', value: `${formatNumber(d.operatingS, 2)} MVA` },
        ],
      },
    ];

    const markers: PlotMarker[] = [
      {
        id: 'op-point',
        x: d.operatingP,
        y: d.operatingQ,
        shape: 'circle',
        color: d.withinStabilityLimit && d.withinArmatureLimit && d.withinTurbineLimit ? '#059669' : '#DC2626',
        label: `(${formatNumber(d.operatingP, 1)} MW, ${formatNumber(d.operatingQ, 1)} Mvar)`,
        tooltipTitle: 'Current Operating Point',
        tooltipRows: [
          { label: 'P', value: `${formatNumber(d.operatingP, 2)} MW` },
          { label: 'Q', value: `${formatNumber(d.operatingQ, 2)} Mvar` },
          { label: 'Stability Margin', value: `${formatNumber(d.stabilityMarginPct, 1)}%` },
        ],
      },
    ];

    const allWithin =
      d.withinStabilityLimit && d.withinArmatureLimit && d.withinFieldLimit && d.withinTurbineLimit;

    const metrics: MetricReadout[] = [
      {
        label: 'Operating Active Power (P)',
        value: formatNumber(d.operatingP, 2),
        unit: 'MW',
        status: allWithin ? 'nominal' : 'critical',
        statusText: allWithin ? 'Within all capability limits' : 'Limit violation detected',
      },
      {
        label: 'Operating Reactive Power (Q)',
        value: formatNumber(d.operatingQ, 2),
        unit: 'Mvar',
        sublabel: `S = ${formatNumber(d.operatingS, 2)} MVA`,
      },
      {
        label: 'Steady-State P_max (δ=90°)',
        value: formatNumber(d.steadyStateLimitMw, 2),
        unit: 'MW',
        sublabel: `Stability margin: ${formatNumber(d.stabilityMarginPct, 1)}%`,
      },
      {
        label: 'Reactive Capability Range',
        value: `${formatNumber(d.qMinMvar, 0)} to ${formatNumber(d.qMaxMvar, 0)}`,
        unit: 'Mvar',
        sublabel: `Center Q₀ = ${formatNumber(d.qCenterMvar, 1)} Mvar`,
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Power Circle & Capability Diagram"
            subtitle="Active power P (MW) vs reactive power Q (Mvar) with thermal, field & stability limits"
            xLabel="Active Power P (MW)"
            yLabel="Reactive Power Q (Mvar)"
            aspectEqual
            series={series}
            circles={circles}
            vectors={vectors}
            markers={markers}
            onExportCsv={() =>
              downloadCsv(
                'power_circle.csv',
                ['Delta_deg', 'P_MW', 'Q_Mvar'],
                d.locusPoints.map((pt) => [pt.deltaDeg, pt.pMw, pt.qMvar])
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
