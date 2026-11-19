import React, { useEffect, useMemo, useState } from 'react';
import { Moon, RotateCcw, Sun } from 'lucide-react';
import { AcPowerBench } from './components/instruments/AcPowerBench';
import { FrequencyControlBench } from './components/instruments/FrequencyControlBench';
import { MachinesTimeBench } from './components/instruments/MachinesTimeBench';
import { SPlaneControlBench } from './components/instruments/SPlaneControlBench';
import { INSTRUMENTS } from './data/instruments';
import type { InstrumentCategory, InstrumentId } from './types/bench';

const CATEGORIES: Array<{ id: InstrumentCategory; label: string; defaultInstrument: InstrumentId }> = [
  { id: 'control', label: 'Control Loops', defaultInstrument: 'nyquist' },
  { id: 'ac-power', label: 'AC & Power', defaultInstrument: 'phasor' },
  { id: 'machines', label: 'Machines', defaultInstrument: 'torque-speed' },
  { id: 'time-domain', label: 'Time Domain', defaultInstrument: 'step-response' },
];

export default function App() {
  const [activeId, setActiveId] = useState<InstrumentId>('bode');
  const [resetNonce, setResetNonce] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  const activeInstrument = useMemo(
    () => INSTRUMENTS.find((i) => i.id === activeId) ?? INSTRUMENTS[0],
    [activeId]
  );

  const handleCategoryJump = (cat: InstrumentCategory, fallbackId: InstrumentId) => {
    if (activeInstrument.category === cat) return;
    setActiveId(fallbackId);
  };

  const renderInstrument = () => {
    const key = `${activeId}-${resetNonce}`;
    switch (activeId) {
      case 'nyquist':
      case 'bode':
      case 'nichols':
        return <FrequencyControlBench key={key} mode={activeId} />;
      case 'root-locus':
      case 'routh-hurwitz':
        return <SPlaneControlBench key={key} mode={activeId} />;
      case 'phasor':
      case 'power-circle':
        return <AcPowerBench key={key} mode={activeId} />;
      case 'torque-speed':
      case 'transformer-efficiency':
      case 'step-response':
        return <MachinesTimeBench key={key} mode={activeId} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100">
      {/* Three-Zone Top Bar */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F1522]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveId('bode');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-white"
          >
            VectorBench
          </a>

          {/* Zone 2: Category Navigation Links */}
          <nav
            aria-label="Engineering domains"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {CATEGORIES.map((cat) => {
              const isCurrent = activeInstrument.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryJump(cat.id, cat.defaultInstrument)}
                  className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? 'border-blue-600 text-slate-900 dark:border-sky-400 dark:text-white'
                      : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setResetNonce((n) => n + 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Inputs
            </button>
          </div>
        </div>
      </header>

      {/* Main Workbench Container */}
      <main id="top" className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6">
        {/* Workspace Instrument Ribbon */}
        <section
          aria-label="Instrument selector"
          className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Electrical &amp; Control Engineering</span>
              <span aria-hidden="true">·</span>
              <span>10 Calibrated Instruments</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Hover or drag plots for fine-print coordinates</span>
            </div>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? 'Switch to daylight lab theme' : 'Switch to dark oscilloscope theme'}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {isDark ? 'Daylight Lab' : 'Oscilloscope Dark'}
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Engineering instruments"
            className="flex gap-1.5 overflow-x-auto pb-1"
          >
            {INSTRUMENTS.map((inst) => {
              const selected = inst.id === activeId;
              return (
                <button
                  key={inst.id}
                  role="tab"
                  aria-selected={selected}
                  type="button"
                  onClick={() => setActiveId(inst.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0F1522] dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`font-mono text-[11px] ${
                      selected
                        ? 'text-blue-100 dark:text-slate-900'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {inst.index}
                  </span>
                  <span>{inst.shortName}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Active Instrument Header */}
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono">{activeInstrument.index}</span>
              <span aria-hidden="true">/</span>
              <span>{activeInstrument.categoryLabel}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance dark:text-white">
              {activeInstrument.name}
            </h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {activeInstrument.description}
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-[#0F1522] dark:text-slate-300">
            {activeInstrument.equation}
          </div>
        </section>

        {/* Active Instrument Bench */}
        <section aria-label={activeInstrument.name}>{renderInstrument()}</section>
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white py-5 dark:border-slate-800 dark:bg-[#0F1522]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:px-6 dark:text-slate-400">
          <span>VectorBench · Electrical &amp; Control Engineering Workbench</span>
          <span>Deterministic client-side numerical solvers · CSV export ready</span>
        </div>
      </footer>
    </div>
  );
}
