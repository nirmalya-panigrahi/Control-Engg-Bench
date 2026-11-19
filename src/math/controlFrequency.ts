import type { Complex, ValidationResult } from '../types/bench';
import {
  cAdd,
  cArgDeg,
  cAbs,
  cDiv,
  cMul,
  evalTransferFunction,
  findPolynomialRoots,
  polyToRealCoeffs,
} from './complex';

export interface NyquistPoint {
  omega: number;
  re: number;
  im: number;
  mag: number;
  magDb: number;
  phaseDeg: number;
  clMagDb: number;
}

export interface NyquistOutput {
  points: NyquistPoint[];
  mirrorPoints: NyquistPoint[];
  encirclementsN: number;
  openLoopRhpPoles: number;
  closedLoopRhpPoles: number;
  isClosedLoopStable: boolean;
  gainMarginDb: number | null;
  gainMarginLinear: number | null;
  phaseMarginDeg: number | null;
  omegaGc: number | null;
  omegaPc: number | null;
  minDistToCritical: number;
}

export interface BodePoint {
  omega: number;
  magDb: number;
  magLinear: number;
  phaseDeg: number;
  clMagDb: number;
}

export interface BodeOutput {
  points: BodePoint[];
  gainCrossoverRad: number | null;
  phaseCrossoverRad: number | null;
  gainMarginDb: number | null;
  phaseMarginDeg: number | null;
  bandwidthRad: number | null;
  dcGainDb: number;
  isStable: boolean;
}

export interface NicholsPoint {
  omega: number;
  phaseDeg: number;
  magDb: number;
  clMagDb: number;
  clPhaseDeg: number;
}

export interface NicholsContour {
  label: string;
  mDb: number;
  segments: Array<Array<{ phaseDeg: number; magDb: number }>>;
}

export interface NicholsOutput {
  points: NicholsPoint[];
  contours: NicholsContour[];
  resonantPeakDb: number;
  resonantFreqRad: number;
  gainMarginDb: number | null;
  phaseMarginDeg: number | null;
  bandwidthRad: number | null;
}

export interface FrequencySystemParams {
  zeros: Complex[];
  poles: Complex[];
  gain: number;
  wMin: number;
  wMax: number;
  timeDelay?: number;
  compensatorEnabled?: boolean;
  compGain?: number;
  compTauZ?: number;
  compTauP?: number;
}

function validateFreqParams(p: FrequencySystemParams): string | null {
  if (!Number.isFinite(p.gain) || p.gain <= 0) {
    return 'System gain K must be a finite positive number (> 0).';
  }
  if (!Number.isFinite(p.wMin) || !Number.isFinite(p.wMax) || p.wMin <= 0 || p.wMax <= p.wMin) {
    return 'Frequency sweep bounds must satisfy 0 < ω_min < ω_max.';
  }
  if (p.poles.length === 0) {
    return 'Specify at least one open-loop pole for a physical causal system.';
  }
  if (p.zeros.length > p.poles.length) {
    return 'Transfer function must be proper (number of zeros ≤ number of poles).';
  }
  if (p.timeDelay !== undefined && (!Number.isFinite(p.timeDelay) || p.timeDelay < 0)) {
    return 'Transport time delay τ must be ≥ 0 seconds.';
  }
  if (p.compensatorEnabled) {
    if (
      !Number.isFinite(p.compGain ?? 1) ||
      (p.compGain ?? 1) <= 0 ||
      !Number.isFinite(p.compTauZ ?? 0) ||
      (p.compTauZ ?? 0) < 0 ||
      !Number.isFinite(p.compTauP ?? 0) ||
      (p.compTauP ?? 0) < 0
    ) {
      return 'Compensator gain must be > 0 and time constants τ_z, τ_p must be ≥ 0.';
    }
  }
  for (const pt of [...p.poles, ...p.zeros]) {
    if (!Number.isFinite(pt.re) || !Number.isFinite(pt.im)) {
      return 'All pole and zero coordinates must be finite numbers.';
    }
  }
  return null;
}

