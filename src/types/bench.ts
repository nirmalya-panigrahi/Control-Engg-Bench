export type InstrumentId =
  | 'nyquist'
  | 'bode'
  | 'root-locus'
  | 'nichols'
  | 'phasor'
  | 'power-circle'
  | 'routh-hurwitz'
  | 'torque-speed'
  | 'transformer-efficiency'
  | 'step-response';

export type InstrumentCategory = 'control' | 'ac-power' | 'machines' | 'time-domain';

export interface Complex {
  re: number;
  im: number;
}

export interface InstrumentDefinition {
  id: InstrumentId;
  index: string;
  name: string;
  shortName: string;
  category: InstrumentCategory;
  categoryLabel: string;
  description: string;
  equation: string;
}

export interface MetricReadout {
  label: string;
  value: string;
  unit?: string;
  sublabel?: string;
  status?: 'nominal' | 'warning' | 'critical';
  statusText?: string;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
