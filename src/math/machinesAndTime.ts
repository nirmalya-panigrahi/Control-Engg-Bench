import type { ValidationResult } from '../types/bench';

export interface TorqueSpeedInput {
  voltageLl: number;
  frequencyHz: number;
  poles: number;
  statorResistanceOhm: number;
  statorReactanceOhm: number;
  rotorResistanceOhm: number;
  rotorReactanceOhm: number;
  ratedSlip: number;
}

export interface TorqueSpeedPoint {
  slip: number;
  speedRpm: number;
  torqueNm: number;
  torqueDoubleR2Nm: number;
  rotorCurrentA: number;
}

export interface TorqueSpeedOutput {
  points: TorqueSpeedPoint[];
  synchronousSpeedRpm: number;
  omegaSyncRad: number;
  startingTorqueNm: number;
  breakdownTorqueNm: number;
  breakdownSlip: number;
  breakdownSpeedRpm: number;
  ratedTorqueNm: number;
  ratedSpeedRpm: number;
  speedRegulationPct: number;
}

export interface TransformerEfficiencyInput {
  ratedKva: number;
  coreLossW: number;
  fullLoadCopperLossW: number;
  powerFactor: number;
  loadFraction: number;
}

export interface TransformerEfficiencyPoint {
  loadFraction: number;
  loadPct: number;
  efficiencyPct: number;
  unityPfEfficiencyPct: number;
  coreLossW: number;
  copperLossW: number;
  totalLossW: number;
  outputKw: number;
}

export interface TransformerEfficiencyOutput {
  points: TransformerEfficiencyPoint[];
  operatingEfficiencyPct: number;
  maxEfficiencyPct: number;
  maxEfficiencyLoadFraction: number;
  maxEfficiencyLoadPct: number;
  operatingCoreLossW: number;
  operatingCopperLossW: number;
  operatingTotalLossW: number;
  operatingOutputKw: number;
}

export interface StepResponseInput {
  zeta: number;
  omegaN: number;
  amplitude: number;
}

export interface StepResponsePoint {
  timeSec: number;
  response: number;
  upperEnvelope: number | null;
  lowerEnvelope: number | null;
}

export interface StepResponseOutput {
  points: StepResponsePoint[];
  regime: 'Undamped' | 'Underdamped' | 'Critically Damped' | 'Overdamped';
  percentOvershoot: number;
  riseTimeSec: number | null;
  peakTimeSec: number | null;
  settlingTimeSec: number | null;
  steadyStateValue: number;
  dampedFreqRad: number | null;
  tMaxSec: number;
}

export function computeTorqueSpeed(input: TorqueSpeedInput): ValidationResult<TorqueSpeedOutput> {
  const {
    voltageLl,
    frequencyHz,
    poles,
    statorResistanceOhm,
    statorReactanceOhm,
    rotorResistanceOhm,
    rotorReactanceOhm,
    ratedSlip,
  } = input;

  if (!Number.isFinite(voltageLl) || voltageLl <= 0) {
    return { ok: false, error: 'Supply line voltage must be > 0 V.' };
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return { ok: false, error: 'Supply frequency must be > 0 Hz.' };
  }
  if (!Number.isInteger(poles) || poles < 2 || poles % 2 !== 0) {
    return { ok: false, error: 'Number of motor poles must be an even integer ≥ 2.' };
  }
  if (
    statorResistanceOhm < 0 ||
    statorReactanceOhm < 0 ||
    rotorResistanceOhm <= 0 ||
    rotorReactanceOhm < 0 ||
    !Number.isFinite(statorResistanceOhm) ||
    !Number.isFinite(statorReactanceOhm) ||
    !Number.isFinite(rotorResistanceOhm) ||
    !Number.isFinite(rotorReactanceOhm)
  ) {
    return { ok: false, error: 'Rotor resistance R2 must be > 0 Ω and impedances must be finite and ≥ 0.' };
  }
  if (statorResistanceOhm + statorReactanceOhm + rotorReactanceOhm < 1e-6) {
    return { ok: false, error: 'Combined stator impedance and rotor reactance must be > 0 Ω.' };
  }
  if (!Number.isFinite(ratedSlip) || ratedSlip <= 0 || ratedSlip >= 1) {
    return { ok: false, error: 'Rated slip must be strictly between 0 and 1 (e.g., 0.03).' };
  }

  const synchronousSpeedRpm = (120 * frequencyHz) / poles;
  const omegaSyncRad = (2 * Math.PI * synchronousSpeedRpm) / 60;
  const vPhase = voltageLl / Math.sqrt(3);
  const xTotal = statorReactanceOhm + rotorReactanceOhm;

  const evalAtSlip = (s: number, r2: number): { torque: number; current: number } => {
    if (s <= 1e-7) return { torque: 0, current: 0 };
    const rTotal = statorResistanceOhm + r2 / s;
    const zSq = rTotal * rTotal + xTotal * xTotal;
    const i2 = vPhase / Math.sqrt(zSq);
    const torque = (3 * i2 * i2 * (r2 / s)) / omegaSyncRad;
    return { torque, current: i2 };
  };

  const points: TorqueSpeedPoint[] = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const s = 1 - i / steps; // 1.0 down to 0.0
    const speedRpm = synchronousSpeedRpm * (1 - s);
    const { torque, current } = evalAtSlip(s, rotorResistanceOhm);
    const { torque: torqueDoubleR2 } = evalAtSlip(s, rotorResistanceOhm * 2);
    points.push({
      slip: s,
      speedRpm,
      torqueNm: torque,
      torqueDoubleR2Nm: torqueDoubleR2,
      rotorCurrentA: current,
    });
  }

  const startingTorqueNm = evalAtSlip(1, rotorResistanceOhm).torque;
  const breakdownSlip = rotorResistanceOhm / Math.hypot(statorResistanceOhm, xTotal);
  const breakdownTorqueNm = evalAtSlip(Math.min(breakdownSlip, 1), rotorResistanceOhm).torque;
  const breakdownSpeedRpm = synchronousSpeedRpm * (1 - breakdownSlip);

  const ratedTorqueNm = evalAtSlip(ratedSlip, rotorResistanceOhm).torque;
  const ratedSpeedRpm = synchronousSpeedRpm * (1 - ratedSlip);
  const speedRegulationPct = ((synchronousSpeedRpm - ratedSpeedRpm) / ratedSpeedRpm) * 100;

  return {
    ok: true,
    data: {
      points,
      synchronousSpeedRpm,
      omegaSyncRad,
      startingTorqueNm,
      breakdownTorqueNm,
      breakdownSlip,
      breakdownSpeedRpm,
      ratedTorqueNm,
      ratedSpeedRpm,
      speedRegulationPct,
    },
  };
}