function evaluateWithCompensator(params: FrequencySystemParams, omega: number): Complex {
  const s: Complex = { re: 0, im: omega };
  let g = evalTransferFunction(params.zeros, params.poles, params.gain, s, params.timeDelay ?? 0);
  if (params.compensatorEnabled) {
    const kc = params.compGain ?? 1;
    const tz = params.compTauZ ?? 0;
    const tp = params.compTauP ?? 0;
    const num: Complex = { re: kc, im: kc * tz * omega };
    const den: Complex = { re: 1, im: tp * omega };
    g = cMul(g, cDiv(num, den));
  }
  return g;
}

function buildLogFrequencies(wMin: number, wMax: number, count: number): number[] {
  const logMin = Math.log10(wMin);
  const logMax = Math.log10(wMax);
  const arr: number[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    arr.push(Math.pow(10, logMin + frac * (logMax - logMin)));
  }
  return arr;
}

function unwrapPhaseSequence(rawAnglesDeg: number[], initialOffsetDeg = 0): number[] {
  if (rawAnglesDeg.length === 0) return [];
  const out: number[] = [rawAnglesDeg[0] + initialOffsetDeg];
  for (let i = 1; i < rawAnglesDeg.length; i++) {
    let diff = rawAnglesDeg[i] - rawAnglesDeg[i - 1];
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    out.push(out[i - 1] + diff);
  }
  return out;
}

function estimateInitialPhaseOffset(params: FrequencySystemParams, firstOmega: number, firstAngleDeg: number): number {
  const originPoles = params.poles.filter((p) => Math.hypot(p.re, p.im) < 1e-6).length;
  const originZeros = params.zeros.filter((z) => Math.hypot(z.re, z.im) < 1e-6).length;
  let expectedLowFreqDeg = (originZeros - originPoles) * 90;
  for (const p of params.poles) {
    if (Math.hypot(p.re, p.im) >= 1e-6) {
      expectedLowFreqDeg -= (Math.atan2(firstOmega - p.im, -p.re) * 180) / Math.PI;
    }
  }
  for (const z of params.zeros) {
    if (Math.hypot(z.re, z.im) >= 1e-6) {
      expectedLowFreqDeg += (Math.atan2(firstOmega - z.im, -z.re) * 180) / Math.PI;
    }
  }
  if (params.timeDelay) {
    expectedLowFreqDeg -= (firstOmega * params.timeDelay * 180) / Math.PI;
  }
  const k = Math.round((expectedLowFreqDeg - firstAngleDeg) / 360);
  return k * 360;
}

function extractMargins(
  omegas: number[],
  magsLinear: number[],
  unwrappedPhasesDeg: number[]
): {
  omegaGc: number | null;
  omegaPc: number | null;
  gainMarginDb: number | null;
  gainMarginLinear: number | null;
  phaseMarginDeg: number | null;
} {
  let omegaGc: number | null = null;
  let phaseMarginDeg: number | null = null;
  let omegaPc: number | null = null;
  let gainMarginLinear: number | null = null;
  let gainMarginDb: number | null = null;

  for (let i = 1; i < omegas.length; i++) {
    const m0 = magsLinear[i - 1];
    const m1 = magsLinear[i];
    if (Number.isFinite(m0) && Number.isFinite(m1) && (m0 - 1) * (m1 - 1) <= 0 && m0 !== m1) {
      const t = (1 - m0) / (m1 - m0);
      const wCross = omegas[i - 1] + t * (omegas[i] - omegas[i - 1]);
      const phCross = unwrappedPhasesDeg[i - 1] + t * (unwrappedPhasesDeg[i] - unwrappedPhasesDeg[i - 1]);
      // Closest odd multiple of -180 or standard 180 + phase
      const wrapped = ((((phCross + 180) % 360) + 360) % 360) - 180;
      const pm = 180 + (phCross <= -180 && phCross > -540 ? phCross : wrapped);
      if (omegaGc === null) {
        omegaGc = wCross;
        phaseMarginDeg = pm;
      }
    }

    const p0 = unwrappedPhasesDeg[i - 1];
    const p1 = unwrappedPhasesDeg[i];
    // Find crossing of -180 deg (or -180 - 360k)
    const target = -180;
    if ((p0 - target) * (p1 - target) <= 0 && p0 !== p1) {
      const t = (target - p0) / (p1 - p0);
      const wCross = omegas[i - 1] + t * (omegas[i] - omegas[i - 1]);
      const magCross = m0 + t * (m1 - m0);
      if (magCross > 1e-12 && omegaPc === null) {
        omegaPc = wCross;
        gainMarginLinear = 1 / magCross;
        gainMarginDb = 20 * Math.log10(gainMarginLinear);
      }
    }
  }

  return { omegaGc, omegaPc, gainMarginDb, gainMarginLinear, phaseMarginDeg };
}

