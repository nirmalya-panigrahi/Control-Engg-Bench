import type { Complex, ValidationResult } from '../types/bench';
import {
  evalRealPoly,
  findPolynomialRoots,
  polyToRealCoeffs,
  realPolyDerivative,
} from './complex';

export interface RootLocusBranchPoint {
  k: number;
  re: number;
  im: number;
}

export interface RootLocusOutput {
  openLoopPoles: Complex[];
  openLoopZeros: Complex[];
  branches: RootLocusBranchPoint[][];
  activePoles: Complex[];
  breakawayPoints: number[];
  kMax: number | null;
  oscillationFreqRad: number | null;
  asymptoteCentroid: number | null;
  asymptoteAnglesDeg: number[];
}

export interface RouthRow {
  power: number;
  values: number[];
  hasEpsilonSub?: boolean;
  fromAuxiliary?: boolean;
}

export interface RouthOutput {
  degree: number;
  coefficients: number[];
  routhTable: RouthRow[];
  rhpRootsCount: number;
  lhpRootsCount: number;
  jwRootsCount: number;
  isStable: boolean;
  isMarginallyStable: boolean;
  marginalFreqRad: number | null;
  roots: Complex[];
}

function buildCharPoly(den: number[], num: number[], k: number): number[] {
  const maxLen = Math.max(den.length, num.length);
  const poly = new Array(maxLen).fill(0);
  for (let i = 0; i < den.length; i++) {
    poly[maxLen - den.length + i] += den[i];
  }
  for (let i = 0; i < num.length; i++) {
    poly[maxLen - num.length + i] += k * num[i];
  }
  return poly;
}

/**
 * Matches new roots to previous roots by minimum Euclidean distance
 * so each locus branch forms a smooth continuous path.
 */
function matchRootsToBranches(prev: Complex[], next: Complex[]): Complex[] {
  const n = prev.length;
  const used = new Array(n).fill(false);
  const matched: Complex[] = new Array(n);

  // Greedy best-pair assignment sorted by distance
  const pairs: Array<{ i: number; j: number; dist: number }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < next.length; j++) {
      const dist = Math.hypot(prev[i].re - next[j].re, prev[i].im - next[j].im);
      pairs.push({ i, j, dist });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  const assignedPrev = new Array(n).fill(false);
  for (const p of pairs) {
    if (!assignedPrev[p.i] && !used[p.j]) {
      assignedPrev[p.i] = true;
      used[p.j] = true;
      matched[p.i] = next[p.j];
    }
  }
  return matched;
}

