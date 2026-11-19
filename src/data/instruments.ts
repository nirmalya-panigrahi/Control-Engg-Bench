import type { Complex, InstrumentDefinition } from '../types/bench';

export const INSTRUMENTS: InstrumentDefinition[] = [
  {
    id: 'nyquist',
    index: '01',
    name: 'Nyquist Plot',
    shortName: 'Nyquist',
    category: 'control',
    categoryLabel: 'Control Loops',
    description: 'Polar frequency-response plot of open-loop transfer function in the complex plane.',
    equation: 'G(jω) = K · ∏(jω − zᵢ) / ∏(jω − pⱼ)',
  },
  {
    id: 'bode',
    index: '02',
    name: 'Bode Plot (Magnitude & Phase)',
    shortName: 'Bode',
    category: 'control',
    categoryLabel: 'Control Loops',
    description: 'Dual logarithmic frequency plots showing system gain (dB) and phase shift (deg).',
    equation: '|G(jω)|dB = 20 log₁₀|G(jω)e⁻ʲωτC(jω)|',
  },
  {
    id: 'root-locus',
    index: '03',
    name: 'Root Locus Plot',
    shortName: 'Root Locus',
    category: 'control',
    categoryLabel: 'Control Loops',
    description: 'Tracks closed-loop pole trajectories in the complex s-plane as gain K varies.',
    equation: '1 + K · N(s)/D(s) = 0  ⇒  D(s) + K·N(s) = 0',
  },
  {
    id: 'nichols',
    index: '04',
    name: 'Nichols Chart',
    shortName: 'Nichols',
    category: 'control',
    categoryLabel: 'Control Loops',
    description: 'Maps open-loop gain (dB) and phase (deg) onto constant closed-loop M-contours.',
    equation: 'M = |G(jω) / (1 + G(jω))|,  ∠G(jω) vs |G(jω)|dB',
  },
  {
    id: 'routh-hurwitz',
    index: '05',
    name: 'Routh–Hurwitz s-Plane Map',
    shortName: 'Routh–Hurwitz',
    category: 'control',
    categoryLabel: 'Control Loops',
    description: 'Combines Routh array sign checks with visual complex s-plane pole region mapping.',
    equation: 'aₙsⁿ + aₙ₋₁sⁿ⁻¹ + … + a₁s + a₀ = 0',
  },
  {
    id: 'phasor',
    index: '06',
    name: 'Phasor Diagram',
    shortName: 'Phasor',
    category: 'ac-power',
    categoryLabel: 'AC & Power',
    description: 'Vector diagram of sinusoidal voltages, currents, and phase angles in AC RLC circuits.',
    equation: 'Z = R + j(ωL − 1/(ωC)),  I = V / Z',
  },
  {
    id: 'power-circle',
    index: '07',
    name: 'Power Circle Diagram',
    shortName: 'Power Circle',
    category: 'ac-power',
    categoryLabel: 'AC & Power',
    description: 'Operating capability chart for synchronous generators and transmission lines.',
    equation: 'P = (VsVr/X)sinδ,  Q = (VsVr/X)cosδ − Vr²/X',
  },
  {
    id: 'torque-speed',
    index: '08',
    name: 'Torque–Speed Curve',
    shortName: 'Torque–Speed',
    category: 'machines',
    categoryLabel: 'Machines',
    description: 'Plots 3-phase induction motor mechanical torque output from standstill to synchronous speed.',
    equation: 'T(s) = (3/ωs) · Vph²(R₂/s) / [(R₁ + R₂/s)² + (X₁ + X₂)²]',
  },
  {
    id: 'transformer-efficiency',
    index: '09',
    name: 'Transformer Efficiency Curve',
    shortName: 'Efficiency',
    category: 'machines',
    categoryLabel: 'Machines',
    description: 'Plots transformer efficiency (%) against percentage of full-load kVA.',
    equation: 'η(x) = (x·S·cosφ) / (x·S·cosφ + Pᵢ + x²·Pcu,FL)',
  },
  {
    id: 'step-response',
    index: '10',
    name: '2nd-Order Step Response',
    shortName: 'Step Response',
    category: 'time-domain',
    categoryLabel: 'Time Domain',
    description: 'Time-domain response curve and exponential envelope parameterized by ζ and ωn.',
    equation: 'G(s) = A·ωn² / (s² + 2ζωns + ωn²)',
  },
];

export interface TransferFunctionPreset {
  name: string;
  gain: number;
  poles: Complex[];
  zeros: Complex[];
  timeDelay: number;
}

export const TF_PRESETS: TransferFunctionPreset[] = [
  {
    name: 'Type-1 3rd Order Plant',
    gain: 8,
    poles: [
      { re: 0, im: 0 },
      { re: -2, im: 0 },
      { re: -5, im: 0 },
    ],
    zeros: [],
    timeDelay: 0,
  },
  {
    name: 'Underdamped Resonance + Lead',
    gain: 12,
    poles: [
      { re: -1, im: 3 },
      { re: -1, im: -3 },
      { re: -6, im: 0 },
    ],
    zeros: [{ re: -2.5, im: 0 }],
    timeDelay: 0,
  },
  {
    name: 'Delayed Process Plant',
    gain: 2.4,
    poles: [
      { re: -0.8, im: 0 },
      { re: -2.5, im: 0 },
    ],
    zeros: [],
    timeDelay: 0.25,
  },
];

export interface RouthPreset {
  name: string;
  coeffs: number[];
}

export const ROUTH_PRESETS: RouthPreset[] = [
  { name: 'Stable 4th-Order System', coeffs: [1, 6, 11, 6, 2] },
  { name: 'Marginally Stable (jω Roots)', coeffs: [1, 2, 5, 10, 0] },
  { name: 'Unstable (2 RHP Poles)', coeffs: [1, 1, -2, 4, 8] },
  { name: 'Zero-Pivot Edge Case', coeffs: [1, 2, 2, 4, 11, 10] },
];
