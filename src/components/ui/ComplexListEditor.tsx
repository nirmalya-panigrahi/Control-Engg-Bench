import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Complex } from '../../types/bench';

interface ComplexListEditorProps {
  title: string;
  items: Complex[];
  onChange: (next: Complex[]) => void;
  minItems?: number;
  symbolPrefix: 'p' | 'z';
}

export const ComplexListEditor: React.FC<ComplexListEditorProps> = ({
  title,
  items,
  onChange,
  minItems = 0,
  symbolPrefix,
}) => {
  const updateItem = (idx: number, field: 're' | 'im', val: number) => {
    const next = items.map((item, i) => (i === idx ? { ...item, [field]: val } : item));
    onChange(next);
  };

  const removeItem = (idx: number) => {
    if (items.length <= minItems) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  const addReal = () => {
    onChange([...items, { re: -1, im: 0 }]);
  };

  const addConjugatePair = () => {
    onChange([...items, { re: -1, im: 2 }, { re: -1, im: -2 }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {title} ({items.length})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={addReal}
            className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-3 w-3" />
            Real
          </button>
          <button
            type="button"
            onClick={addConjugatePair}
            className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-3 w-3" />
            Pair
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No finite {title.toLowerCase()} (constant numerator/denominator).
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((pt, idx) => (
            <div
              key={`${symbolPrefix}-${idx}`}
              className="grid grid-cols-[32px_1fr_1fr_36px] items-center gap-1.5"
            >
              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {symbolPrefix}
                {idx + 1}
              </span>
              <input
                type="number"
                step="any"
                aria-label={`${title} ${idx + 1} real`}
                value={Number.isFinite(pt.re) ? pt.re : ''}
                onChange={(e) =>
                  updateItem(idx, 're', e.target.value === '' ? Number.NaN : Number(e.target.value))
                }
                placeholder="Re"
                className="h-9 w-full min-w-0 rounded border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400"
              />
              <input
                type="number"
                step="any"
                aria-label={`${title} ${idx + 1} imaginary`}
                value={Number.isFinite(pt.im) ? pt.im : ''}
                onChange={(e) =>
                  updateItem(idx, 'im', e.target.value === '' ? Number.NaN : Number(e.target.value))
                }
                placeholder="Im"
                className="h-9 w-full min-w-0 rounded border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400"
              />
              <button
                type="button"
                disabled={items.length <= minItems}
                onClick={() => removeItem(idx)}
                aria-label={`Remove ${title} ${idx + 1}`}
                className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