export function computeNyquist(params: FrequencySystemParams): ValidationResult<NyquistOutput> {
  const err = validateFreqParams(params);
  if (err) return { ok: false, error: err };

  const omegas = buildLogFrequencies(params.wMin, params.wMax, 360);
  const rawPoints: Array<{ omega: number; g: Complex }> = [];
  for (const w of omegas) {
    const g = evaluateWithCompensator(params, w);
    if (Number.isFinite(g.re) && Number.isFinite(g.im)) {
      rawPoints.push({ omega: w, g });
    }
  }

  if (rawPoints.length < 4) {
    return { ok: false, error: 'Unable to evaluate finite frequency points across the selected range.' };
  }

  const rawPhases = rawPoints.map((pt) => cArgDeg(pt.g));
  const offset = estimateInitialPhaseOffset(params, rawPoints[0].omega, rawPhases[0]);
  const unwrapped = unwrapPhaseSequence(rawPhases, offset);

  let minDistToCritical = Number.POSITIVE_INFINITY;
  const points: NyquistPoint[] = rawPoints.map((pt, idx) => {
    const mag = Math.max(cAbs(pt.g), 1e-12);
    const clDenom = cAbs(cAdd({ re: 1, im: 0 }, pt.g));
    const clMag = clDenom > 1e-12 ? mag / clDenom : 100;
    const dist = Math.hypot(pt.g.re + 1, pt.g.im);
    if (dist < minDistToCritical) minDistToCritical = dist;
    return {
      omega: pt.omega,
      re: pt.g.re,
      im: pt.g.im,
      mag,
      magDb: 20 * Math.log10(mag),
      phaseDeg: unwrapped[idx],
      clMagDb: 20 * Math.log10(Math.max(clMag, 1e-12)),
    };
  });

  const mirrorPoints: NyquistPoint[] = [...points].reverse().map((pt) => ({
    ...pt,
    im: -pt.im,
    phaseDeg: -pt.phaseDeg,
  }));

  const { omegaGc, omegaPc, gainMarginDb, gainMarginLinear, phaseMarginDeg } = extractMargins(
    points.map((p) => p.omega),
    points.map((p) => p.mag),
    points.map((p) => p.phaseDeg)
  );

  // Exact closed-loop RHP pole check when rational (no time delay)
  const openLoopRhpPoles = params.poles.filter((p) => p.re > 1e-7).length;
  let closedLoopRhpPoles = 0;

  if (!params.timeDelay || params.timeDelay === 0) {
    const denPoly = polyToRealCoeffs(params.poles);
    const numPoly = polyToRealCoeffs(params.zeros);
    // Align polynomial degrees: D(s) + K*N(s)
    const maxLen = Math.max(denPoly.length, numPoly.length);
    const charPoly = new Array(maxLen).fill(0);
    for (let i = 0; i < denPoly.length; i++) {
      charPoly[maxLen - denPoly.length + i] += denPoly[i];
    }
    for (let i = 0; i < numPoly.length; i++) {
      charPoly[maxLen - numPoly.length + i] += params.gain * numPoly[i];
    }
    const clRoots = findPolynomialRoots(charPoly);
    closedLoopRhpPoles = clRoots.filter((r) => r.re > 1e-6).length;
  } else {
    // Winding approximation around (-1, 0) using full contour + mirror
    const fullContour = [...points, ...mirrorPoints];
    let totalAngle = 0;
    for (let i = 1; i < fullContour.length; i++) {
      const a0 = Math.atan2(fullContour[i - 1].im, fullContour[i - 1].re + 1);
      const a1 = Math.atan2(fullContour[i].im, fullContour[i].re + 1);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      totalAngle += d;
    }
    const encirclements = -Math.round(totalAngle / (2 * Math.PI));
    closedLoopRhpPoles = Math.max(0, openLoopRhpPoles + encirclements);
  }

  const encirclementsN = closedLoopRhpPoles - openLoopRhpPoles;

  return {
    ok: true,
    data: {
      points,
      mirrorPoints,
      encirclementsN,
      openLoopRhpPoles,
      closedLoopRhpPoles,
      isClosedLoopStable: closedLoopRhpPoles === 0,
      gainMarginDb,
      gainMarginLinear,
      phaseMarginDeg,
      omegaGc,
      omegaPc,
      minDistToCritical,
    },
  };
}

