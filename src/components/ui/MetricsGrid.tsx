import React from 'react';
import type { MetricReadout } from '../../types/bench';

interface MetricsGridProps {
  metrics: MetricReadout[];
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
      {metrics.map((m) => {
        const statusColor =
          m.status === 'nominal'
            ? 'text-emerald-700 dark:text-emerald-400'
            : m.status === 'warning'
              ? 'text-amber-700 dark:text-amber-400'
              : m.status === 'critical'
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400';

        const statusGlyph =
          m.status === 'nominal'
            ? '●'
            : m.status === 'warning'
              ? '▲'
              : m.status === 'critical'
                ? '✖'
                : null;

        return (
          <div
            key={m.label}
            className="flex flex-col justify-between bg-white px-4 py-3 dark:bg-[#0F1522]"
          >
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {m.label}
            </span>

            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
                {m.value}
              </span>
              {m.unit && (
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {m.unit}
                </span>
              )}
            </div>

            {(m.statusText || m.sublabel) && (
              <div className={`mt-1 flex items-center gap-1.5 font-mono text-[11px] ${statusColor}`}>
                {statusGlyph && <span aria-hidden="true">{statusGlyph}</span>}
                <span className="truncate">{m.statusText ?? m.sublabel}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