export function computeRootLocus(
  poles: Complex[],
  zeros: Complex[],
  activeGainK: number,
  kSweepMax = 100
): ValidationResult<RootLocusOutput> {
  if (poles.length === 0) {
    return { ok: false, error: 'Root locus requires at least one open-loop pole.' };
  }
  if (zeros.length > poles.length) {
    return { ok: false, error: 'Transfer function must be proper (zeros ≤ poles).' };
  }
  if (!Number.isFinite(activeGainK) || activeGainK < 0) {
    return { ok: false, error: 'Gain K must be a finite non-negative number (≥ 0).' };
  }
  if (!Number.isFinite(kSweepMax) || kSweepMax <= 0) {
    return { ok: false, error: 'Sweep upper bound K_sweep must be > 0.' };
  }
  for (const pt of [...poles, ...zeros]) {
    if (!Number.isFinite(pt.re) || !Number.isFinite(pt.im)) {
      return { ok: false, error: 'All pole and zero coordinates must be finite numbers.' };
    }
  }

  const den = polyToRealCoeffs(poles);
  const num = polyToRealCoeffs(zeros);
  const maxK = Math.max(kSweepMax, activeGainK * 1.25);

  // Build dense non-uniform K grid (concentrated near 0 and smoothly expanding)
  const steps = 160;
  const kValues: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    kValues.push(maxK * Math.pow(u, 2.2));
  }

  const nBranches = poles.length;
  const branches: RootLocusBranchPoint[][] = Array.from({ length: nBranches }, () => []);

  let prevRoots = [...poles];
  for (let i = 0; i < nBranches; i++) {
    branches[i].push({ k: 0, re: prevRoots[i].re, im: prevRoots[i].im });
  }

  for (let idx = 1; idx < kValues.length; idx++) {
    const k = kValues[idx];
    const poly = buildCharPoly(den, num, k);
    const roots = findPolynomialRoots(poly);
    if (roots.length === nBranches) {
      const matched = matchRootsToBranches(prevRoots, roots);
      for (let b = 0; b < nBranches; b++) {
        branches[b].push({ k, re: matched[b].re, im: matched[b].im });
      }
      prevRoots = matched;
    }
  }

  const activePoly = buildCharPoly(den, num, activeGainK);
  const activePoles = findPolynomialRoots(activePoly);

  // Breakaway / break-in points: roots of N(s)D'(s) - D(s)N'(s) = 0 that yield K > 0
  const dPrime = realPolyDerivative(den);
  const nPrime = realPolyDerivative(num);
  // Multiply polynomials helper
  const mulPoly = (a: number[], b: number[]): number[] => {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        out[i + j] += a[i] * b[j];
      }
    }
    return out;
  };
  const term1 = mulPoly(num, dPrime);
  const term2 = mulPoly(den, nPrime);
  const len = Math.max(term1.length, term2.length);
  const breakPoly = new Array(len).fill(0);
  for (let i = 0; i < term1.length; i++) breakPoly[len - term1.length + i] += term1[i];
  for (let i = 0; i < term2.length; i++) breakPoly[len - term2.length + i] -= term2[i];

  const candRoots = findPolynomialRoots(breakPoly);
  const breakawayPoints: number[] = [];
  for (const r of candRoots) {
    if (Math.abs(r.im) < 1e-4) {
      const nVal = evalRealPoly(num, { re: r.re, im: 0 });
      const dVal = evalRealPoly(den, { re: r.re, im: 0 });
      if (Math.abs(nVal.re) > 1e-8) {
        const kAtPoint = -dVal.re / nVal.re;
        if (kAtPoint > 0 && Number.isFinite(kAtPoint)) {
          if (!breakawayPoints.some((x) => Math.abs(x - r.re) < 1e-3)) {
            breakawayPoints.push(r.re);
          }
        }
      }
    }
  }

  // Instability gain K_max via crossing from LHP to RHP across extended sweep
  let kMax: number | null = null;
  let oscillationFreqRad: number | null = null;
  const searchK = [0];
  for (let i = 1; i <= 200; i++) {
    searchK.push(Math.pow(10, -2 + (6 * i) / 200)); // 0.01 to 10000
  }
  const maxRealAtK = (k: number) => {
    const rts = findPolynomialRoots(buildCharPoly(den, num, k));
    return {
      maxRe: Math.max(...rts.map((r) => r.re)),
      roots: rts,
    };
  };

  let prevRes = maxRealAtK(searchK[0]);
  for (let i = 1; i < searchK.length; i++) {
    const currRes = maxRealAtK(searchK[i]);
    if (prevRes.maxRe <= 0 && currRes.maxRe > 0) {
      // Bisection refinement
      let lo = searchK[i - 1];
      let hi = searchK[i];
      for (let iter = 0; iter < 32; iter++) {
        const mid = 0.5 * (lo + hi);
        const midRes = maxRealAtK(mid);
        if (midRes.maxRe > 0) hi = mid;
        else lo = mid;
      }
      kMax = 0.5 * (lo + hi);
      const crossRoots = maxRealAtK(kMax).roots;
      const jwRoot = crossRoots.reduce((best, cur) =>
        Math.abs(cur.re) < Math.abs(best.re) ? cur : best
      );
      oscillationFreqRad = Math.abs(jwRoot.im);
      break;
    }
    prevRes = currRes;
  }

  // Asymptotes if relative degree >= 1
  const relDeg = poles.length - zeros.length;
  let asymptoteCentroid: number | null = null;
  const asymptoteAnglesDeg: number[] = [];
  if (relDeg > 0) {
    const sumP = poles.reduce((acc, p) => acc + p.re, 0);
    const sumZ = zeros.reduce((acc, z) => acc + z.re, 0);
    asymptoteCentroid = (sumP - sumZ) / relDeg;
    for (let m = 0; m < relDeg; m++) {
      asymptoteAnglesDeg.push(((2 * m + 1) * 180) / relDeg);
    }
  }

  return {
    ok: true,
    data: {
      openLoopPoles: poles,
      openLoopZeros: zeros,
      branches,
      activePoles,
      breakawayPoints,
      kMax,
      oscillationFreqRad,
      asymptoteCentroid,
      asymptoteAnglesDeg,
    },
  };
}

