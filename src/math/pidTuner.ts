import type { ValidationResult } from '../types/bench';

export interface StepCsvRow {
  t: number;
  y: number;
  u?: number;
}

export interface ParsedStepDataset {
  rows: StepCsvRow[];
  hasInputColumn: boolean;
  detectedStepTime: number;
  detectedDeltaU: number;
}

export interface FopdtModel {
  kp: number; // Process gain (dy / du)
  tau: number; // Time constant (s)
  theta: number; // Dead time (s)
  y0: number; // Initial baseline output
  yFinal: number; // Final steady-state output
  stepTime: number; // Step onset time (s)
  deltaU: number; // Step input magnitude
  rSquared: number; // Coefficient of determination
  rmse: number; // Root mean squared error
  nrmsePct: number; // Normalized RMSE (% of output span)
  fittedPoints: Array<{ t: number; measured: number; fitted: number; residual: number }>;
}

export type PidRuleId = 'zn' | 'imc' | 'cohen-coon' | 'simc' | 'amigo';

export interface PidTuningRecommendation {
  id: PidRuleId;
  name: string;
  notes: string;
  kc: number; // Proportional gain (standard ISA)
  ti: number; // Integral time (s)
  td: number; // Derivative time (s)
  kpParallel: number;
  kiParallel: number;
  kdParallel: number;
}

export interface ClosedLoopPoint {
  t: number;
  setpoint: number;
  output: number;
  controlSignal: number;
  error: number;
  disturbance: number;
}

export interface ClosedLoopSimOutput {
  points: ClosedLoopPoint[];
  percentOvershoot: number;
  riseTimeSec: number | null;
  settlingTimeSec: number | null;
  iae: number;
  peakControlSignal: number;
  minControlSignal: number;
  isStable: boolean;
  stabilityLabel: 'Stable' | 'Oscillatory' | 'Unstable';
}

export function parseStepResponseCsv(
  csvText: string,
  overrideDeltaU?: number
): ValidationResult<ParsedStepDataset> {
  if (!csvText || !csvText.trim()) {
    return { ok: false, error: 'CSV input is empty. Upload or select a step-response CSV file.' };
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 6) {
    return {
      ok: false,
      error: 'Step-response CSV must contain at least 6 numeric data rows.',
    };
  }

  const rows: StepCsvRow[] = [];
  let hasInputColumn = false;

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,;\t]+/).map((p) => p.trim());
    if (parts.length < 2) continue;

    const t = Number(parts[0]);
    const y = Number(parts[1]);
    const hasU = parts.length >= 3 && parts[2] !== '';
    const u = hasU ? Number(parts[2]) : undefined;

    if (!Number.isFinite(t) || !Number.isFinite(y) || (hasU && !Number.isFinite(u))) {
      // Allow a header row at the top of the file; reject non-numeric data mid-file
      if (i === 0 && rows.length === 0) continue;
      return {
        ok: false,
        error: `Invalid non-numeric value on CSV line ${i + 1}: "${lines[i]}".`,
      };
    }

    if (hasU) hasInputColumn = true;
    rows.push({ t, y, u });
  }

  if (rows.length < 6) {
    return {
      ok: false,
      error: 'Found fewer than 6 valid numeric (time, output) rows in CSV.',
    };
  }

  // Verify strictly increasing timestamps
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].t <= rows[i - 1].t) {
      return {
        ok: false,
        error: `Timestamps must be strictly increasing (row ${i + 1}: t=${rows[i].t} ≤ ${rows[i - 1].t}).`,
      };
    }
  }

  let detectedStepTime = rows[0].t;
  let detectedDeltaU = overrideDeltaU ?? 1;

  if (hasInputColumn && rows.every((r) => r.u !== undefined)) {
    const u0 = rows[0].u!;
    const uEnd = rows[rows.length - 1].u!;
    const diff = uEnd - u0;
    if (Math.abs(diff) > 1e-9) {
      detectedDeltaU = overrideDeltaU !== undefined ? overrideDeltaU : diff;
      const stepRow = rows.find((r) => Math.abs(r.u! - u0) > 0.1 * Math.abs(diff));
      if (stepRow) {
        detectedStepTime = stepRow.t;
      }
    }
  }

  if (!Number.isFinite(detectedDeltaU) || Math.abs(detectedDeltaU) < 1e-12) {
    return {
      ok: false,
      error: 'Step input magnitude Δu must be non-zero.',
    };
  }

  return {
    ok: true,
    data: {
      rows,
      hasInputColumn,
      detectedStepTime,
      detectedDeltaU,
    },
  };
}