export function computeTransformerEfficiency(
  input: TransformerEfficiencyInput
): ValidationResult<TransformerEfficiencyOutput> {
  const { ratedKva, coreLossW, fullLoadCopperLossW, powerFactor, loadFraction } = input;
  if (!Number.isFinite(ratedKva) || ratedKva <= 0) {
    return { ok: false, error: 'Transformer rated kVA must be > 0.' };
  }
  if (!Number.isFinite(coreLossW) || coreLossW < 0) {
    return { ok: false, error: 'Core (iron) loss must be ≥ 0 W.' };
  }
  if (!Number.isFinite(fullLoadCopperLossW) || fullLoadCopperLossW <= 0) {
    return { ok: false, error: 'Full-load copper loss must be > 0 W.' };
  }
  if (!Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1) {
    return { ok: false, error: 'Load power factor cos(φ) must be in (0, 1].' };
  }
  if (!Number.isFinite(loadFraction) || loadFraction <= 0 || loadFraction > 1.6) {
    return { ok: false, error: 'Operating load fraction must be in (0, 1.6].' };
  }

  const evalPoint = (x: number, pf: number): number => {
    const pOutW = x * ratedKva * 1000 * pf;
    const pCuW = x * x * fullLoadCopperLossW;
    const pInW = pOutW + coreLossW + pCuW;
    return pInW > 0 ? (pOutW / pInW) * 100 : 0;
  };

  const points: TransformerEfficiencyPoint[] = [];
  for (let i = 1; i <= 150; i++) {
    const x = i * 0.01; // 1% to 150%
    const copperLossW = x * x * fullLoadCopperLossW;
    const outputKw = x * ratedKva * powerFactor;
    points.push({
      loadFraction: x,
      loadPct: x * 100,
      efficiencyPct: evalPoint(x, powerFactor),
      unityPfEfficiencyPct: evalPoint(x, 1),
      coreLossW,
      copperLossW,
      totalLossW: coreLossW + copperLossW,
      outputKw,
    });
  }

  const maxEfficiencyLoadFraction = Math.sqrt(coreLossW / fullLoadCopperLossW);
  const maxEfficiencyLoadPct = maxEfficiencyLoadFraction * 100;
  const maxEfficiencyPct = evalPoint(maxEfficiencyLoadFraction, powerFactor);

  const operatingEfficiencyPct = evalPoint(loadFraction, powerFactor);
  const operatingCopperLossW = loadFraction * loadFraction * fullLoadCopperLossW;
  const operatingTotalLossW = coreLossW + operatingCopperLossW;
  const operatingOutputKw = loadFraction * ratedKva * powerFactor;

  return {
    ok: true,
    data: {
      points,
      operatingEfficiencyPct,
      maxEfficiencyPct,
      maxEfficiencyLoadFraction,
      maxEfficiencyLoadPct,
      operatingCoreLossW: coreLossW,
      operatingCopperLossW,
      operatingTotalLossW,
      operatingOutputKw,
    },
  };
}

