import { describe, expect, it } from 'vitest';
import { computePhasorDiagram, computePowerCircle } from '../math/acAndPower';
import { findPolynomialRoots } from '../math/complex';
import { computeBode, computeNichols, computeNyquist } from '../math/controlFrequency';
import { computeRootLocus, computeRouthHurwitz } from '../math/controlSPlane';
import {
  computeStepResponse,
  computeTorqueSpeed,
  computeTransformerEfficiency,
} from '../math/machinesAndTime';
import {
  computePidRecommendations,
  fitFopdtModel,
  parseStepResponseCsv,
  simulateClosedLoopPid,
} from '../math/pidTuner';

describe('Complex Polynomial Root Finder', () => {
  it('solves quadratic, cubic, and zero-deflated polynomials accurately (Blue Pill)', () => {
    // (s)(s + 2)(s + 5) = s^3 + 7s^2 + 10s
    const roots = findPolynomialRoots([1, 7, 10, 0]);
    const reals = roots.map((r) => r.re).sort((a, b) => a - b);
    expect(reals).toHaveLength(3);
    expect(reals[0]).toBeCloseTo(-5, 5);
    expect(reals[1]).toBeCloseTo(-2, 5);
    expect(reals[2]).toBeCloseTo(0, 5);

    // Complex conjugate roots: s^2 + 2s + 5 = 0 -> -1 ± j2
    const cRoots = findPolynomialRoots([1, 2, 5]);
    expect(cRoots).toHaveLength(2);
    expect(cRoots[0].re).toBeCloseTo(-1, 5);
    expect(Math.abs(cRoots[0].im)).toBeCloseTo(2, 5);
  });
});

describe('Frequency Control Solvers (Nyquist, Bode, Nichols)', () => {
  const stablePlant = {
    zeros: [],
    poles: [
      { re: 0, im: 0 },
      { re: -2, im: 0 },
      { re: -5, im: 0 },
    ],
    gain: 8,
    wMin: 0.05,
    wMax: 100,
  };

  it('computes stable Nyquist margins and detects instability at high gain (Blue Pill)', () => {
    const stableRes = computeNyquist(stablePlant);
    expect(stableRes.ok).toBe(true);
    if (stableRes.ok) {
      expect(stableRes.data.isClosedLoopStable).toBe(true);
      expect(stableRes.data.closedLoopRhpPoles).toBe(0);
      expect(stableRes.data.gainMarginDb).toBeGreaterThan(10);
      expect(stableRes.data.phaseMarginDeg).toBeGreaterThan(20);
    }

    // For K / (s(s+2)(s+5)), K_max = 70 -> K=120 is unstable
    const unstableRes = computeNyquist({ ...stablePlant, gain: 120 });
    expect(unstableRes.ok).toBe(true);
    if (unstableRes.ok) {
      expect(unstableRes.data.isClosedLoopStable).toBe(false);
      expect(unstableRes.data.closedLoopRhpPoles).toBe(2);
      expect(unstableRes.data.encirclementsN).toBe(2);
    }
  });

  it('computes Bode crossover frequencies, bandwidth, and delay phase lag (Blue Pill)', () => {
    const res = computeBode({ ...stablePlant, timeDelay: 0.1 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.points.length).toBeGreaterThan(100);
      expect(res.data.gainCrossoverRad).not.toBeNull();
      expect(res.data.phaseCrossoverRad).not.toBeNull();
      expect(res.data.bandwidthRad).not.toBeNull();
    }
  });

  it('computes Nichols M-contours and closed-loop resonant peak (Blue Pill)', () => {
    const res = computeNichols(stablePlant);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.contours.length).toBe(7);
      expect(Number.isFinite(res.data.resonantPeakDb)).toBe(true);
      expect(res.data.resonantFreqRad).toBeGreaterThan(0);
    }
  });

  it('rejects improper transfer functions and invalid sweep/gain inputs (Red Pill)', () => {
    const improper = computeBode({
      zeros: [{ re: -1, im: 0 }, { re: -2, im: 0 }],
      poles: [{ re: -3, im: 0 }],
      gain: 5,
      wMin: 0.1,
      wMax: 10,
    });
    expect(improper.ok).toBe(false);

    const negGain = computeNyquist({ ...stablePlant, gain: -2 });
    expect(negGain.ok).toBe(false);

    const badSweep = computeNichols({ ...stablePlant, wMin: 50, wMax: 10 });
    expect(badSweep.ok).toBe(false);

    const nanVal = computeBode({ ...stablePlant, gain: Number.NaN });
    expect(nanVal.ok).toBe(false);
  });
});

