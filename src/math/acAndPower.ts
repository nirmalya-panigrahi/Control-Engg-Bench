import type { ValidationResult } from '../types/bench';

export type CircuitTopology = 'series' | 'parallel';

export interface PhasorInput {
  topology: CircuitTopology;
  voltageRms: number;
  frequencyHz: number;
  resistanceOhm: number;
  inductanceMh: number;
  capacitanceUf: number;
}

export interface PhasorVector {
  id: string;
  label: string;
  re: number;
  im: number;
  mag: number;
  angleDeg: number;
  unit: string;
  colorKey: 'primary' | 'amber' | 'emerald' | 'rose' | 'slate';
}

export interface PhasorOutput {
  topology: CircuitTopology;
  omegaRad: number;
  xlOhm: number;
  xcOhm: number;
  impedanceMagOhm: number;
  impedancePhaseDeg: number;
  currentMagA: number;
  currentPhaseDeg: number;
  powerFactor: number;
  pfType: 'Lagging' | 'Leading' | 'Unity';
  activePowerW: number;
  reactivePowerVar: number;
  apparentPowerVa: number;
  resonantFreqHz: number | null;
  voltagePhasors: PhasorVector[];
  currentPhasors: PhasorVector[];
}

export interface PowerCircleInput {
  vsKv: number;
  vrKv: number;
  reactanceOhm: number;
  deltaDeg: number;
  armatureLimitMva: number;
  fieldLimitMva: number;
  turbineMaxMw: number;
}

export interface PowerCirclePoint {
  deltaDeg: number;
  pMw: number;
  qMvar: number;
}

export interface PowerCircleOutput {
  locusPoints: PowerCirclePoint[];
  operatingP: number;
  operatingQ: number;
  operatingS: number;
  maxTheoreticalP: number;
  steadyStateLimitMw: number;
  qCenterMvar: number;
  circleRadiusMva: number;
  stabilityMarginPct: number;
  qMinMvar: number;
  qMaxMvar: number;
  withinArmatureLimit: boolean;
  withinFieldLimit: boolean;
  withinTurbineLimit: boolean;
  withinStabilityLimit: boolean;
}

