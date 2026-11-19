import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('VectorBench Engineering Workbench Integration', () => {
  it('renders all 10 instruments and switches cleanly between them (Blue Pill)', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('VectorBench')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(10);

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
});