describe('s-Plane Control Solvers (Root Locus & Routh-Hurwitz)', () => {
  it('tracks Root Locus branches and exact instability gain K_max = 70 (Blue Pill)', () => {
    const poles = [
      { re: 0, im: 0 },
      { re: -2, im: 0 },
      { re: -5, im: 0 },
    ];
    const res = computeRootLocus(poles, [], 10, 100);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.branches).toHaveLength(3);
      expect(res.data.activePoles).toHaveLength(3);
      expect(res.data.kMax).not.toBeNull();
      expect(res.data.kMax!).toBeCloseTo(70, 0);
      expect(res.data.oscillationFreqRad!).toBeCloseTo(Math.sqrt(10), 1);
      expect(res.data.breakawayPoints.length).toBeGreaterThan(0);
    }
  });

  it('builds Routh table for stable, unstable, and jw-marginal systems (Blue Pill)', () => {
    // Stable: (s+1)(s+2)(s+3) = s^3 + 6s^2 + 11s + 6
    const stable = computeRouthHurwitz([1, 6, 11, 6]);
    expect(stable.ok).toBe(true);
    if (stable.ok) {
      expect(stable.data.isStable).toBe(true);
      expect(stable.data.rhpRootsCount).toBe(0);
    }

    // Marginal: (s+2)(s^2 + 5) = s^3 + 2s^2 + 5s + 10
    const marginal = computeRouthHurwitz([1, 2, 5, 10]);
    expect(marginal.ok).toBe(true);
    if (marginal.ok) {
      expect(marginal.data.isMarginallyStable).toBe(true);
      expect(marginal.data.jwRootsCount).toBe(2);
      expect(marginal.data.marginalFreqRad!).toBeCloseTo(Math.sqrt(5), 2);
    }

    // Unstable: (s-1)(s+2)(s+3) = s^3 + 4s^2 + s - 6
    const unstable = computeRouthHurwitz([1, 4, 1, -6]);
    expect(unstable.ok).toBe(true);
    if (unstable.ok) {
      expect(unstable.data.isStable).toBe(false);
      expect(unstable.data.rhpRootsCount).toBe(1);
    }
  });

  it('rejects invalid Root Locus and Routh-Hurwitz inputs (Red Pill)', () => {
    expect(computeRootLocus([], [], 5).ok).toBe(false);
    expect(computeRootLocus([{ re: -1, im: 0 }], [], -5).ok).toBe(false);
    expect(computeRouthHurwitz([0, 2, 3]).ok).toBe(false);
    expect(computeRouthHurwitz([5]).ok).toBe(false);
    expect(computeRouthHurwitz([1, Number.NaN, 2]).ok).toBe(false);
  });
});