export function computePhasorDiagram(input: PhasorInput): ValidationResult<PhasorOutput> {
  const { topology, voltageRms, frequencyHz, resistanceOhm, inductanceMh, capacitanceUf } = input;
  if (!Number.isFinite(voltageRms) || voltageRms <= 0) {
    return { ok: false, error: 'Supply RMS voltage must be > 0 V.' };
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return { ok: false, error: 'Supply frequency must be > 0 Hz.' };
  }
  if (!Number.isFinite(resistanceOhm) || resistanceOhm < 0) {
    return { ok: false, error: 'Resistance R must be ≥ 0 Ω.' };
  }
  if (!Number.isFinite(inductanceMh) || inductanceMh < 0) {
    return { ok: false, error: 'Inductance L must be ≥ 0 mH.' };
  }
  if (!Number.isFinite(capacitanceUf) || capacitanceUf <= 0) {
    return { ok: false, error: 'Capacitance C must be > 0 μF.' };
  }

  const omegaRad = 2 * Math.PI * frequencyHz;
  const L = inductanceMh * 1e-3;
  const C = capacitanceUf * 1e-6;
  const xlOhm = omegaRad * L;
  const xcOhm = 1 / (omegaRad * C);
  const resonantFreqHz = L > 0 ? 1 / (2 * Math.PI * Math.sqrt(L * C)) : null;

  let zRe = 0;
  let zIm = 0;
  const voltagePhasors: PhasorVector[] = [];
  const currentPhasors: PhasorVector[] = [];

  if (topology === 'series') {
    zRe = resistanceOhm;
    zIm = xlOhm - xcOhm;
    const zMag = Math.hypot(zRe, zIm);
    if (zMag < 1e-9) {
      return { ok: false, error: 'Total circuit impedance is zero at resonance with R = 0 Ω (short circuit).' };
    }
    const zAngleDeg = (Math.atan2(zIm, zRe) * 180) / Math.PI;
    const iMag = voltageRms / zMag;
    const iAngleRad = -Math.atan2(zIm, zRe);
    const iRe = iMag * Math.cos(iAngleRad);
    const iIm = iMag * Math.sin(iAngleRad);

    // Voltage phasors (V_source at 0 deg reference)
    const vrRe = iRe * resistanceOhm;
    const vrIm = iIm * resistanceOhm;
    const vlRe = -iIm * xlOhm;
    const vlIm = iRe * xlOhm;
    const vcRe = iIm * xcOhm;
    const vcIm = -iRe * xcOhm;

    voltagePhasors.push(
      {
        id: 'Vs',
        label: 'Vs (Source)',
        re: voltageRms,
        im: 0,
        mag: voltageRms,
        angleDeg: 0,
        unit: 'V',
        colorKey: 'slate',
      },
      {
        id: 'VR',
        label: 'VR (Resistor)',
        re: vrRe,
        im: vrIm,
        mag: Math.hypot(vrRe, vrIm),
        angleDeg: (Math.atan2(vrIm, vrRe) * 180) / Math.PI,
        unit: 'V',
        colorKey: 'emerald',
      },
      {
        id: 'VL',
        label: 'VL (Inductor)',
        re: vlRe,
        im: vlIm,
        mag: Math.hypot(vlRe, vlIm),
        angleDeg: (Math.atan2(vlIm, vlRe) * 180) / Math.PI,
        unit: 'V',
        colorKey: 'amber',
      },
      {
        id: 'VC',
        label: 'VC (Capacitor)',
        re: vcRe,
        im: vcIm,
        mag: Math.hypot(vcRe, vcIm),
        angleDeg: (Math.atan2(vcIm, vcRe) * 180) / Math.PI,
        unit: 'V',
        colorKey: 'rose',
      }
    );

    currentPhasors.push({
      id: 'I',
      label: 'I (Circuit Current)',
      re: iRe,
      im: iIm,
      mag: iMag,
      angleDeg: (iAngleRad * 180) / Math.PI,
      unit: 'A',
      colorKey: 'primary',
    });

    const pf = Math.cos((zAngleDeg * Math.PI) / 180);
    const pfType: 'Lagging' | 'Leading' | 'Unity' =
      Math.abs(zAngleDeg) < 0.05 ? 'Unity' : zAngleDeg > 0 ? 'Lagging' : 'Leading';

    return {
      ok: true,
      data: {
        topology,
        omegaRad,
        xlOhm,
        xcOhm,
        impedanceMagOhm: zMag,
        impedancePhaseDeg: zAngleDeg,
        currentMagA: iMag,
        currentPhaseDeg: (iAngleRad * 180) / Math.PI,
        powerFactor: pf,
        pfType,
        activePowerW: voltageRms * iMag * pf,
        reactivePowerVar: voltageRms * iMag * Math.sin((zAngleDeg * Math.PI) / 180),
        apparentPowerVa: voltageRms * iMag,
        resonantFreqHz,
        voltagePhasors,
        currentPhasors,
      },
    };
  }

  // Parallel RLC: Y = G + j(Bc - Bl)
  if (resistanceOhm < 1e-9 || (xlOhm > 0 && xlOhm < 1e-9)) {
    return { ok: false, error: 'Parallel branch resistance R (and XL if L > 0) must be > 0 Ω.' };
  }
  const G = 1 / resistanceOhm;
  const Bl = xlOhm > 1e-9 ? 1 / xlOhm : 0;
  const Bc = 1 / xcOhm;
  const yRe = G;
  const yIm = Bc - Bl;
  const yMag = Math.hypot(yRe, yIm);
  if (yMag < 1e-12) {
    return { ok: false, error: 'Admittance is zero.' };
  }
  const zMag = 1 / yMag;
  const zAngleDeg = (-Math.atan2(yIm, yRe) * 180) / Math.PI;

  const irRe = voltageRms * G;
  const ilIm = -voltageRms * Bl;
  const icIm = voltageRms * Bc;
  const iTotalRe = irRe;
  const iTotalIm = icIm + ilIm;
  const iMag = Math.hypot(iTotalRe, iTotalIm);
  const iAngleDeg = (Math.atan2(iTotalIm, iTotalRe) * 180) / Math.PI;

  voltagePhasors.push({
    id: 'Vs',
    label: 'Vs (Bus Voltage)',
    re: voltageRms,
    im: 0,
    mag: voltageRms,
    angleDeg: 0,
    unit: 'V',
    colorKey: 'slate',
  });

  currentPhasors.push(
    {
      id: 'Itot',
      label: 'I_total',
      re: iTotalRe,
      im: iTotalIm,
      mag: iMag,
      angleDeg: iAngleDeg,
      unit: 'A',
      colorKey: 'primary',
    },
    {
      id: 'IR',
      label: 'IR',
      re: irRe,
      im: 0,
      mag: irRe,
      angleDeg: 0,
      unit: 'A',
      colorKey: 'emerald',
    },
    {
      id: 'IL',
      label: 'IL',
      re: 0,
      im: ilIm,
      mag: Math.abs(ilIm),
      angleDeg: ilIm !== 0 ? -90 : 0,
      unit: 'A',
      colorKey: 'amber',
    },
    {
      id: 'IC',
      label: 'IC',
      re: 0,
      im: icIm,
      mag: Math.abs(icIm),
      angleDeg: 90,
      unit: 'A',
      colorKey: 'rose',
    }
  );

  const pf = Math.cos((zAngleDeg * Math.PI) / 180);
  const pfType: 'Lagging' | 'Leading' | 'Unity' =
    Math.abs(zAngleDeg) < 0.05 ? 'Unity' : zAngleDeg > 0 ? 'Lagging' : 'Leading';

  return {
    ok: true,
    data: {
      topology,
      omegaRad,
      xlOhm,
      xcOhm,
      impedanceMagOhm: zMag,
      impedancePhaseDeg: zAngleDeg,
      currentMagA: iMag,
      currentPhaseDeg: iAngleDeg,
      powerFactor: pf,
      pfType,
      activePowerW: voltageRms * iTotalRe,
      reactivePowerVar: -voltageRms * iTotalIm,
      apparentPowerVa: voltageRms * iMag,
      resonantFreqHz,
      voltagePhasors,
      currentPhasors,
    },
  };
}