function evalFopdt(
  t: number,
  y0: number,
  kp: number,
  tau: number,
  theta: number,
  stepTime: number,
  deltaU: number
): number {
  const dt = t - stepTime - theta;
  if (dt <= 0) return y0;
  return y0 + kp * deltaU * (1 - Math.exp(-dt / tau));
}

function interpolateCrossingTime(
  rows: StepCsvRow[],
  targetY: number,
  increasing: boolean
): number | null {
  for (let i = 1; i < rows.length; i++) {
    const yPrev = rows[i - 1].y;
    const yCurr = rows[i].y;
    const crossed = increasing
      ? yPrev < targetY && yCurr >= targetY
      : yPrev > targetY && yCurr <= targetY;
    if (crossed && Math.abs(yCurr - yPrev) > 1e-12) {
      const frac = (targetY - yPrev) / (yCurr - yPrev);
      return rows[i - 1].t + frac * (rows[i].t - rows[i - 1].t);
    }
  }
  return null;
}

export function fitFopdtModel(
  dataset: ParsedStepDataset,
  customStepTime?: number,
  customDeltaU?: number
): ValidationResult<FopdtModel> {
  const { rows } = dataset;
  const deltaU = customDeltaU ?? dataset.detectedDeltaU;
  const stepTime = customStepTime ?? dataset.detectedStepTime;

  if (!Number.isFinite(deltaU) || Math.abs(deltaU) < 1e-12) {
    return { ok: false, error: 'Step input magnitude Δu must be finite and non-zero.' };
  }
  if (!Number.isFinite(stepTime) || stepTime < rows[0].t || stepTime >= rows[rows.length - 1].t) {
    return {
      ok: false,
      error: `Step onset time must lie within [${rows[0].t}, ${rows[rows.length - 1].t}).`,
    };
  }

  // Initial steady-state y0: mean of points <= stepTime (or first point)
  const preRows = rows.filter((r) => r.t <= stepTime + 1e-9);
  const y0 =
    preRows.length > 0
      ? preRows.reduce((s, r) => s + r.y, 0) / preRows.length
      : rows[0].y;

  // Final steady-state yFinal: mean of last max(2, 10%) points
  const tailCount = Math.max(2, Math.floor(rows.length * 0.1));
  const tailRows = rows.slice(-tailCount);
  const yFinal = tailRows.reduce((s, r) => s + r.y, 0) / tailRows.length;

  const totalDy = yFinal - y0;
  if (Math.abs(totalDy) < 1e-9) {
    return {
      ok: false,
      error: 'Process output shows negligible steady-state change (Δy ≈ 0). Cannot fit FOPDT model.',
    };
  }

  const totalSpanT = rows[rows.length - 1].t - stepTime;
  const increasing = totalDy > 0;

  // Stage 1: Smith two-point initial estimate (28.3% & 63.2%)
  const y28 = y0 + 0.283 * totalDy;
  const y63 = y0 + 0.632 * totalDy;
  const postRows = rows.filter((r) => r.t >= stepTime);

  const t28 = interpolateCrossingTime(postRows, y28, increasing);
  const t63 = interpolateCrossingTime(postRows, y63, increasing);

  let kp = totalDy / deltaU;
  let tau = t28 !== null && t63 !== null ? Math.max(0.05 * totalSpanT, 1.5 * (t63 - t28)) : totalSpanT * 0.3;
  let theta =
    t63 !== null
      ? Math.max(0, t63 - stepTime - tau)
      : Math.max(0, totalSpanT * 0.05);

  const computeSse = (k: number, ta: number, th: number): number => {
    let sse = 0;
    for (const r of rows) {
      const pred = evalFopdt(r.t, y0, k, ta, th, stepTime, deltaU);
      const err = r.y - pred;
      sse += err * err;
    }
    return sse;
  };

  // Stage 2: Multi-scale coordinate pattern search refinement of (Kp, tau, theta)
  let bestSse = computeSse(kp, tau, theta);
  let stepK = Math.max(Math.abs(kp) * 0.15, 1e-4);
  let stepTau = Math.max(tau * 0.25, 1e-3);
  let stepTheta = Math.max(totalSpanT * 0.08, 1e-3);

  for (let round = 0; round < 18; round++) {
    let improved = true;
    let iter = 0;
    while (improved && iter < 20) {
      improved = false;
      iter++;

      // Try Kp steps
      for (const dir of [-1, 1]) {
        const candK = kp + dir * stepK;
        if (Math.sign(candK) !== Math.sign(kp)) continue;
        const sse = computeSse(candK, tau, theta);
        if (sse < bestSse - 1e-12) {
          bestSse = sse;
          kp = candK;
          improved = true;
        }
      }

      // Try tau steps
      for (const dir of [-1, 1]) {
        const candTau = Math.max(1e-3, tau + dir * stepTau);
        const sse = computeSse(kp, candTau, theta);
        if (sse < bestSse - 1e-12) {
          bestSse = sse;
          tau = candTau;
          improved = true;
        }
      }

      // Try theta steps
      for (const dir of [-1, 1]) {
        const candTheta = Math.max(0, Math.min(totalSpanT * 0.9, theta + dir * stepTheta));
        const sse = computeSse(kp, tau, candTheta);
        if (sse < bestSse - 1e-12) {
          bestSse = sse;
          theta = candTheta;
          improved = true;
        }
      }
    }
    stepK *= 0.6;
    stepTau *= 0.6;
    stepTheta *= 0.6;
  }

  // Fit goodness metrics
  const meanY = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const sst = rows.reduce((s, r) => s + (r.y - meanY) * (r.y - meanY), 0);
  const rSquared = sst > 1e-12 ? Math.max(0, 1 - bestSse / sst) : 1;
  const rmse = Math.sqrt(bestSse / rows.length);
  const nrmsePct = (rmse / Math.abs(totalDy)) * 100;

  const fittedPoints = rows.map((r) => {
    const fitted = evalFopdt(r.t, y0, kp, tau, theta, stepTime, deltaU);
    return {
      t: r.t,
      measured: r.y,
      fitted,
      residual: r.y - fitted,
    };
  });

  return {
    ok: true,
    data: {
      kp,
      tau,
      theta,
      y0,
      yFinal: y0 + kp * deltaU,
      stepTime,
      deltaU,
      rSquared,
      rmse,
      nrmsePct,
      fittedPoints,
    },
  };
}

