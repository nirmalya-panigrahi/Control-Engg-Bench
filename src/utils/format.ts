export function formatNumber(val: number | null | undefined, digits = 3): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  if (Math.abs(val) >= 1e5 || (Math.abs(val) > 0 && Math.abs(val) < 1e-3)) {
    return val.toExponential(2);
  }
  const clean = Math.abs(val) < 1e-9 ? 0 : val;
  return clean.toFixed(digits);
}

export function formatSigned(val: number | null | undefined, digits = 3): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const clean = Math.abs(val) < 1e-9 ? 0 : val;
  const prefix = clean > 0 ? '+' : '';
  return `${prefix}${formatNumber(clean, digits)}`;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escape = (cell: string | number) => {
    const str = String(cell);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