export function computeBode(params: FrequencySystemParams): ValidationResult<BodeOutput> {
  const err = validateFreqParams(params);
  if (err) return { ok: false, error: err };

  const omegas = buildLogFrequencies(params.wMin, params.wMax, 360);
  const evals = omegas.map((w) => ({ omega: w, g: evaluateWithCompensator(params, w) }));
  const finite = evals.filter((e) => Number.isFinite(e.g.re) && Number.isFinite(e.g.im));
  if (finite.length < 4) {
    return { ok: false, error: 'Unable to evaluate finite Bode points across the selected range.' };
  }

  const rawPhases = finite.map((e) => cArgDeg(e.g));
  const offset = estimateInitialPhaseOffset(params, finite[0].omega, rawPhases[0]);
  const unwrapped = unwrapPhaseSequence(rawPhases, offset);

  const points: BodePoint[] = finite.map((e, idx) => {
    const mag = Math.max(cAbs(e.g), 1e-12);
    const clDenom = cAbs(cAdd({ re: 1, im: 0 }, e.g));
    const clMag = clDenom > 1e-12 ? mag / clDenom : 100;
    return {
      omega: e.omega,
      magDb: 20 * Math.log10(mag),
      magLinear: mag,
      phaseDeg: unwrapped[idx],
      clMagDb: 20 * Math.log10(Math.max(clMag, 1e-12)),
    };
  });

  const { omegaGc, omegaPc, gainMarginDb, phaseMarginDeg } = extractMargins(
    points.map((p) => p.omega),
    points.map((p) => p.magLinear),
    points.map((p) => p.phaseDeg)
  );

  // Closed-loop -3dB bandwidth relative to low-frequency closed-loop gain
  const refClDb = points[0].clMagDb;
  let bandwidthRad: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const d0 = points[i - 1].clMagDb - (refClDb - 3);
    const d1 = points[i].clMagDb - (refClDb - 3);
    if (d0 >= 0 && d1 < 0) {
      const t = d0 / (d0 - d1);
      bandwidthRad = points[i - 1].omega + t * (points[i].omega - points[i - 1].omega);
      break;
    }
  }

  const isStable =
    (phaseMarginDeg === null || phaseMarginDeg > 0) &&
    (gainMarginDb === null || gainMarginDb > 0);

  return {
    ok: true,
    data: {
      points,
      gainCrossoverRad: omegaGc,
      phaseCrossoverRad: omegaPc,
      gainMarginDb,
      phaseMarginDeg,
      bandwidthRad,
      dcGainDb: points[0].magDb,
      isStable,
    },
  };
}