export function computeRouthHurwitz(rawCoeffs: number[]): ValidationResult<RouthOutput> {
  if (rawCoeffs.length < 2) {
    return { ok: false, error: 'Characteristic polynomial must have degree ≥ 1 (at least 2 coefficients).' };
  }
  for (const c of rawCoeffs) {
    if (!Number.isFinite(c)) {
      return { ok: false, error: 'All polynomial coefficients must be finite numbers.' };
    }
  }
  if (Math.abs(rawCoeffs[0]) < 1e-12) {
    return { ok: false, error: 'Leading coefficient a_n must be non-zero.' };
  }

  // Normalize sign so a_n > 0 for consistent Routh analysis
  const sign = rawCoeffs[0] < 0 ? -1 : 1;
  const coeffs = rawCoeffs.map((v) => v * sign);
  const degree = coeffs.length - 1;

  const cols = Math.ceil((degree + 1) / 2);
  const row0 = new Array(cols).fill(0);
  const row1 = new Array(cols).fill(0);

  for (let i = 0; i < coeffs.length; i++) {
    if (i % 2 === 0) row0[i / 2] = coeffs[i];
    else row1[(i - 1) / 2] = coeffs[i];
  }

  const table: RouthRow[] = [
    { power: degree, values: row0 },
    { power: degree - 1, values: row1 },
  ];

  const EPS = 1e-6;
  let marginalFreqRad: number | null = null;

  for (let r = 2; r <= degree; r++) {
    const prev2 = table[r - 2].values;
    const prev1 = table[r - 1].values;
    const power = degree - r;

    // Check if prev1 is all zeros -> Auxiliary polynomial from prev2!
    const prev1AllZero = prev1.every((v) => Math.abs(v) < 1e-11);
    let workingPrev1 = [...prev1];
    let fromAux = false;

    if (prev1AllZero) {
      fromAux = true;
      const auxPower = degree - (r - 2);
      const auxRow: number[] = [];
      for (let cIdx = 0; cIdx < prev2.length; cIdx++) {
        const exp = auxPower - 2 * cIdx;
        if (exp > 0) {
          auxRow.push(prev2[cIdx] * exp);
        } else {
          auxRow.push(0);
        }
      }
      workingPrev1 = auxRow;
      table[r - 1] = {
        ...table[r - 1],
        values: workingPrev1,
        fromAuxiliary: true,
      };
    }

    let pivot = workingPrev1[0];
    let hasEps = false;
    if (Math.abs(pivot) < 1e-11) {
      pivot = EPS;
      hasEps = true;
    }

    const nextRow = new Array(cols).fill(0);
    for (let cIdx = 0; cIdx < cols - 1; cIdx++) {
      const a = prev2[cIdx + 1] ?? 0;
      const b = workingPrev1[cIdx + 1] ?? 0;
      nextRow[cIdx] = (pivot * a - prev2[0] * b) / pivot;
    }

    table.push({
      power,
      values: nextRow,
      hasEpsilonSub: hasEps || undefined,
      fromAuxiliary: fromAux || undefined,
    });
  }

  // Also solve exact roots via Aberth-Ehrlich for s-plane visualization & exact RHP/jw counts
  const roots = findPolynomialRoots(coeffs);
  const rhpRootsCount = roots.filter((r) => r.re > 1e-5).length;
  const jwRoots = roots.filter((r) => Math.abs(r.re) <= 1e-5);
  const jwRootsCount = jwRoots.length;
  const lhpRootsCount = roots.length - rhpRootsCount - jwRootsCount;

  if (jwRoots.length > 0) {
    const posImag = jwRoots.map((r) => Math.abs(r.im)).filter((im) => im > 1e-5);
    if (posImag.length > 0) {
      marginalFreqRad = Math.min(...posImag);
    }
  }

  // Verify first column sign changes if no auxiliary/zero edge case obscured it
  const firstCol = table.map((row) => row.values[0]);
  let signChanges = 0;
  let lastSign = Math.sign(firstCol[0]);
  for (let i = 1; i < firstCol.length; i++) {
    const s = Math.abs(firstCol[i]) < 1e-10 ? lastSign : Math.sign(firstCol[i]);
    if (s !== 0 && lastSign !== 0 && s !== lastSign) {
      signChanges++;
    }
    if (s !== 0) lastSign = s;
  }

  const effectiveRhp = Math.max(rhpRootsCount, signChanges > 0 && jwRootsCount === 0 ? signChanges : rhpRootsCount);
  const isStable = effectiveRhp === 0 && jwRootsCount === 0;
  const isMarginallyStable = effectiveRhp === 0 && jwRootsCount > 0;

  return {
    ok: true,
    data: {
      degree,
      coefficients: coeffs,
      routhTable: table,
      rhpRootsCount: effectiveRhp,
      lhpRootsCount,
      jwRootsCount,
      isStable,
      isMarginallyStable,
      marginalFreqRad,
      roots,
    },
  };
}