export function computePowerCircle(input: PowerCircleInput): ValidationResult<PowerCircleOutput> {
  const { vsKv, vrKv, reactanceOhm, deltaDeg, armatureLimitMva, fieldLimitMva, turbineMaxMw } = input;
  if (!Number.isFinite(vsKv) || vsKv <= 0 || !Number.isFinite(vrKv) || vrKv <= 0) {
    return { ok: false, error: 'Sending and receiving bus voltages (Vs, Vr) must be > 0 kV.' };
  }
  if (!Number.isFinite(reactanceOhm) || reactanceOhm <= 0) {
    return { ok: false, error: 'Line/synchronous reactance X must be > 0 Ω.' };
  }
  if (!Number.isFinite(deltaDeg) || deltaDeg < -90 || deltaDeg > 180) {
    return { ok: false, error: 'Power angle δ must lie within −90° to 180°.' };
  }
  if (
    !Number.isFinite(armatureLimitMva) ||
    armatureLimitMva <= 0 ||
    !Number.isFinite(fieldLimitMva) ||
    fieldLimitMva <= 0 ||
    !Number.isFinite(turbineMaxMw) ||
    turbineMaxMw <= 0
  ) {
    return { ok: false, error: 'Armature, field, and turbine capability limits must all be > 0.' };
  }

  // Lossless receiving-end power circle equations (3-phase line-to-line kV -> MW/Mvar):
  // P = (Vs * Vr / X) * sin(delta)
  // Q = (Vs * Vr / X) * cos(delta) - (Vr^2 / X)
  const circleRadiusMva = (vsKv * vrKv) / reactanceOhm;
  const qCenterMvar = -(vrKv * vrKv) / reactanceOhm;

  const locusPoints: PowerCirclePoint[] = [];
  for (let d = 0; d <= 180; d += 2) {
    const rad = (d * Math.PI) / 180;
    locusPoints.push({
      deltaDeg: d,
      pMw: circleRadiusMva * Math.sin(rad),
      qMvar: qCenterMvar + circleRadiusMva * Math.cos(rad),
    });
  }

  const opRad = (deltaDeg * Math.PI) / 180;
  const operatingP = circleRadiusMva * Math.sin(opRad);
  const operatingQ = qCenterMvar + circleRadiusMva * Math.cos(opRad);
  const operatingS = Math.hypot(operatingP, operatingQ);

  const steadyStateLimitMw = circleRadiusMva;
  const maxTheoreticalP = Math.min(steadyStateLimitMw, armatureLimitMva, turbineMaxMw);
  const stabilityMarginPct = ((steadyStateLimitMw - Math.max(0, operatingP)) / steadyStateLimitMw) * 100;

  // Distance from field circle center (0, qCenterMvar)
  const fieldDist = Math.hypot(operatingP, operatingQ - qCenterMvar);

  return {
    ok: true,
    data: {
      locusPoints,
      operatingP,
      operatingQ,
      operatingS,
      maxTheoreticalP,
      steadyStateLimitMw,
      qCenterMvar,
      circleRadiusMva,
      stabilityMarginPct,
      qMinMvar: qCenterMvar - Math.min(circleRadiusMva, fieldLimitMva),
      qMaxMvar: qCenterMvar + Math.min(circleRadiusMva, fieldLimitMva),
      withinArmatureLimit: operatingS <= armatureLimitMva + 1e-6,
      withinFieldLimit: fieldDist <= fieldLimitMva + 1e-6,
      withinTurbineLimit: operatingP <= turbineMaxMw + 1e-6,
      withinStabilityLimit: deltaDeg >= 0 && deltaDeg < 90,
    },
  };
}