function generateMContour(mDb: number): NicholsContour {
  const M = Math.pow(10, mDb / 20);
  const mSq = M * M;
  const segments: Array<Array<{ phaseDeg: number; magDb: number }>> = [];

  if (Math.abs(M - 1) < 1e-4) {
    // M = 0 dB vertical/parabolic line: 2*Re(G) + 1 = 0 => r * cos(phi) = -0.5 => r = -1 / (2*cos(phi))
    const seg: Array<{ phaseDeg: number; magDb: number }> = [];
    for (let deg = -268; deg <= -92; deg += 2) {
      const rad = (deg * Math.PI) / 180;
      const cosP = Math.cos(rad);
      if (cosP < -0.02) {
        const r = -0.5 / cosP;
        const magDb = 20 * Math.log10(r);
        if (magDb >= -30 && magDb <= 30) {
          seg.push({ phaseDeg: deg, magDb });
        }
      }
    }
    if (seg.length > 1) segments.push(seg);
    return { label: `${mDb > 0 ? '+' : ''}${mDb} dB`, mDb, segments };
  }

  // Circle in G-plane: (x + M^2/(M^2-1))^2 + y^2 = (M/|M^2-1|)^2
  const center = -mSq / (mSq - 1);
  const radius = M / Math.abs(mSq - 1);
  const seg: Array<{ phaseDeg: number; magDb: number }> = [];

  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const theta = (2 * Math.PI * i) / steps;
    const x = center + radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const r = Math.hypot(x, y);
    if (r < 1e-4) continue;
    let phaseDeg = (Math.atan2(y, x) * 180) / Math.PI;
    if (phaseDeg > 0) phaseDeg -= 360;
    const magDb = 20 * Math.log10(r);
    if (magDb >= -30 && magDb <= 30 && phaseDeg >= -360 && phaseDeg <= 0) {
      seg.push({ phaseDeg, magDb });
    }
  }

  // Sort for clean continuous closed contour or open arc
  if (M > 1) {
    // Closed loop around (-180, 0)
    if (seg.length > 2) segments.push(seg);
  } else {
    // Split at wrap boundaries if needed
    seg.sort((a, b) => a.phaseDeg - b.phaseDeg);
    if (seg.length > 2) segments.push(seg);
  }

  return { label: `${mDb > 0 ? '+' : ''}${mDb} dB`, mDb, segments };
}

export function computeNichols(params: FrequencySystemParams): ValidationResult<NicholsOutput> {
  const bodeRes = computeBode(params);
  if (!bodeRes.ok) return bodeRes;

  const { points: bodePts, gainMarginDb, phaseMarginDeg, bandwidthRad } = bodeRes.data;

  let resonantPeakDb = Number.NEGATIVE_INFINITY;
  let resonantFreqRad = bodePts[0].omega;

  const points: NicholsPoint[] = bodePts.map((pt) => {
    const gRad = (pt.phaseDeg * Math.PI) / 180;
    const g: Complex = {
      re: pt.magLinear * Math.cos(gRad),
      im: pt.magLinear * Math.sin(gRad),
    };
    const cl = cDiv(g, cAdd({ re: 1, im: 0 }, g));
    const clMagDb = 20 * Math.log10(Math.max(cAbs(cl), 1e-12));
    const clPhaseDeg = cArgDeg(cl);

    if (clMagDb > resonantPeakDb) {
      resonantPeakDb = clMagDb;
      resonantFreqRad = pt.omega;
    }

    return {
      omega: pt.omega,
      phaseDeg: pt.phaseDeg,
      magDb: pt.magDb,
      clMagDb,
      clPhaseDeg,
    };
  });

  const mLevels = [-12, -6, -3, 0, 1, 3, 6];
  const contours = mLevels.map((m) => generateMContour(m));

  return {
    ok: true,
    data: {
      points,
      contours,
      resonantPeakDb,
      resonantFreqRad,
      gainMarginDb,
      phaseMarginDeg,
      bandwidthRad,
    },
  };
}
