import type { Complex } from '../types/bench';

export function c(re: number, im = 0): Complex {
  return { re, im };
}

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < 1e-30) {
    return { re: Number.POSITIVE_INFINITY, im: Number.POSITIVE_INFINITY };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

export function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

export function cArgRad(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

export function cArgDeg(a: Complex): number {
  return (Math.atan2(a.im, a.re) * 180) / Math.PI;
}

export function cScale(a: Complex, k: number): Complex {
  return { re: a.re * k, im: a.im * k };
}

export function cExp(a: Complex): Complex {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
}

export function cFormat(a: Complex, digits = 3): string {
  const re = Math.abs(a.re) < 1e-9 ? 0 : a.re;
  const im = Math.abs(a.im) < 1e-9 ? 0 : a.im;
  if (Math.abs(im) < 1e-6) {
    return re.toFixed(digits);
  }
  const sign = im >= 0 ? '+' : '−';
  return `${re.toFixed(digits)} ${sign} j${Math.abs(im).toFixed(digits)}`;
}

/**
 * Constructs a monic real/complex polynomial (descending powers: [1, c_{n-1}, ..., c_0])
 * from a list of roots.
 */
export function polyFromRoots(roots: Complex[]): Complex[] {
  let poly: Complex[] = [{ re: 1, im: 0 }];
  for (const r of roots) {
    const next: Complex[] = new Array(poly.length + 1).fill(null).map(() => ({ re: 0, im: 0 }));
    for (let i = 0; i < poly.length; i++) {
      next[i] = cAdd(next[i], poly[i]);
      next[i + 1] = cSub(next[i + 1], cMul(poly[i], r));
    }
    poly = next;
  }
  return poly;
}

export function polyToRealCoeffs(roots: Complex[]): number[] {
  return polyFromRoots(roots).map((coeff) => (Math.abs(coeff.re) < 1e-10 ? 0 : coeff.re));
}

export function evalComplexPoly(coeffs: Complex[], s: Complex): Complex {
  let acc: Complex = { re: 0, im: 0 };
  for (const coeff of coeffs) {
    acc = cAdd(cMul(acc, s), coeff);
  }
  return acc;
}

export function evalRealPoly(coeffs: number[], s: Complex): Complex {
  let acc: Complex = { re: 0, im: 0 };
  for (const coeff of coeffs) {
    acc = cAdd(cMul(acc, s), { re: coeff, im: 0 });
  }
  return acc;
}

export function realPolyDerivative(coeffs: number[]): number[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [0];
  const deriv: number[] = [];
  for (let i = 0; i < n; i++) {
    deriv.push(coeffs[i] * (n - i));
  }
  return deriv;
}

/**
 * Finds all roots of a real polynomial a_n s^n + ... + a_0 = 0
 * using the Aberth-Ehrlich method with zero-root deflation.
 */
export function findPolynomialRoots(rawCoeffs: number[]): Complex[] {
  // Strip leading near-zeros
  let start = 0;
  while (start < rawCoeffs.length - 1 && Math.abs(rawCoeffs[start]) < 1e-14) {
    start++;
  }
  const coeffs = rawCoeffs.slice(start);
  if (coeffs.length <= 1 || Math.abs(coeffs[0]) < 1e-14) {
    return [];
  }

  // Deflate trailing zero roots (s = 0)
  const roots: Complex[] = [];
  let end = coeffs.length;
  while (end > 1 && Math.abs(coeffs[end - 1]) < 1e-14) {
    roots.push({ re: 0, im: 0 });
    end--;
  }
  const active = coeffs.slice(0, end);
  const deg = active.length - 1;
  if (deg === 0) return roots;

  if (deg === 1) {
    roots.push({ re: -active[1] / active[0], im: 0 });
    return roots;
  }

  if (deg === 2) {
    const [a, b, cVal] = active;
    const disc = b * b - 4 * a * cVal;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      roots.push({ re: (-b + sq) / (2 * a), im: 0 });
      roots.push({ re: (-b - sq) / (2 * a), im: 0 });
    } else {
      const sq = Math.sqrt(-disc);
      roots.push({ re: -b / (2 * a), im: sq / (2 * a) });
      roots.push({ re: -b / (2 * a), im: -sq / (2 * a) });
    }
    return roots;
  }

  // Normalize monic polynomial
  const norm = active.map((v) => v / active[0]);
  const deriv = realPolyDerivative(norm);

  // Cauchy upper bound for root radius
  let maxOther = 0;
  for (let i = 1; i < norm.length; i++) {
    maxOther = Math.max(maxOther, Math.abs(norm[i]));
  }
  const radius = 1 + maxOther * 0.65;
  const center = -norm[1] / deg;

  const z: Complex[] = [];
  for (let k = 0; k < deg; k++) {
    const angle = (2 * Math.PI * k) / deg + 0.37;
    const r = radius * (0.65 + 0.35 * ((k % 3) / 3));
    z.push({
      re: center + r * Math.cos(angle),
      im: r * Math.sin(angle),
    });
  }

  for (let iter = 0; iter < 120; iter++) {
    let maxStep = 0;
    for (let i = 0; i < deg; i++) {
      const pVal = evalRealPoly(norm, z[i]);
      const dpVal = evalRealPoly(deriv, z[i]);
      if (cAbs(pVal) < 1e-13) continue;

      let sumInv = { re: 0, im: 0 };
      for (let j = 0; j < deg; j++) {
        if (i === j) continue;
        const diff = cSub(z[i], z[j]);
        if (cAbs(diff) > 1e-14) {
          sumInv = cAdd(sumInv, cDiv({ re: 1, im: 0 }, diff));
        }
      }

      const ratio = cDiv(pVal, cAbs(dpVal) > 1e-15 ? dpVal : { re: 1e-12, im: 1e-12 });
      const denom = cSub({ re: 1, im: 0 }, cMul(ratio, sumInv));
      const step = cDiv(ratio, cAbs(denom) > 1e-15 ? denom : { re: 1, im: 0 });
      z[i] = cSub(z[i], step);
      maxStep = Math.max(maxStep, cAbs(step));
    }
    if (maxStep < 1e-11) break;
  }

  for (const root of z) {
    roots.push({
      re: Math.abs(root.re) < 1e-9 ? 0 : root.re,
      im: Math.abs(root.im) < 1e-8 ? 0 : root.im,
    });
  }

  return roots;
}

export function evalTransferFunction(
  zeros: Complex[],
  poles: Complex[],
  gain: number,
  s: Complex,
  timeDelay = 0
): Complex {
  let num: Complex = { re: gain, im: 0 };
  for (const z of zeros) {
    num = cMul(num, cSub(s, z));
  }
  let den: Complex = { re: 1, im: 0 };
  for (const p of poles) {
    den = cMul(den, cSub(s, p));
  }
  if (cAbs(den) < 1e-12) {
    return { re: Number.NaN, im: Number.NaN };
  }
  let val = cDiv(num, den);
  if (timeDelay > 0) {
    const delayFactor = cExp({ re: -s.re * timeDelay, im: -s.im * timeDelay });
    val = cMul(val, delayFactor);
  }
  return val;
}
