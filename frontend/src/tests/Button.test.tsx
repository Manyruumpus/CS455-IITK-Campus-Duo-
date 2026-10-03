import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders button with label and responds to click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Book Study Table</Button>);

    const button = screen.getByRole('button', { name: /book study table/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger click event when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled Action
      </Button>
    );

    const button = screen.getByRole('button', { name: /disabled action/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders loading spinner and sets aria-busy when isLoading is true', () => {
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Saving Reservation
      </Button>
    );

    const button = screen.getByRole('button', { name: /saving reservation/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders ember variant with proper token styles', () => {
    render(<Button variant="ember">Ember CTA</Button>);
    const button = screen.getByRole('button', { name: /ember cta/i });
    expect(button.className).toContain('bg-ember-600');
  });
});
