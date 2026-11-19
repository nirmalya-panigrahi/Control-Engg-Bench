import React, { useMemo, useState } from 'react';
import {
  computeStepResponse,
  computeTorqueSpeed,
  computeTransformerEfficiency,
} from '../../math/machinesAndTime';
import type { MetricReadout } from '../../types/bench';
import { downloadCsv, formatNumber } from '../../utils/format';
import { EngineeringPlot, type PlotMarker, type PlotSeries } from '../charts/EngineeringPlot';
import { DataTable } from '../ui/DataTable';
import { ErrorBanner } from '../ui/ErrorBanner';
import { MetricsGrid } from '../ui/MetricsGrid';
import { NumericField } from '../ui/NumericField';

interface MachinesTimeBenchProps {
  mode: 'torque-speed' | 'transformer-efficiency' | 'step-response';
}

export const MachinesTimeBench: React.FC<MachinesTimeBenchProps> = ({ mode }) => {
  // Torque-Speed inputs
  const [voltageLl, setVoltageLl] = useState<number>(460);
  const [frequencyHz, setFrequencyHz] = useState<number>(60);
  const [poles, setPoles] = useState<number>(4);
  const [r1, setR1] = useState<number>(0.45);
  const [x1, setX1] = useState<number>(1.1);
  const [r2, setR2] = useState<number>(0.38);
  const [x2, setX2] = useState<number>(1.2);
  const [ratedSlip, setRatedSlip] = useState<number>(0.035);

  // Transformer Efficiency inputs
  const [ratedKva, setRatedKva] = useState<number>(100);
  const [coreLossW, setCoreLossW] = useState<number>(450);
  const [cuLossW, setCuLossW] = useState<number>(1350);
  const [powerFactor, setPowerFactor] = useState<number>(0.85);
  const [loadFraction, setLoadFraction] = useState<number>(0.75);

  // Step Response inputs
  const [zeta, setZeta] = useState<number>(0.35);
  const [omegaN, setOmegaN] = useState<number>(4.0);
  const [amplitude, setAmplitude] = useState<number>(1.0);

  const torqueRes = useMemo(
    () =>
      mode === 'torque-speed'
        ? computeTorqueSpeed({
            voltageLl,
            frequencyHz,
            poles,
            statorResistanceOhm: r1,
            statorReactanceOhm: x1,
            rotorResistanceOhm: r2,
            rotorReactanceOhm: x2,
            ratedSlip,
          })
        : null,
    [mode, voltageLl, frequencyHz, poles, r1, x1, r2, x2, ratedSlip]
  );

  const txRes = useMemo(
    () =>
      mode === 'transformer-efficiency'
        ? computeTransformerEfficiency({
            ratedKva,
            coreLossW,
            fullLoadCopperLossW: cuLossW,
            powerFactor,
            loadFraction,
          })
        : null,
    [mode, ratedKva, coreLossW, cuLossW, powerFactor, loadFraction]
  );

  const stepRes = useMemo(
    () => (mode === 'step-response' ? computeStepResponse({ zeta, omegaN, amplitude }) : null),
    [mode, zeta, omegaN, amplitude]
  );

  // 1. Torque-Speed Curve
  if (mode === 'torque-speed' && torqueRes) {
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <NumericField
          id="motor-vll"
          label="Supply Line Voltage (V_LL)"
          value={voltageLl}
          onChange={setVoltageLl}
          unit="V"
          min={10}
          step={10}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumericField
            id="motor-freq"
            label="Frequency (f)"
            value={frequencyHz}
            onChange={setFrequencyHz}
            unit="Hz"
            min={5}
            step={5}
          />
          <NumericField
            id="motor-poles"
            label="Motor Poles (P)"
            value={poles}
            onChange={setPoles}
            min={2}
            max={16}
            step={2}
          />
        </div>
        <NumericField
          id="motor-r2"
          label="Rotor Resistance (R₂)"
          value={r2}
          onChange={setR2}
          unit="Ω"
          min={0.05}
          step={0.05}
          slider
          sliderMin={0.1}
          sliderMax={2.5}
        />
        <NumericField
          id="motor-slip"
          label="Rated Operating Slip (s)"
          value={ratedSlip}
          onChange={setRatedSlip}
          min={0.005}
          max={0.25}
          step={0.005}
          slider
          sliderMin={0.01}
          sliderMax={0.15}
        />
        <div className="grid grid-cols-2 gap-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
          <NumericField
            id="motor-r1"
            label="Stator R₁"
            value={r1}
            onChange={setR1}
            unit="Ω"
            min={0}
            step={0.05}
          />
          <NumericField
            id="motor-x1"
            label="Stator X₁"
            value={x1}
            onChange={setX1}
            unit="Ω"
            min={0}
            step={0.1}
          />
        </div>
        <NumericField
          id="motor-x2"
          label="Rotor Leakage Reactance (X₂)"
          value={x2}
          onChange={setX2}
          unit="Ω"
          min={0}
          step={0.1}
        />
      </aside>
    );

    if (!torqueRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={torqueRes.error} />
          </div>
        </div>
      );
    }

    const d = torqueRes.data;
    const series: PlotSeries[] = [
      {
        id: 'torque-nom',
        label: `Nominal R₂ = ${formatNumber(r2, 2)} Ω`,
        color: '#2563EB',
        areaFill: 'rgba(37, 99, 235, 0.08)',
        points: d.points.map((pt) => ({
          x: pt.speedRpm,
          y: pt.torqueNm,
          tooltipTitle: `Speed = ${formatNumber(pt.speedRpm, 1)} RPM (s=${formatNumber(pt.slip, 3)})`,
          tooltipRows: [
            { label: 'Torque', value: `${formatNumber(pt.torqueNm, 2)} N·m` },
            { label: '2×R₂ Torque', value: `${formatNumber(pt.torqueDoubleR2Nm, 2)} N·m` },
            { label: 'Rotor Current', value: `${formatNumber(pt.rotorCurrentA, 2)} A` },
          ],
        })),
      },
      {
        id: 'torque-2r2',
        label: `2× Rotor Resistance (${formatNumber(r2 * 2, 2)} Ω)`,
        color: '#D97706',
        dashed: true,
        strokeWidth: 1.8,
        points: d.points.map((pt) => ({
          x: pt.speedRpm,
          y: pt.torqueDoubleR2Nm,
          tooltipTitle: `2×R₂ Curve · ${formatNumber(pt.speedRpm, 1)} RPM`,
          tooltipRows: [
            { label: 'Torque (2×R₂)', value: `${formatNumber(pt.torqueDoubleR2Nm, 2)} N·m` },
            { label: 'Slip (s)', value: formatNumber(pt.slip, 3) },
          ],
        })),
      },
    ];

    const markers: PlotMarker[] = [
      {
        id: 'start-t',
        x: 0,
        y: d.startingTorqueNm,
        shape: 'diamond',
        color: '#D97706',
        label: `Start ${formatNumber(d.startingTorqueNm, 1)} N·m`,
        tooltipTitle: 'Locked-Rotor Starting Torque (s = 1)',
        tooltipRows: [{ label: 'T_start', value: `${formatNumber(d.startingTorqueNm, 2)} N·m` }],
      },
      {
        id: 'break-t',
        x: d.breakdownSpeedRpm,
        y: d.breakdownTorqueNm,
        shape: 'circle',
        color: '#DC2626',
        label: `Tmax ${formatNumber(d.breakdownTorqueNm, 1)} N·m`,
        tooltipTitle: 'Breakdown (Pull-Out) Torque',
        tooltipRows: [
          { label: 'T_max', value: `${formatNumber(d.breakdownTorqueNm, 2)} N·m` },
          { label: 'Breakdown Slip', value: formatNumber(d.breakdownSlip, 3) },
          { label: 'Speed', value: `${formatNumber(d.breakdownSpeedRpm, 1)} RPM` },
        ],
      },
      {
        id: 'rated-t',
        x: d.ratedSpeedRpm,
        y: d.ratedTorqueNm,
        shape: 'square',
        color: '#059669',
        label: `Rated (${formatNumber(d.ratedSpeedRpm, 0)} RPM)`,
        tooltipTitle: 'Rated Operating Point',
        tooltipRows: [
          { label: 'Rated Torque', value: `${formatNumber(d.ratedTorqueNm, 2)} N·m` },
          { label: 'Rated Speed', value: `${formatNumber(d.ratedSpeedRpm, 1)} RPM` },
          { label: 'Slip', value: formatNumber(ratedSlip, 3) },
        ],
      },
    ];

    const metrics: MetricReadout[] = [
      {
        label: 'Starting Torque (s=1)',
        value: formatNumber(d.startingTorqueNm, 2),
        unit: 'N·m',
        sublabel: `N_sync = ${formatNumber(d.synchronousSpeedRpm, 0)} RPM`,
      },
      {
        label: 'Breakdown Torque (Tmax)',
        value: formatNumber(d.breakdownTorqueNm, 2),
        unit: 'N·m',
        status: d.breakdownTorqueNm > d.ratedTorqueNm * 1.5 ? 'nominal' : 'warning',
        statusText: `s_max = ${formatNumber(d.breakdownSlip, 3)} (${formatNumber(d.breakdownSpeedRpm, 0)} RPM)`,
      },
      {
        label: 'Rated Operating Torque',
        value: formatNumber(d.ratedTorqueNm, 2),
        unit: 'N·m',
        sublabel: `${formatNumber(d.ratedSpeedRpm, 1)} RPM @ s=${formatNumber(ratedSlip, 3)}`,
      },
      {
        label: 'Speed Regulation',
        value: formatNumber(d.speedRegulationPct, 2),
        unit: '%',
        sublabel: '(N_nl − N_fl) / N_fl',
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Induction Motor Torque–Speed Characteristic"
            subtitle="Mechanical torque output from locked-rotor standstill (0 RPM) to synchronous speed"
            xLabel="Rotor Speed N (RPM)"
            yLabel="Electromagnetic Torque T (N·m)"
            xBounds={[0, d.synchronousSpeedRpm]}
            series={series}
            markers={markers}
            onExportCsv={() =>
              downloadCsv(
                'torque_speed.csv',
                ['Slip', 'Speed_RPM', 'Torque_Nm', 'Torque_2R2_Nm', 'Rotor_Current_A'],
                d.points.map((pt) => [pt.slip, pt.speedRpm, pt.torqueNm, pt.torqueDoubleR2Nm, pt.rotorCurrentA])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
        </div>
      </div>
    );
  }

  // 2. Transformer Efficiency Curve
  if (mode === 'transformer-efficiency' && txRes) {
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <NumericField
          id="tx-kva"
          label="Transformer Rating (S_rated)"
          value={ratedKva}
          onChange={setRatedKva}
          unit="kVA"
          min={1}
          step={10}
        />
        <NumericField
          id="tx-core"
          label="Core (Iron) Loss (Pi)"
          value={coreLossW}
          onChange={setCoreLossW}
          unit="W"
          min={0}
          step={50}
          slider
          sliderMin={50}
          sliderMax={3000}
        />
        <NumericField
          id="tx-cu"
          label="Full-Load Copper Loss (Pcu,FL)"
          value={cuLossW}
          onChange={setCuLossW}
          unit="W"
          min={10}
          step={50}
          slider
          sliderMin={100}
          sliderMax={5000}
        />
        <NumericField
          id="tx-pf"
          label="Load Power Factor (cos φ)"
          value={powerFactor}
          onChange={setPowerFactor}
          min={0.1}
          max={1}
          step={0.05}
          slider
          sliderMin={0.2}
          sliderMax={1}
        />
        <NumericField
          id="tx-load"
          label="Operating Load Fraction (x)"
          value={loadFraction}
          onChange={setLoadFraction}
          unit="pu"
          min={0.05}
          max={1.5}
          step={0.05}
          slider
          sliderMin={0.1}
          sliderMax={1.5}
        />
      </aside>
    );

    if (!txRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={txRes.error} />
          </div>
        </div>
      );
    }

    const d = txRes.data;
    const series: PlotSeries[] = [
      {
        id: 'tx-eff-pf',
        label: `Efficiency at cos φ = ${formatNumber(powerFactor, 2)}`,
        color: '#2563EB',
        areaFill: 'rgba(37, 99, 235, 0.08)',
        points: d.points.map((pt) => ({
          x: pt.loadPct,
          y: pt.efficiencyPct,
          tooltipTitle: `Load = ${formatNumber(pt.loadPct, 0)}% (${formatNumber(pt.outputKw, 2)} kW)`,
          tooltipRows: [
            { label: 'Efficiency η', value: `${formatNumber(pt.efficiencyPct, 3)}%` },
            { label: 'Core Loss', value: `${formatNumber(pt.coreLossW, 1)} W` },
            { label: 'Copper Loss', value: `${formatNumber(pt.copperLossW, 1)} W` },
            { label: 'Total Loss', value: `${formatNumber(pt.totalLossW, 1)} W` },
          ],
        })),
      },
      {
        id: 'tx-eff-unity',
        label: 'Unity Power Factor Reference (cos φ = 1.0)',
        color: '#0D9488',
        dashed: true,
        strokeWidth: 1.6,
        points: d.points.map((pt) => ({
          x: pt.loadPct,
          y: pt.unityPfEfficiencyPct,
          tooltipTitle: `Unity PF · Load = ${formatNumber(pt.loadPct, 0)}%`,
          tooltipRows: [
            { label: 'η (Unity PF)', value: `${formatNumber(pt.unityPfEfficiencyPct, 3)}%` },
          ],
        })),
      },
    ];

    const markers: PlotMarker[] = [
      {
        id: 'tx-max',
        x: d.maxEfficiencyLoadPct,
        y: d.maxEfficiencyPct,
        shape: 'diamond',
        color: '#D97706',
        label: `η_max ${formatNumber(d.maxEfficiencyPct, 2)}% @ ${formatNumber(d.maxEfficiencyLoadPct, 1)}%`,
        tooltipTitle: 'Maximum Efficiency Point (Pi = x²·Pcu)',
        tooltipRows: [
          { label: 'Max Efficiency', value: `${formatNumber(d.maxEfficiencyPct, 3)}%` },
          { label: 'Optimal Load', value: `${formatNumber(d.maxEfficiencyLoadPct, 2)}%` },
        ],
      },
      {
        id: 'tx-op',
        x: loadFraction * 100,
        y: d.operatingEfficiencyPct,
        shape: 'circle',
        color: '#059669',
        label: `Op ${formatNumber(d.operatingEfficiencyPct, 2)}%`,
        tooltipTitle: `Operating Load (${formatNumber(loadFraction * 100, 1)}%)`,
        tooltipRows: [
          { label: 'Efficiency', value: `${formatNumber(d.operatingEfficiencyPct, 3)}%` },
          { label: 'Output Power', value: `${formatNumber(d.operatingOutputKw, 2)} kW` },
          { label: 'Total Losses', value: `${formatNumber(d.operatingTotalLossW, 1)} W` },
        ],
      },
    ];

    const minY = Math.max(70, Math.floor(Math.min(...d.points.slice(8).map((p) => p.efficiencyPct)) - 2));

    const metrics: MetricReadout[] = [
      {
        label: `Efficiency at ${formatNumber(loadFraction * 100, 0)}% Load`,
        value: formatNumber(d.operatingEfficiencyPct, 3),
        unit: '%',
        status: d.operatingEfficiencyPct >= 96 ? 'nominal' : d.operatingEfficiencyPct >= 90 ? 'warning' : 'critical',
        statusText: `Output: ${formatNumber(d.operatingOutputKw, 2)} kW`,
      },
      {
        label: 'Max Efficiency (η_max)',
        value: formatNumber(d.maxEfficiencyPct, 3),
        unit: '%',
        sublabel: `Occurs at ${formatNumber(d.maxEfficiencyLoadPct, 1)}% load`,
      },
      {
        label: 'Optimal Load Fraction',
        value: formatNumber(d.maxEfficiencyLoadPct, 2),
        unit: '%',
        sublabel: '√(Pi / Pcu,FL)',
      },
      {
        label: 'Losses at Operating Load',
        value: formatNumber(d.operatingTotalLossW, 1),
        unit: 'W',
        sublabel: `Pi=${formatNumber(d.operatingCoreLossW, 0)}W · Pcu=${formatNumber(d.operatingCopperLossW, 0)}W`,
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="Transformer Efficiency vs. Load Percentage"
            subtitle="Efficiency η(%) across 1%–150% full-load kVA with unity power factor comparison"
            xLabel="Percentage of Full-Load kVA (%)"
            yLabel="Efficiency η (%)"
            xBounds={[0, 150]}
            yBounds={[minY, 100]}
            series={series}
            markers={markers}
            onExportCsv={() =>
              downloadCsv(
                'transformer_efficiency.csv',
                ['Load_pct', 'Efficiency_pct', 'UnityPF_Eff_pct', 'CoreLoss_W', 'CopperLoss_W'],
                d.points.map((pt) => [
                  pt.loadPct,
                  pt.efficiencyPct,
                  pt.unityPfEfficiencyPct,
                  pt.coreLossW,
                  pt.copperLossW,
                ])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
        </div>
      </div>
    );
  }

  // 3. 2nd-Order Step Response Envelope
  if (mode === 'step-response' && stepRes) {
    const controls = (
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
        <NumericField
          id="step-zeta"
          label="Damping Ratio (ζ)"
          value={zeta}
          onChange={setZeta}
          min={0}
          step={0.05}
          slider
          sliderMin={0}
          sliderMax={2.2}
          helperText="ζ = 0 undamped · 0 < ζ < 1 underdamped · ζ = 1 critical · ζ > 1 overdamped"
        />
        <NumericField
          id="step-wn"
          label="Natural Frequency (ωn)"
          value={omegaN}
          onChange={setOmegaN}
          unit="rad/s"
          min={0.1}
          step={0.5}
          slider
          sliderMin={0.5}
          sliderMax={20}
        />
        <NumericField
          id="step-amp"
          label="Step Input Amplitude (A)"
          value={amplitude}
          onChange={setAmplitude}
          step={0.5}
        />
      </aside>
    );

    if (!stepRes.ok) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
          {controls}
          <div>
            <ErrorBanner message={stepRes.error} />
          </div>
        </div>
      );
    }

    const d = stepRes.data;
    const series: PlotSeries[] = [
      {
        id: 'step-y',
        label: `Step Response y(t) (${d.regime})`,
        color: '#2563EB',
        strokeWidth: 2.4,
        points: d.points.map((pt) => ({
          x: pt.timeSec,
          y: pt.response,
          tooltipTitle: `t = ${formatNumber(pt.timeSec, 3)} s`,
          tooltipRows: [
            { label: 'Response y(t)', value: formatNumber(pt.response, 4) },
            ...(pt.upperEnvelope !== null
              ? [{ label: 'Upper Envelope', value: formatNumber(pt.upperEnvelope, 4) }]
              : []),
            ...(pt.lowerEnvelope !== null
              ? [{ label: 'Lower Envelope', value: formatNumber(pt.lowerEnvelope, 4) }]
              : []),
            { label: 'Target Steady-State', value: formatNumber(d.steadyStateValue, 4) },
          ],
        })),
      },
    ];

    if (d.points.some((p) => p.upperEnvelope !== null)) {
      series.push(
        {
          id: 'env-upper',
          label: 'Decay Envelope Bounds',
          color: '#D97706',
          dashed: true,
          strokeWidth: 1.4,
          interactive: false,
          points: d.points
            .filter((p) => p.upperEnvelope !== null)
            .map((p) => ({ x: p.timeSec, y: p.upperEnvelope!, tooltipRows: [] })),
        },
        {
          id: 'env-lower',
          label: '',
          color: '#D97706',
          dashed: true,
          strokeWidth: 1.4,
          interactive: false,
          points: d.points
            .filter((p) => p.lowerEnvelope !== null)
            .map((p) => ({ x: p.timeSec, y: p.lowerEnvelope!, tooltipRows: [] })),
        }
      );
    }

    const markers: PlotMarker[] = [];
    if (d.peakTimeSec !== null && d.regime !== 'Overdamped' && d.regime !== 'Critically Damped') {
      const peakVal = amplitude * (1 + d.percentOvershoot / 100);
      markers.push({
        id: 'peak-m',
        x: d.peakTimeSec,
        y: peakVal,
        shape: 'diamond',
        color: '#DC2626',
        label: `tp=${formatNumber(d.peakTimeSec, 2)}s`,
        tooltipTitle: 'Peak Overshoot Point',
        tooltipRows: [
          { label: 'Peak Time (tp)', value: `${formatNumber(d.peakTimeSec, 4)} s` },
          { label: 'Peak Value', value: formatNumber(peakVal, 4) },
          { label: '% Overshoot', value: `${formatNumber(d.percentOvershoot, 2)}%` },
        ],
      });
    }
    if (d.settlingTimeSec !== null) {
      markers.push({
        id: 'settle-m',
        x: d.settlingTimeSec,
        y: amplitude,
        shape: 'square',
        color: '#059669',
        label: `ts=${formatNumber(d.settlingTimeSec, 2)}s`,
        tooltipTitle: '2% Settling Time',
        tooltipRows: [
          { label: 'Settling Time (ts)', value: `${formatNumber(d.settlingTimeSec, 4)} s` },
          { label: '±2% Band', value: `${formatNumber(amplitude * 0.98, 3)} – ${formatNumber(amplitude * 1.02, 3)}` },
        ],
      });
    }

    const metrics: MetricReadout[] = [
      {
        label: 'Percent Overshoot (%OS)',
        value: formatNumber(d.percentOvershoot, 2),
        unit: '%',
        status: d.regime === 'Undamped' ? 'critical' : d.percentOvershoot <= 16 ? 'nominal' : 'warning',
        statusText: d.regime,
      },
      {
        label: 'Rise Time (tr, 10%→90%)',
        value: d.riseTimeSec !== null ? formatNumber(d.riseTimeSec, 3) : '—',
        unit: d.riseTimeSec !== null ? 's' : undefined,
        sublabel: d.dampedFreqRad ? `ωd = ${formatNumber(d.dampedFreqRad, 3)} rad/s` : 'Real poles only',
      },
      {
        label: 'Peak Time (tp)',
        value: d.peakTimeSec !== null ? formatNumber(d.peakTimeSec, 3) : '—',
        unit: d.peakTimeSec !== null ? 's' : undefined,
        sublabel: d.peakTimeSec !== null ? 'First overshoot crest' : 'No overshoot',
      },
      {
        label: 'Settling Time (ts, 2%)',
        value: d.settlingTimeSec !== null ? formatNumber(d.settlingTimeSec, 3) : '∞',
        unit: d.settlingTimeSec !== null ? 's' : undefined,
        sublabel: `Steady state = ${formatNumber(d.steadyStateValue, 2)}`,
      },
    ];

    const stepSampleRows = d.points
      .filter((_, i) => i % 30 === 0 || i === d.points.length - 1)
      .map((pt) => [
        formatNumber(pt.timeSec, 3),
        formatNumber(pt.response, 4),
        pt.upperEnvelope !== null ? formatNumber(pt.upperEnvelope, 4) : '—',
        pt.lowerEnvelope !== null ? formatNumber(pt.lowerEnvelope, 4) : '—',
      ]);

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_1fr]">
        {controls}
        <div className="min-w-0 space-y-4">
          <EngineeringPlot
            title="2nd-Order Step Response & Decay Envelope"
            subtitle="Time-domain response y(t) with exponential decay bounds & ±2% settling band"
            xLabel="Time t (seconds)"
            yLabel="Output Amplitude y(t)"
            xBounds={[0, d.tMaxSec]}
            series={series}
            markers={markers}
            regions={[
              {
                id: 'settling-band',
                xMin: 0,
                xMax: d.tMaxSec,
                yMin: amplitude * 0.98,
                yMax: amplitude * 1.02,
                fill: 'rgba(16, 185, 129, 0.10)',
                label: '±2% Settling Band',
              },
            ]}
            onExportCsv={() =>
              downloadCsv(
                'step_response.csv',
                ['Time_s', 'Response_y', 'Upper_Envelope', 'Lower_Envelope'],
                d.points.map((pt) => [
                  pt.timeSec,
                  pt.response,
                  pt.upperEnvelope ?? '',
                  pt.lowerEnvelope ?? '',
                ])
              )
            }
          />
          <MetricsGrid metrics={metrics} />
          <DataTable
            caption="Time-Domain Trajectory Samples"
            headers={['Time (s)', 'y(t)', 'Upper Env', 'Lower Env']}
            rows={stepSampleRows}
          />
        </div>
      </div>
    );
  }

  return null;
};
