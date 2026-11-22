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
  {
    id: 'pid-tuner',
    index: '11',
    name: 'CSV Step ID & PID Auto-Tuner',
    shortName: 'PID Auto-Tuner',
    category: 'control',
    categoryLabel: 'Control Loops',
    description:
      'Upload a process step-response CSV to fit an FOPDT model, compare PID tuning rules (Ziegler–Nichols, IMC, Cohen–Coon, SIMC, AMIGO), and simulate closed-loop behavior before applying.',
    equation: 'Gp(s) = Kp·e^(−θs) / (τs + 1),  C(s) = Kc(1 + 1/(Ti·s) + Td·s)',
  },
];

export interface ProcessCsvSample {
  name: string;
  stepAmplitude: number;
  csvText: string;
}

export const SAMPLE_PROCESS_CSVS: ProcessCsvSample[] = [
  {
    name: 'Thermal Chamber (FOPDT)',
    stepAmplitude: 1.0,
    csvText: [
      'time_s,temp_c',
      '0.0,25.00',
      '0.5,25.02',
      '1.0,24.99',
      '1.5,25.01',
      '2.0,25.04',
      '2.5,25.55',
      '3.0,26.62',
      '3.5,27.58',
      '4.0,28.44',
      '4.5,29.21',
      '5.0,29.88',
      '5.5,30.48',
      '6.0,31.01',
      '6.5,31.48',
      '7.0,31.90',
      '7.5,32.27',
      '8.0,32.60',
      '8.5,32.89',
      '9.0,33.15',
      '9.5,33.38',
      '10.0,33.58',
      '11.0,33.91',
      '12.0,34.17',
      '13.0,34.37',
      '14.0,34.52',
      '15.0,34.64',
      '16.0,34.73',
      '18.0,34.85',
      '20.0,34.92',
    ].join('\n'),
  },
  {
    name: 'Flow Valve Loop (Fast + Noise)',
    stepAmplitude: 2.0,
    csvText: [
      't,flow_lpm,u_cmd',
      '0.0,10.00,0.0',
      '0.2,10.05,2.0',
      '0.4,10.01,2.0',
      '0.6,10.38,2.0',
      '0.8,10.92,2.0',
      '1.0,11.41,2.0',
      '1.2,11.82,2.0',
      '1.4,12.14,2.0',
      '1.6,12.42,2.0',
      '1.8,12.68,2.0',
      '2.0,12.86,2.0',
      '2.2,13.01,2.0',
      '2.5,13.19,2.0',
      '3.0,13.38,2.0',
      '3.5,13.48,2.0',
      '4.0,13.53,2.0',
      '4.5,13.57,2.0',
      '5.0,13.59,2.0',
    ].join('\n'),
  },
  {
    name: 'Heat Exchanger (Long Delay)',
    stepAmplitude: 1.0,
    csvText: [
      'time,outlet_degC',
      '0,40.0',
      '1,40.0',
      '2,40.0',
      '3,40.0',
      '4,40.0',
      '5,40.1',
      '6,40.9',
      '7,42.3',
      '8,43.6',
      '9,44.7',
      '10,45.6',
      '11,46.4',
      '12,47.0',
      '13,47.5',
      '14,47.9',
      '15,48.3',
      '16,48.6',
      '18,49.0',
      '20,49.3',
      '22,49.5',
      '24,49.7',
      '26,49.8',
    ].join('\n'),
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
