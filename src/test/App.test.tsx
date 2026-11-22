import { render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('VectorBench Engineering Workbench Integration', () => {
  it('renders all 10 instruments and switches cleanly between them (Blue Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('VectorBench')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(11);

    // Switch to Step Response
    await user.click(screen.getByRole('tab', { name: /Step Response/i }));
    expect(screen.getByRole('heading', { level: 1, name: /2nd-Order Step Response/i })).toBeInTheDocument();
    expect(screen.getByText(/Percent Overshoot/i)).toBeInTheDocument();

    // Switch to Phasor Diagram via tab
    await user.click(screen.getByRole('tab', { name: /Phasor/i }));
    expect(screen.getByRole('heading', { level: 1, name: /Phasor Diagram/i })).toBeInTheDocument();
    expect(screen.getByText(/Impedance \|Z\|/i)).toBeInTheDocument();

    // Switch to Routh-Hurwitz
    await user.click(screen.getByRole('tab', { name: /Routh–Hurwitz/i }));
    expect(screen.getByRole('heading', { level: 1, name: /Routh–Hurwitz s-Plane Map/i })).toBeInTheDocument();
    expect(screen.getByText(/Routh Stability Array/i)).toBeInTheDocument();
  });

  it('recomputes outputs dynamically when engineer updates numeric inputs (Blue Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /Step Response/i }));
    const zetaInput = screen.getByLabelText('Damping Ratio (ζ)') as HTMLInputElement;

    // Set zeta = 1 -> Critically Damped, 0.00% overshoot
    fireEvent.change(zetaInput, { target: { value: '1' } });
    expect(screen.getByText('Critically Damped')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();

    // Set zeta = 0.2 -> Underdamped
    fireEvent.change(zetaInput, { target: { value: '0.2' } });
    expect(screen.getByText('Underdamped')).toBeInTheDocument();
  });

  it('renders fine-print tooltip when hovering over the interactive SVG graph (Blue Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /Efficiency/i }));
    const svg = screen.getByRole('img', { name: /Transformer Efficiency/i });

    // Mock bounding box so pointer coordinates map inside the plot area
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 820, height: 420, right: 820, bottom: 420 }),
    });

    fireEvent.pointerMove(svg, { clientX: 400, clientY: 200 });
    const tooltip = screen.getByTestId('chart-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toMatch(/Efficiency|Load/i);
  });

  it('shows explicit error banner on invalid adversarial inputs without crashing (Red Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default active is Bode Plot: set Gain K to -10
    const gainInput = screen.getByLabelText('System Gain (K)');
    fireEvent.change(gainInput, { target: { value: '-10' } });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/positive/i);

    // Reset Inputs button restores valid state
    await user.click(screen.getByRole('button', { name: /Reset Inputs/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('toggles dark oscilloscope mode cleanly', async () => {
    const user = userEvent.setup();
    render(<App />);

    const themeBtn = screen.getByRole('button', { name: /Switch to dark oscilloscope theme/i });
    await user.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(screen.getByRole('button', { name: /Switch to daylight lab theme/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('fits FOPDT model from uploaded CSV, switches PID rules, simulates, and applies settings (Blue Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /PID Auto-Tuner/i }));
    expect(
      screen.getByRole('heading', { level: 1, name: /CSV Step ID & PID Auto-Tuner/i })
    ).toBeInTheDocument();

    // Upload a synthetic FOPDT step response CSV: y(t) = 5*(1 - exp(-(t-1)/3)) for t>=1
    const rows = ['time_s,output'];
    for (let t = 0; t <= 18; t += 1) {
      const y = t <= 1 ? 0 : 5 * (1 - Math.exp(-(t - 1) / 3));
      rows.push(`${t},${y.toFixed(4)}`);
    }
    const csvFile = new File([rows.join('\n')], 'plant_step.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText('Upload step response CSV') as HTMLInputElement;
    // Ensure File.text() works reliably in jsdom
    Object.defineProperty(csvFile, 'text', {
      value: async () => rows.join('\n'),
    });
    await user.upload(fileInput, csvFile);

    expect(screen.getByText(/Active: plant_step\.csv/i)).toBeInTheDocument();
    expect(screen.getByText(/Process Gain \(Kp\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Closed-Loop PID Simulation/i)).toBeInTheDocument();

    // Switch to Ziegler-Nichols rule
    await user.click(screen.getByRole('button', { name: /Ziegler–Nichols/i }));
    await user.click(screen.getByRole('button', { name: /Apply PID Settings/i }));

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status.textContent).toMatch(/Applied Ziegler–Nichols/i);
  });

  it('displays explicit error banner when uploaded CSV is malformed or flat (Red Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /PID Auto-Tuner/i }));

    // Open raw CSV editor and enter invalid flat data
    await user.click(screen.getByRole('button', { name: /Paste \/ Edit CSV/i }));
    const textarea = screen.getByLabelText('Raw CSV data');
    fireEvent.change(textarea, {
      target: { value: 't,y\n0,10\n1,10\n2,10\n3,10\n4,10\n5,10' },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/negligible steady-state change/i);
  });
});