export function computeStepResponse(input: StepResponseInput): ValidationResult<StepResponseOutput> {
  const { zeta, omegaN, amplitude } = input;
  if (!Number.isFinite(zeta) || zeta < 0) {
    return { ok: false, error: 'Damping ratio ζ must be a finite number ≥ 0.' };
  }
  if (!Number.isFinite(omegaN) || omegaN <= 0) {
    return { ok: false, error: 'Natural frequency ω_n must be > 0 rad/s.' };
  }
  if (!Number.isFinite(amplitude) || amplitude === 0) {
    return { ok: false, error: 'Step input amplitude must be finite and non-zero.' };
  }

  let regime: StepResponseOutput['regime'];
  if (zeta === 0) regime = 'Undamped';
  else if (zeta < 1) regime = 'Underdamped';
  else if (Math.abs(zeta - 1) < 1e-6) regime = 'Critically Damped';
  else regime = 'Overdamped';

  let dampedFreqRad: number | null = null;
  let percentOvershoot = 0;
  let peakTimeSec: number | null = null;
  let settlingTimeSec: number | null = null;

  if (regime === 'Undamped') {
    dampedFreqRad = omegaN;
    percentOvershoot = 100;
    peakTimeSec = Math.PI / omegaN;
    settlingTimeSec = null;
  } else if (regime === 'Underdamped') {
    const sq = Math.sqrt(1 - zeta * zeta);
    dampedFreqRad = omegaN * sq;
    percentOvershoot = 100 * Math.exp((-Math.PI * zeta) / sq);
    peakTimeSec = Math.PI / dampedFreqRad;
    settlingTimeSec = 4 / (zeta * omegaN);
  } else if (regime === 'Critically Damped') {
    settlingTimeSec = 5.8335 / omegaN;
  } else {
    const sq = Math.sqrt(zeta * zeta - 1);
    const slowPole = omegaN * (zeta - sq);
    settlingTimeSec = 4 / slowPole;
  }

  // Choose clean time horizon
  const tMaxSec =
    regime === 'Undamped'
      ? (6 * Math.PI) / omegaN
      : Math.max((settlingTimeSec ?? 6 / omegaN) * 1.45, 5 / omegaN);

  const evalY = (t: number): number => {
    if (regime === 'Undamped') {
      return amplitude * (1 - Math.cos(omegaN * t));
    }
    if (regime === 'Underdamped') {
      const sq = Math.sqrt(1 - zeta * zeta);
      const wd = omegaN * sq;
      const theta = Math.atan2(sq, zeta);
      return amplitude * (1 - (Math.exp(-zeta * omegaN * t) / sq) * Math.sin(wd * t + theta));
    }
    if (regime === 'Critically Damped') {
      return amplitude * (1 - Math.exp(-omegaN * t) * (1 + omegaN * t));
    }
    const sq = Math.sqrt(zeta * zeta - 1);
    const s1 = -omegaN * (zeta - sq);
    const s2 = -omegaN * (zeta + sq);
    return amplitude * (1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1));
  };

  const points: StepResponsePoint[] = [];
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const t = (tMaxSec * i) / steps;
    const response = evalY(t);
    let upperEnvelope: number | null = null;
    let lowerEnvelope: number | null = null;
    if (regime === 'Underdamped') {
      const sq = Math.sqrt(1 - zeta * zeta);
      const envOffset = (Math.abs(amplitude) * Math.exp(-zeta * omegaN * t)) / sq;
      upperEnvelope = amplitude + envOffset;
      lowerEnvelope = amplitude - envOffset;
    } else if (regime === 'Undamped') {
      upperEnvelope = amplitude + Math.abs(amplitude);
      lowerEnvelope = amplitude - Math.abs(amplitude);
    }
    points.push({ timeSec: t, response, upperEnvelope, lowerEnvelope });
  }

  // Exact numerical 10% -> 90% rise time
  let t10: number | null = null;
  let t90: number | null = null;
  const fineSteps = 1200;
  let prevNorm = 0;
  for (let i = 1; i <= fineSteps; i++) {
    const t = (tMaxSec * i) / fineSteps;
    const norm = evalY(t) / amplitude;
    if (t10 === null && prevNorm < 0.1 && norm >= 0.1) {
      const frac = (0.1 - prevNorm) / (norm - prevNorm);
      t10 = ((i - 1 + frac) * tMaxSec) / fineSteps;
    }
    if (t90 === null && prevNorm < 0.9 && norm >= 0.9) {
      const frac = (0.9 - prevNorm) / (norm - prevNorm);
      t90 = ((i - 1 + frac) * tMaxSec) / fineSteps;
      break;
    }
    prevNorm = norm;
  }
  const riseTimeSec = t10 !== null && t90 !== null ? t90 - t10 : null;

  // Refine 2% settling time accurately for underdamped/overdamped
  if (regime !== 'Undamped') {
    const band = 0.02 * Math.abs(amplitude);
    let lastOutsideIdx = -1;
    for (let i = 0; i <= fineSteps; i++) {
      const t = (tMaxSec * i) / fineSteps;
      if (Math.abs(evalY(t) - amplitude) > band) {
        lastOutsideIdx = i;
      }
    }
    if (lastOutsideIdx >= 0 && lastOutsideIdx < fineSteps) {
      settlingTimeSec = ((lastOutsideIdx + 0.5) * tMaxSec) / fineSteps;
    }
  }

  return {
    ok: true,
    data: {
      points,
      regime,
      percentOvershoot,
      riseTimeSec,
      peakTimeSec,
      settlingTimeSec,
      steadyStateValue: amplitude,
      dampedFreqRad,
      tMaxSec,
    },
  };
}