function makeRec(
  id: PidRuleId,
  name: string,
  notes: string,
  kc: number,
  ti: number,
  td: number
): PidTuningRecommendation {
  const safeTi = Math.max(ti, 1e-5);
  return {
    id,
    name,
    notes,
    kc,
    ti: safeTi,
    td: Math.max(0, td),
    kpParallel: kc,
    kiParallel: kc / safeTi,
    kdParallel: kc * Math.max(0, td),
  };
}

export function computePidRecommendations(
  model: FopdtModel,
  imcLambda?: number
): PidTuningRecommendation[] {
  const { kp, tau, theta } = model;
  // Guard pure first-order processes (theta == 0) with tiny numerical dead time for classical rules
  const thetaEff = Math.max(theta, 0.04 * tau);
  const r = thetaEff / tau;
  const lambda = Math.max(0.05 * tau, imcLambda ?? Math.max(1.2 * thetaEff, 0.5 * tau));

  // 1. Ziegler-Nichols Open-Loop Reaction Curve
  const znKc = (1.2 * tau) / (kp * thetaEff);
  const znTi = 2.0 * thetaEff;
  const znTd = 0.5 * thetaEff;

  // 2. IMC-PID (Rivera-Morari-Skogestad)
  const imcKc = (tau + 0.5 * thetaEff) / (kp * (lambda + 0.5 * thetaEff));
  const imcTi = tau + 0.5 * thetaEff;
  const imcTd = (tau * thetaEff) / (2 * tau + thetaEff);

  // 3. Cohen-Coon
  const ccKc = (tau / (kp * thetaEff)) * (4 / 3 + r / 4);
  const ccTi = thetaEff * ((32 + 6 * r) / (13 + 8 * r));
  const ccTd = thetaEff * (4 / (11 + 2 * r));

  // 4. SIMC-PID (Skogestad Internal Model Control)
  const simcKc = (tau + 0.5 * thetaEff) / (kp * (lambda + thetaEff));
  const simcTi = Math.min(tau + 0.5 * thetaEff, 4 * (lambda + thetaEff));
  const simcTd = theta > 1e-4 ? (tau * thetaEff) / (2 * tau + thetaEff) : 0;

  // 5. AMIGO (Åström-Hägglund Robust PID)
  const amigoKc = (1 / kp) * (0.2 + 0.45 * (tau / thetaEff));
  const amigoTi = thetaEff * ((0.4 * thetaEff + 0.8 * tau) / (thetaEff + 0.1 * tau));
  const amigoTd = (0.5 * thetaEff * tau) / (0.3 * thetaEff + tau);

  return [
    makeRec('imc', 'IMC-PID (Internal Model Control)', `λ = ${lambda.toFixed(2)} s · Smooth setpoint tracking`, imcKc, imcTi, imcTd),
    makeRec('zn', 'Ziegler–Nichols (Reaction Curve)', 'Fast disturbance rejection (~25% overshoot)', znKc, znTi, znTd),
    makeRec('cohen-coon', 'Cohen–Coon', 'Compensates larger θ/τ dead-time ratios', ccKc, ccTi, ccTd),
    makeRec('simc', 'SIMC-PID (Skogestad)', 'Balanced robustness & load-disturbance recovery', simcKc, simcTi, simcTd),
    makeRec('amigo', 'AMIGO (Åström–Hägglund)', 'Conservative gain & phase margin guarantee', amigoKc, amigoTi, amigoTd),
  ];
}

