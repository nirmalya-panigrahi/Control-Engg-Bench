import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { SAMPLE_PROCESS_CSVS } from '../../data/instruments';
import {
  computePidRecommendations,
  fitFopdtModel,
  parseStepResponseCsv,
  simulateClosedLoopPid,
  type PidRuleId,
} from '../../math/pidTuner';
import type { MetricReadout } from '../../types/bench';
import { downloadCsv, formatNumber } from '../../utils/format';
import { EngineeringPlot, type PlotSeries } from '../charts/EngineeringPlot';
import { ErrorBanner } from '../ui/ErrorBanner';
import { MetricsGrid } from '../ui/MetricsGrid';
import { NumericField } from '../ui/NumericField';

export const PidTunerBench: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceName, setSourceName] = useState<string>(SAMPLE_PROCESS_CSVS[0].name);
  const [csvText, setCsvText] = useState<string>(SAMPLE_PROCESS_CSVS[0].csvText);
  const [showRawCsv, setShowRawCsv] = useState<boolean>(false);
  const [stepAmplitude, setStepAmplitude] = useState<number>(SAMPLE_PROCESS_CSVS[0].stepAmplitude);
  const [useCustomStepAmp, setUseCustomStepAmp] = useState<boolean>(false);

  // IMC tuning aggressiveness & active rule
  const [selectedRule, setSelectedRule] = useState<PidRuleId>('imc');
  const [imcLambdaRatio, setImcLambdaRatio] = useState<number>(0.5);

  // Active controller parameters to simulate before applying
  const [kc, setKc] = useState<number>(0.5);
  const [ti, setTi] = useState<number>(4.0);
  const [td, setTd] = useState<number>(0.3);
  const [setpointStep, setSetpointStep] = useState<number>(1.0);
  const [disturbanceStep, setDisturbanceStep] = useState<number>(-0.2);
  const [uMin, setUMin] = useState<number>(-20);
  const [uMax, setUMax] = useState<number>(20);
  const [appliedConfig, setAppliedConfig] = useState<{
    ruleLabel: string;
    kc: number;
    ti: number;
    td: number;
  } | null>(null);

  const parsedRes = useMemo(
    () => parseStepResponseCsv(csvText, useCustomStepAmp ? stepAmplitude : undefined),
    [csvText, useCustomStepAmp, stepAmplitude]
  );

  const modelRes = useMemo(() => {
    if (!parsedRes.ok) return null;
    return fitFopdtModel(
      parsedRes.data,
      parsedRes.data.detectedStepTime,
      useCustomStepAmp ? stepAmplitude : parsedRes.data.detectedDeltaU
    );
  }, [parsedRes, useCustomStepAmp, stepAmplitude]);

  const recommendations = useMemo(() => {
    if (!modelRes || !modelRes.ok) return [];
    const lambda = Math.max(0.05 * modelRes.data.tau, imcLambdaRatio * modelRes.data.tau);
    return computePidRecommendations(modelRes.data, lambda);
  }, [modelRes, imcLambdaRatio]);

  // Sync active PID gains whenever model or selected rule changes (unless user explicitly edits manually)
  useEffect(() => {
    const rec = recommendations.find((r) => r.id === selectedRule);
    if (rec) {
      setKc(Number(rec.kc.toPrecision(5)));
      setTi(Number(rec.ti.toPrecision(5)));
      setTd(Number(rec.td.toPrecision(5)));
    }
  }, [recommendations, selectedRule]);

  const simRes = useMemo(() => {
    if (!modelRes || !modelRes.ok) return null;
    return simulateClosedLoopPid({
      model: modelRes.data,
      kc,
      ti,
      td,
      setpointStep,
      disturbanceStep,
      uMin,
      uMax,
    });
  }, [modelRes, kc, ti, td, setpointStep, disturbanceStep, uMin, uMax]);

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setSourceName(file.name);
    setCsvText(text);
    setUseCustomStepAmp(false);
    setAppliedConfig(null);
  };

  const handleLoadSample = (idx: number) => {
    const sample = SAMPLE_PROCESS_CSVS[idx];
    if (!sample) return;
    setSourceName(sample.name);
    setCsvText(sample.csvText);
    setStepAmplitude(sample.stepAmplitude);
    setUseCustomStepAmp(false);
    setAppliedConfig(null);
  };

  const handleSelectRule = (ruleId: PidRuleId) => {
    setSelectedRule(ruleId);
    const rec = recommendations.find((r) => r.id === ruleId);
    if (rec) {
      setKc(Number(rec.kc.toPrecision(5)));
      setTi(Number(rec.ti.toPrecision(5)));
      setTd(Number(rec.td.toPrecision(5)));
    }
    setAppliedConfig(null);
  };

  const handleApplySettings = () => {
    const activeRuleName =
      recommendations.find((r) => r.id === selectedRule)?.name ?? 'Custom PID';
    setAppliedConfig({
      ruleLabel: activeRuleName,
      kc,
      ti,
      td,
    });
  };

  const controls = (
    <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0F1522]">
      {/* CSV Upload Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            01. Step-Response CSV Input
          </span>
          <button
            type="button"
            onClick={() => setShowRawCsv((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-sky-400"
          >
            <FileText className="h-3 w-3" />
            {showRawCsv ? 'Hide CSV' : 'Paste / Edit CSV'}
          </button>
        </div>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileUpload(e.dataTransfer.files?.[0]);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-sky-400 dark:hover:bg-sky-950/20"
        >
          <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Upload CSV file (t, y [, u])
          </span>
          <span className="max-w-full truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Active: {sourceName}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            aria-label="Upload step response CSV"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            className="sr-only"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_PROCESS_CSVS.map((sample, idx) => (
            <button
              key={sample.name}
              type="button"
              onClick={() => handleLoadSample(idx)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {sample.name}
            </button>
          ))}
        </div>

        {showRawCsv && (
          <textarea
            aria-label="Raw CSV data"
            rows={6}
            value={csvText}
            onChange={(e) => {
              setSourceName('Custom Pasted CSV');
              setCsvText(e.target.value);
              setAppliedConfig(null);
            }}
            className="w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        )}

        <NumericField
          id="csv-step-amp"
          label="Step Input Δu"
          value={
            useCustomStepAmp
              ? stepAmplitude
              : parsedRes.ok
                ? parsedRes.data.detectedDeltaU
                : stepAmplitude
          }
          onChange={(v) => {
            setUseCustomStepAmp(true);
            setStepAmplitude(v);
          }}
          step={0.5}
          helperText={
            parsedRes.ok && parsedRes.data.hasInputColumn && !useCustomStepAmp
              ? 'Auto-detected from 3rd CSV column (u).'
              : 'Amplitude of input step used to scale process gain Kp.'
          }
        />
      </div>

      {/* Tuning Rule & IMC Aggressiveness */}
      <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
          02. Recommended Tuning Rules
        </span>

        <NumericField
          id="imc-lambda"
          label="IMC Filter Ratio (λ / τ)"
          value={imcLambdaRatio}
          onChange={setImcLambdaRatio}
          min={0.1}
          max={2.0}
          step={0.05}
          slider
          sliderMin={0.15}
          sliderMax={1.5}
          helperText="Lower λ = faster response; higher λ = smoother robustness."
        />

        <div className="grid grid-cols-1 gap-1.5">
          {recommendations.map((rec) => {
            const active = selectedRule === rec.id;
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => handleSelectRule(rec.id)}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-950 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="font-medium">{rec.name}</span>
                <span className="font-mono text-[11px] tabular-nums opacity-85">
                  Kc={formatNumber(rec.kc, 2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Simulator Gains */}
      <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
          03. Pre-Apply Closed-Loop Simulator
        </span>

        <div className="grid grid-cols-1 gap-2.5">
          <NumericField
            id="pid-kc"
            label="Proportional Gain (Kc)"
            value={kc}
            onChange={(v) => {
              setKc(v);
              setAppliedConfig(null);
            }}
            step={0.1}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <NumericField
              id="pid-ti"
              label="Integral (Ti)"
              value={ti}
              onChange={(v) => {
                setTi(v);
                setAppliedConfig(null);
              }}
              unit="s"
              min={0.01}
              step={0.2}
            />
            <NumericField
              id="pid-td"
              label="Derivative (Td)"
              value={td}
              onChange={(v) => {
                setTd(v);
                setAppliedConfig(null);
              }}
              unit="s"
              min={0}
              step={0.05}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <NumericField
            id="pid-sp"
            label="Setpoint Step"
            value={setpointStep}
            onChange={setSetpointStep}
            step={0.5}
          />
          <NumericField
            id="pid-dist"
            label="Load Disturbance"
            value={disturbanceStep}
            onChange={setDisturbanceStep}
            step={0.1}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <NumericField
            id="pid-umin"
            label="Actuator u_min"
            value={uMin}
            onChange={setUMin}
            step={5}
          />
          <NumericField
            id="pid-umax"
            label="Actuator u_max"
            value={uMax}
            onChange={setUMax}
            step={5}
          />
        </div>

        <button
          type="button"
          onClick={handleApplySettings}
          disabled={!simRes || !simRes.ok}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
        >
          <CheckCircle2 className="h-4 w-4" />
          Apply PID Settings
        </button>
      </div>
    </aside>
  );

  // Error states for CSV parsing or model fitting
  if (!parsedRes.ok) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        {controls}
        <div>
          <ErrorBanner message={parsedRes.error} />
        </div>
      </div>
    );
  }

  if (modelRes && !modelRes.ok) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        {controls}
        <div>
          <ErrorBanner message={modelRes.error} />
        </div>
      </div>
    );
  }

  if (!modelRes || !modelRes.ok) return null;
  const model = modelRes.data;

  const fitSeries: PlotSeries[] = [
    {
      id: 'csv-measured',
      label: 'Measured CSV Step Response',
      color: '#64748B',
      strokeWidth: 1.8,
      dashed: true,
      points: model.fittedPoints.map((pt) => ({
        x: pt.t,
        y: pt.measured,
        tooltipTitle: `Sample t = ${formatNumber(pt.t, 2)} s`,
        tooltipRows: [
          { label: 'Measured y', value: formatNumber(pt.measured, 3) },
          { label: 'FOPDT Fit ŷ', value: formatNumber(pt.fitted, 3) },
          { label: 'Residual', value: formatNumber(pt.residual, 4) },
        ],
      })),
    },
    {
      id: 'fopdt-fit',
      label: `Fitted FOPDT (Kp=${formatNumber(model.kp, 2)}, τ=${formatNumber(model.tau, 2)}s, θ=${formatNumber(model.theta, 2)}s)`,
      color: '#2563EB',
      strokeWidth: 2.5,
      points: model.fittedPoints.map((pt) => ({
        x: pt.t,
        y: pt.fitted,
        tooltipTitle: `Model Fit t = ${formatNumber(pt.t, 2)} s`,
        tooltipRows: [
          { label: 'Fitted ŷ(t)', value: formatNumber(pt.fitted, 3) },
          { label: 'Measured y', value: formatNumber(pt.measured, 3) },
          { label: 'Residual', value: formatNumber(pt.residual, 4) },
        ],
      })),
    },
  ];

  const modelMetrics: MetricReadout[] = [
    {
      label: 'Process Gain (Kp)',
      value: formatNumber(model.kp, 3),
      sublabel: `Δy=${formatNumber(model.yFinal - model.y0, 2)} / Δu=${formatNumber(model.deltaU, 2)}`,
    },
    {
      label: 'Time Constant (τ)',
      value: formatNumber(model.tau, 3),
      unit: 's',
      sublabel: `63.2% rise time constant`,
    },
    {
      label: 'Dead Time (θ)',
      value: formatNumber(model.theta, 3),
      unit: 's',
      sublabel: `Ratio θ/τ = ${formatNumber(model.theta / model.tau, 3)}`,
    },
    {
      label: 'Model Fit (R²)',
      value: formatNumber(model.rSquared, 4),
      status: model.rSquared >= 0.95 ? 'nominal' : model.rSquared >= 0.85 ? 'warning' : 'critical',
      statusText: `RMSE = ${formatNumber(model.rmse, 3)} (${formatNumber(model.nrmsePct, 2)}%)`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      {controls}

      <div className="min-w-0 space-y-4">
        {appliedConfig && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Applied {appliedConfig.ruleLabel}:</strong>{' '}
                <span className="font-mono tabular-nums">
                  Kc = {formatNumber(appliedConfig.kc, 4)} · Ti = {formatNumber(appliedConfig.ti, 4)} s · Td ={' '}
                  {formatNumber(appliedConfig.td, 4)} s
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'pid_applied_settings.csv',
                  ['Rule', 'Kc', 'Ti_s', 'Td_s', 'Kp_parallel', 'Ki_parallel', 'Kd_parallel', 'Model_Kp', 'Model_Tau_s', 'Model_Theta_s'],
                  [
                    [
                      appliedConfig.ruleLabel,
                      appliedConfig.kc,
                      appliedConfig.ti,
                      appliedConfig.td,
                      appliedConfig.kc,
                      appliedConfig.kc / appliedConfig.ti,
                      appliedConfig.kc * appliedConfig.td,
                      model.kp,
                      model.tau,
                      model.theta,
                    ],
                  ]
                )
              }
              className="rounded border border-emerald-400 bg-white px-2.5 py-1 font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
            >
              Export Tuned PID CSV
            </button>
          </div>
        )}

        {/* Plot 1: Step Response & FOPDT Identification */}
        <EngineeringPlot
          title="Open-Loop Step Response & FOPDT Model Fit"
          subtitle={`Identified Gp(s) = ${formatNumber(model.kp, 3)}·e^(−${formatNumber(model.theta, 2)}s) / (${formatNumber(model.tau, 2)}s + 1)`}
          xLabel="Time t (s)"
          yLabel="Process Output y(t)"
          heightPx={310}
          series={fitSeries}
          onExportCsv={() =>
            downloadCsv(
              'fopdt_model_fit.csv',
              ['Time_s', 'Measured_y', 'Fitted_y', 'Residual'],
              model.fittedPoints.map((pt) => [pt.t, pt.measured, pt.fitted, pt.residual])
            )
          }
        />

        <MetricsGrid metrics={modelMetrics} />

        {/* Plot 2: Closed-Loop Pre-Apply Simulation */}
        {simRes && !simRes.ok ? (
          <ErrorBanner message={simRes.error} />
        ) : simRes && simRes.ok ? (
          <>
            <EngineeringPlot
              title="Closed-Loop PID Simulation (Pre-Apply Verification)"
              subtitle="Simulated setpoint tracking and mid-run load disturbance rejection with anti-windup"
              xLabel="Simulation Time t (s)"
              yLabel="Closed-Loop Response Δy(t)"
              heightPx={330}
              series={[
                {
                  id: 'cl-sp',
                  label: 'Setpoint r(t)',
                  color: '#64748B',
                  dashed: true,
                  strokeWidth: 1.6,
                  interactive: false,
                  points: simRes.data.points.map((pt) => ({
                    x: pt.t,
                    y: pt.setpoint,
                    tooltipRows: [],
                  })),
                },
                {
                  id: 'cl-output',
                  label: `Closed-Loop Output y(t) (Kc=${formatNumber(kc, 2)}, Ti=${formatNumber(ti, 2)}s, Td=${formatNumber(td, 2)}s)`,
                  color: '#059669',
                  strokeWidth: 2.4,
                  points: simRes.data.points.map((pt) => ({
                    x: pt.t,
                    y: pt.output,
                    tooltipTitle: `t = ${formatNumber(pt.t, 2)} s`,
                    tooltipRows: [
                      { label: 'Process Δy', value: formatNumber(pt.output, 4) },
                      { label: 'Setpoint r', value: formatNumber(pt.setpoint, 3) },
                      { label: 'Error e(t)', value: formatNumber(pt.error, 4) },
                      { label: 'Control u(t)', value: formatNumber(pt.controlSignal, 3) },
                    ],
                  })),
                },
              ]}
              onExportCsv={() =>
                downloadCsv(
                  'pid_closed_loop_sim.csv',
                  ['Time_s', 'Setpoint', 'Output', 'Error', 'Control_u', 'Disturbance'],
                  simRes.data.points.map((pt) => [
                    pt.t,
                    pt.setpoint,
                    pt.output,
                    pt.error,
                    pt.controlSignal,
                    pt.disturbance,
                  ])
                )
              }
            />

            <MetricsGrid
              metrics={[
                {
                  label: 'Closed-Loop Stability',
                  value: simRes.data.stabilityLabel,
                  status:
                    simRes.data.stabilityLabel === 'Stable'
                      ? 'nominal'
                      : simRes.data.stabilityLabel === 'Oscillatory'
                        ? 'warning'
                        : 'critical',
                  statusText: `Overshoot: ${formatNumber(simRes.data.percentOvershoot, 2)}%`,
                },
                {
                  label: 'Settling Time (2%)',
                  value:
                    simRes.data.settlingTimeSec !== null
                      ? formatNumber(simRes.data.settlingTimeSec, 2)
                      : '—',
                  unit: simRes.data.settlingTimeSec !== null ? 's' : undefined,
                  sublabel:
                    simRes.data.riseTimeSec !== null
                      ? `Rise time: ${formatNumber(simRes.data.riseTimeSec, 2)} s`
                      : 'Did not cross 90%',
                },
                {
                  label: 'Integral Abs Error (IAE)',
                  value: formatNumber(simRes.data.iae, 3),
                  sublabel: 'Lower indicates tighter tracking',
                },
                {
                  label: 'Control Effort Peak',
                  value: formatNumber(simRes.data.peakControlSignal, 2),
                  sublabel: `Range: [${formatNumber(simRes.data.minControlSignal, 2)}, ${formatNumber(simRes.data.peakControlSignal, 2)}]`,
                },
              ]}
            />
          </>
        ) : null}

        {/* Recommended Rules Comparison Table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F1522]">
          <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              PID Tuning Rule Recommendations (Click Load to Simulate)
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs tabular-nums">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-sans font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Kc</th>
                  <th className="px-3 py-2 font-medium">Ti (s)</th>
                  <th className="px-3 py-2 font-medium">Td (s)</th>
                  <th className="px-3 py-2 font-medium">Parallel (Kp / Ki / Kd)</th>
                  <th className="px-3 py-2 text-right font-sans font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {recommendations.map((rec) => {
                  const isCurrent = selectedRule === rec.id;
                  return (
                    <tr
                      key={rec.id}
                      className={
                        isCurrent
                          ? 'bg-blue-50/60 dark:bg-sky-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="px-4 py-2.5 font-sans">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {rec.notes}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{formatNumber(rec.kc, 3)}</td>
                      <td className="px-3 py-2.5">{formatNumber(rec.ti, 3)}</td>
                      <td className="px-3 py-2.5">{formatNumber(rec.td, 3)}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {formatNumber(rec.kpParallel, 2)} / {formatNumber(rec.kiParallel, 3)} /{' '}
                        {formatNumber(rec.kdParallel, 2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => handleSelectRule(rec.id)}
                          className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                            isCurrent
                              ? 'border-blue-600 bg-blue-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          {isCurrent ? 'Loaded' : 'Simulate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
