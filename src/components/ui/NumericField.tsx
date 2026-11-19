import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumericFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  slider?: boolean;
  sliderMin?: number;
  sliderMax?: number;
  helperText?: string;
}

export const NumericField: React.FC<NumericFieldProps> = ({
  id,
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 0.1,
  slider = false,
  sliderMin,
  sliderMax,
  helperText,
}) => {
  const handleStep = (delta: number) => {
    const raw = Number((value + delta).toPrecision(10));
    const clamped =
      min !== undefined && raw < min
        ? min
        : max !== undefined && raw > max
          ? max
          : raw;
    onChange(clamped);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        {unit && (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleStep(-step)}
          aria-label={`Decrease ${label}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-sky-400"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step="any"
          onChange={(e) => {
            const parsed = e.target.value === '' ? Number.NaN : Number(e.target.value);
            onChange(parsed);
          }}
          className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-400/20"
        />

        <button
          type="button"
          onClick={() => handleStep(step)}
          aria-label={`Increase ${label}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-sky-400"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {slider && (
        <input
          type="range"
          aria-label={`${label} slider`}
          min={sliderMin ?? min ?? 0}
          max={sliderMax ?? max ?? 100}
          step={step}
          value={Number.isFinite(value) ? value : sliderMin ?? min ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bench-slider w-full cursor-pointer bg-slate-200 dark:bg-slate-700"
        />
      )}

      {helperText && (
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      )}
    </div>
  );
};