export interface ClosedLoopSimParams {
  model: FopdtModel;
  kc: number;
  ti: number;
  td: number;
  setpointStep: number;
  disturbanceStep: number;
  uMin?: number;
  uMax?: number;
  horizonSec?: number;
}

export function simulateClosedLoopPid(
  params: ClosedLoopSimParams
): ValidationResult<ClosedLoopSimOutput> {
  const { model, kc, ti, td, setpointStep, disturbanceStep } = params;
  if (!Number.isFinite(kc) || !Number.isFinite(ti) || !Number.isFinite(td)) {
    return { ok: false, error: 'PID gains (Kc, Ti, Td) must be finite numbers.' };
  }
  if (ti <= 0) {
    return { ok: false, error: 'Integral time Ti must be strictly > 0 s.' };
  }
  if (td < 0) {
    return { ok: false, error: 'Derivative time Td must be ≥ 0 s.' };
  }
  if (!Number.isFinite(setpointStep) || Math.abs(setpointStep) < 1e-9) {
    return { ok: false, error: 'Setpoint step amplitude must be non-zero.' };
  }
  if (!Number.isFinite(disturbanceStep)) {
    return { ok: false, error: 'Load disturbance step must be finite.' };
  }

  const uMin = params.uMin ?? -100;
  const uMax = params.uMax ?? 100;
  if (!Number.isFinite(uMin) || !Number.isFinite(uMax) || uMax <= uMin) {
    return { ok: false, error: 'Actuator limits must satisfy u_min < u_max.' };
  }

  const { kp, tau, theta } = model;
  const horizonSec = params.horizonSec ?? Math.max(8 * tau + 4 * theta, 12);
  const nSteps = 400;
  const dt = horizonSec / nSteps;
  const delaySteps = Math.max(0, Math.round(theta / dt));
  const uBuffer = new Array(nSteps + delaySteps + 2).fill(0);

  // Derivative low-pass filter constant N = 10
  const N = 10;
  const tf = td > 0 ? td / N : 0;

  let y = 0; // Deviation variable relative to initial operating point
  let integral = 0;
  let dState = 0;
  let prevY = 0;
  let iae = 0;
  let peakControl = Number.NEGATIVE_INFINITY;
  let minControl = Number.POSITIVE_INFINITY;
  let peakOutput = Number.NEGATIVE_INFINITY;
  const disturbanceStart = 0.55 * horizonSec;

  const points: ClosedLoopPoint[] = [];

  for (let i = 0; i <= nSteps; i++) {
    const t = i * dt;
    const sp = setpointStep;
    const dist = t >= disturbanceStart ? disturbanceStep : 0;
    const err = sp - y;

    // Proportional
    const pTerm = kc * err;
    // Derivative on measurement (kick-free) with low-pass filter
    const dyDt = i === 0 ? 0 : (y - prevY) / dt;
    if (td > 0) {
      dState = (tf * dState - kc * td * dt * dyDt) / (tf + dt);
    } else {
      dState = 0;
    }

    const uUnsat = pTerm + integral + dState;
    const uSat = Math.max(uMin, Math.min(uMax, uUnsat));

    // Conditional integration anti-windup
    if (uUnsat === uSat || (uUnsat > uMax && err < 0) || (uUnsat < uMin && err > 0)) {
      integral += (kc / ti) * err * dt;
    }

    uBuffer[i + delaySteps] = uSat + dist;
    const delayedInput = uBuffer[i];

    // Exact exponential step integration of FOPDT plant over dt
    const alpha = Math.exp(-dt / tau);
    y = y * alpha + kp * delayedInput * (1 - alpha);

    // Divergence guard for unstable gains
    if (!Number.isFinite(y) || Math.abs(y) > Math.abs(setpointStep) * 1e4) {
      y = Math.sign(y || 1) * Math.abs(setpointStep) * 1e4;
    }

    prevY = y;
    iae += Math.abs(err) * dt;
    if (uSat > peakControl) peakControl = uSat;
    if (uSat < minControl) minControl = uSat;
    if (setpointStep > 0 ? y > peakOutput : y < peakOutput) peakOutput = y;

    points.push({
      t,
      setpoint: sp,
      output: y,
      controlSignal: uSat,
      error: err,
      disturbance: dist,
    });
  }

  // Evaluate step-tracking metrics before disturbance hits
  const preDistPoints = points.filter((p) => p.t < disturbanceStart);
  const target = setpointStep;
  const maxPre =
    target > 0
      ? Math.max(...preDistPoints.map((p) => p.output))
      : Math.min(...preDistPoints.map((p) => p.output));
  const rawOvershoot = target > 0 ? ((maxPre - target) / target) * 100 : ((target - maxPre) / Math.abs(target)) * 100;
  const percentOvershoot = Math.max(0, rawOvershoot);

  // 10% -> 90% Rise time
  let t10: number | null = null;
  let t90: number | null = null;
  for (let i = 1; i < preDistPoints.length; i++) {
    const p0 = preDistPoints[i - 1].output / target;
    const p1 = preDistPoints[i].output / target;
    if (t10 === null && p0 < 0.1 && p1 >= 0.1) {
      t10 = preDistPoints[i].t;
    }
    if (t90 === null && p0 < 0.9 && p1 >= 0.9) {
      t90 = preDistPoints[i].t;
      break;
    }
  }
  const riseTimeSec = t10 !== null && t90 !== null ? Math.max(0, t90 - t10) : null;

  // 2% Settling time within pre-disturbance window
  const band = 0.02 * Math.abs(target);
  let lastOutIdx = -1;
  for (let i = 0; i < preDistPoints.length; i++) {
    if (Math.abs(preDistPoints[i].output - target) > band) {
      lastOutIdx = i;
    }
  }
  const settlingTimeSec =
    lastOutIdx >= 0 && lastOutIdx < preDistPoints.length - 2
      ? preDistPoints[lastOutIdx + 1].t
      : null;

  const tailErr = Math.abs(preDistPoints[preDistPoints.length - 1].output - target);
  const earlyAmp = Math.max(...preDistPoints.slice(0, Math.floor(preDistPoints.length * 0.5)).map((p) => Math.abs(p.output - target)));
  const isDiverging = tailErr > Math.abs(target) * 1.5 && tailErr > earlyAmp * 0.95;

  let stabilityLabel: ClosedLoopSimOutput['stabilityLabel'] = 'Stable';
  if (isDiverging) stabilityLabel = 'Unstable';
  else if (percentOvershoot > 35 || settlingTimeSec === null) stabilityLabel = 'Oscillatory';

  return {
    ok: true,
    data: {
      points,
      percentOvershoot,
      riseTimeSec,
      settlingTimeSec,
      iae,
      peakControlSignal: peakControl,
      minControlSignal: minControl,
      isStable: stabilityLabel === 'Stable',
      stabilityLabel,
    },
  };
}
