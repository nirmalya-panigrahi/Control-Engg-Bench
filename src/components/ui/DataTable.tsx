import React from 'react';

interface DataTableProps {
  caption: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export const DataTable: React.FC<DataTableProps> = ({ caption, headers, rows }) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        No computed samples available.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F1522]">
      <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {caption}
        </h4>
      </div>

      {/* Mobile card stack */}
      <div className="divide-y divide-slate-200 sm:hidden dark:divide-slate-800">
        {rows.map((row, idx) => (
          <div key={idx} className="space-y-1 px-4 py-2.5 font-mono text-xs tabular-nums">
            {headers.map((h, cIdx) => (
              <div key={h} className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{h}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{row[cIdx]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop tabular view */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left font-mono text-xs tabular-nums">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-4 py-2 text-slate-800 whitespace-nowrap dark:text-slate-200"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