describe('AC & Power Solvers (Phasor & Power Circle)', () => {
  it('computes series and parallel RLC phasors and resonance frequency (Blue Pill)', () => {
    const res = computePhasorDiagram({
      topology: 'series',
      voltageRms: 230,
      frequencyHz: 50,
      resistanceOhm: 10,
      inductanceMh: 100,
      capacitanceUf: 100,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const expectedXl = 2 * Math.PI * 50 * 0.1;
      const expectedXc = 1 / (2 * Math.PI * 50 * 1e-4);
      expect(res.data.xlOhm).toBeCloseTo(expectedXl, 4);
      expect(res.data.xcOhm).toBeCloseTo(expectedXc, 4);
      expect(res.data.impedanceMagOhm).toBeCloseTo(Math.hypot(10, expectedXl - expectedXc), 4);
      expect(res.data.powerFactor).toBeGreaterThan(0);
      expect(res.data.powerFactor).toBeLessThanOrEqual(1);
    }

    const par = computePhasorDiagram({
      topology: 'parallel',
      voltageRms: 120,
      frequencyHz: 60,
      resistanceOhm: 30,
      inductanceMh: 50,
      capacitanceUf: 80,
    });
    expect(par.ok).toBe(true);
    if (par.ok) {
      expect(par.data.currentPhasors.length).toBe(4);
    }
  });

  it('computes Power Circle steady-state limit and operating P/Q (Blue Pill)', () => {
    const res = computePowerCircle({
      vsKv: 138,
      vrKv: 132,
      reactanceOhm: 42,
      deltaDeg: 30,
      armatureLimitMva: 400,
      fieldLimitMva: 450,
      turbineMaxMw: 350,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const pMax = (138 * 132) / 42;
      expect(res.data.steadyStateLimitMw).toBeCloseTo(pMax, 3);
      expect(res.data.operatingP).toBeCloseTo(pMax * 0.5, 3);
      expect(res.data.withinStabilityLimit).toBe(true);
    }
  });

  it('rejects invalid AC circuit and power circle parameters (Red Pill)', () => {
    expect(
      computePhasorDiagram({
        topology: 'series',
        voltageRms: 0,
        frequencyHz: 50,
        resistanceOhm: 10,
        inductanceMh: 10,
        capacitanceUf: 10,
      }).ok
    ).toBe(false);

    expect(
      computePhasorDiagram({
        topology: 'series',
        voltageRms: 100,
        frequencyHz: 50,
        resistanceOhm: 10,
        inductanceMh: 10,
        capacitanceUf: 0,
      }).ok
    ).toBe(false);

    expect(
      computePowerCircle({
        vsKv: 138,
        vrKv: 132,
        reactanceOhm: 0,
        deltaDeg: 30,
        armatureLimitMva: 300,
        fieldLimitMva: 300,
        turbineMaxMw: 300,
      }).ok
    ).toBe(false);
  });
});

describe('Machines & Time-Domain Solvers', () => {
  it('computes 3-phase motor Torque-Speed characteristic accurately (Blue Pill)', () => {
    const res = computeTorqueSpeed({
      voltageLl: 460,
      frequencyHz: 60,
      poles: 4,
      statorResistanceOhm: 0.45,
      statorReactanceOhm: 1.1,
      rotorResistanceOhm: 0.38,
      rotorReactanceOhm: 1.2,
      ratedSlip: 0.035,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.synchronousSpeedRpm).toBeCloseTo(1800, 4);
      expect(res.data.breakdownTorqueNm).toBeGreaterThan(res.data.ratedTorqueNm);
      expect(res.data.breakdownTorqueNm).toBeGreaterThan(res.data.startingTorqueNm);
      expect(res.data.speedRegulationPct).toBeGreaterThan(0);
    }
  });

  it('computes Transformer Efficiency and exact optimal load x = sqrt(Pi / Pcu) (Blue Pill)', () => {
    const res = computeTransformerEfficiency({
      ratedKva: 100,
      coreLossW: 400,
      fullLoadCopperLossW: 1600,
      powerFactor: 0.9,
      loadFraction: 0.5,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.maxEfficiencyLoadFraction).toBeCloseTo(0.5, 5);
      expect(res.data.operatingEfficiencyPct).toBeCloseTo(res.data.maxEfficiencyPct, 4);
      expect(res.data.maxEfficiencyPct).toBeLessThan(100);
    }
  });

  it('computes 2nd-Order Step Response across all damping regimes (Blue Pill)', () => {
    const under = computeStepResponse({ zeta: 0.4, omegaN: 5, amplitude: 2 });
    expect(under.ok).toBe(true);
    if (under.ok) {
      expect(under.data.regime).toBe('Underdamped');
      const expectedOs = 100 * Math.exp((-Math.PI * 0.4) / Math.sqrt(1 - 0.16));
      expect(under.data.percentOvershoot).toBeCloseTo(expectedOs, 4);
      expect(under.data.peakTimeSec).toBeCloseTo(Math.PI / (5 * Math.sqrt(1 - 0.16)), 4);
      expect(under.data.riseTimeSec).not.toBeNull();
    }

    const crit = computeStepResponse({ zeta: 1, omegaN: 5, amplitude: 1 });
    expect(crit.ok && crit.data.regime === 'Critically Damped' && crit.data.percentOvershoot === 0).toBe(true);

    const over = computeStepResponse({ zeta: 1.6, omegaN: 5, amplitude: 1 });
    expect(over.ok && over.data.regime === 'Overdamped' && over.data.percentOvershoot === 0).toBe(true);

    const undamped = computeStepResponse({ zeta: 0, omegaN: 4, amplitude: 1 });
    expect(undamped.ok && undamped.data.regime === 'Undamped' && undamped.data.percentOvershoot === 100).toBe(true);
  });

  it('rejects invalid machine and step response inputs (Red Pill)', () => {
    // Odd motor poles
    expect(
      computeTorqueSpeed({
        voltageLl: 460,
        frequencyHz: 60,
        poles: 3,
        statorResistanceOhm: 0.4,
        statorReactanceOhm: 1,
        rotorResistanceOhm: 0.3,
        rotorReactanceOhm: 1,
        ratedSlip: 0.03,
      }).ok
    ).toBe(false);

    // Power factor > 1
    expect(
      computeTransformerEfficiency({
        ratedKva: 100,
        coreLossW: 400,
        fullLoadCopperLossW: 1600,
        powerFactor: 1.25,
        loadFraction: 0.8,
      }).ok
    ).toBe(false);

    // Negative damping ratio
    expect(computeStepResponse({ zeta: -0.2, omegaN: 4, amplitude: 1 }).ok).toBe(false);
    // Zero natural frequency
    expect(computeStepResponse({ zeta: 0.5, omegaN: 0, amplitude: 1 }).ok).toBe(false);
  });
});

describe('CSV Step ID & PID Auto-Tuner Solvers', () => {
  it('parses 2-column and 3-column CSVs and recovers exact FOPDT parameters (Blue Pill)', () => {
    // True FOPDT: y0 = 20, Kp = 4.0, tau = 3.5s, theta = 1.5s, step at t=1.0, du=2.0
    const lines = ['t,y,u'];
    for (let t = 0; t <= 22; t += 0.5) {
      const u = t >= 1.0 ? 2.0 : 0.0;
      const dt = t - 1.0 - 1.5;
      const y = dt <= 0 ? 20 : 20 + 4.0 * 2.0 * (1 - Math.exp(-dt / 3.5));
      lines.push(`${t},${y.toFixed(5)},${u}`);
    }

    const parsed = parseStepResponseCsv(lines.join('\n'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.data.hasInputColumn).toBe(true);
    expect(parsed.data.detectedDeltaU).toBeCloseTo(2.0, 5);

    const fit = fitFopdtModel(parsed.data);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;

    expect(fit.data.kp).toBeCloseTo(4.0, 1);
    expect(fit.data.tau).toBeCloseTo(3.5, 1);
    expect(fit.data.theta).toBeCloseTo(1.5, 1);
    expect(fit.data.rSquared).toBeGreaterThan(0.99);

    const recs = computePidRecommendations(fit.data);
    expect(recs).toHaveLength(5);
    const imc = recs.find((r) => r.id === 'imc')!;
    const zn = recs.find((r) => r.id === 'zn')!;
    expect(imc.kc).toBeGreaterThan(0);
    expect(zn.kc).toBeGreaterThan(imc.kc); // ZN is more aggressive than default IMC

    const sim = simulateClosedLoopPid({
      model: fit.data,
      kc: imc.kc,
      ti: imc.ti,
      td: imc.td,
      setpointStep: 1.0,
      disturbanceStep: -0.2,
    });
    expect(sim.ok).toBe(true);
    if (sim.ok) {
      expect(sim.data.isStable).toBe(true);
      expect(sim.data.points.length).toBeGreaterThan(100);
      expect(sim.data.iae).toBeGreaterThan(0);
    }
  });

  it('supports reverse-acting negative-gain processes cleanly (Blue Pill)', () => {
    const lines = ['t,temp'];
    for (let t = 0; t <= 15; t += 0.5) {
      const y = t <= 1 ? 50 : 50 - 6 * (1 - Math.exp(-(t - 1) / 2.5));
      lines.push(`${t},${y.toFixed(4)}`);
    }
    const parsed = parseStepResponseCsv(lines.join('\n'), 1.0);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const fit = fitFopdtModel(parsed.data, 0.5, 1.0);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;

    expect(fit.data.kp).toBeLessThan(0);
    const recs = computePidRecommendations(fit.data);
    expect(recs[0].kc).toBeLessThan(0); // Reverse-acting controller gain preserves negative feedback

    const sim = simulateClosedLoopPid({
      model: fit.data,
      kc: recs[0].kc,
      ti: recs[0].ti,
      td: recs[0].td,
      setpointStep: -1.0,
      disturbanceStep: 0,
    });
    expect(sim.ok).toBe(true);
    if (sim.ok) {
      expect(sim.data.isStable).toBe(true);
    }
  });

  it('rejects empty, non-monotonic, short, flat, or invalid PID inputs (Red Pill)', () => {
    expect(parseStepResponseCsv('').ok).toBe(false);
    expect(parseStepResponseCsv('t,y\n0,1\n1,2\n2,3').ok).toBe(false); // < 6 rows
    expect(
      parseStepResponseCsv('t,y\n0,1\n2,2\n1,3\n3,4\n4,5\n5,6').ok // non-increasing t
    ).toBe(false);
    expect(
      parseStepResponseCsv('t,y\n0,1\n1,abc\n2,3\n3,4\n4,5\n5,6').ok // non-numeric
    ).toBe(false);

    const flatParsed = parseStepResponseCsv('t,y\n0,5\n1,5\n2,5\n3,5\n4,5\n5,5');
    expect(flatParsed.ok).toBe(true);
    if (flatParsed.ok) {
      expect(fitFopdtModel(flatParsed.data).ok).toBe(false);
    }

    const validParsed = parseStepResponseCsv('t,y\n0,0\n1,1\n2,3\n3,5\n4,6\n5,6.5\n6,6.8');
    if (validParsed.ok) {
      const fit = fitFopdtModel(validParsed.data);
      if (fit.ok) {
        expect(
          simulateClosedLoopPid({
            model: fit.data,
            kc: 1,
            ti: 0, // invalid Ti <= 0
            td: 0,
            setpointStep: 1,
            disturbanceStep: 0,
          }).ok
        ).toBe(false);
      }
    }
  });
});
