import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  it('associates label with input using accessible id', () => {
    render(<Input label="Roll Number" id="roll-field" />);
    const label = screen.getByText(/roll number/i);
    const input = screen.getByLabelText(/roll number/i);

    expect(label).toHaveAttribute('for', 'roll-field');
    expect(input).toHaveAttribute('id', 'roll-field');
  });

  it('renders helper text and associates it via aria-describedby', () => {
    render(
      <Input
        label="Course Code"
        id="course-input"
        helperText="Enter your 5-character course code."
      />
    );
    const input = screen.getByLabelText(/course code/i);
    const helper = screen.getByText(/enter your 5-character course code/i);

    expect(helper).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', 'course-input-helper');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('renders error message, sets aria-invalid to true and alerts user', () => {
    render(
      <Input
        label="Roll Number"
        id="roll-err"
        errorMessage="Must be exactly 6 digits."
      />
    );
    const input = screen.getByLabelText(/roll number/i);
    const errorAlert = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'roll-err-error');
    expect(errorAlert).toHaveTextContent(/must be exactly 6 digits/i);
  });

  it('handles user text input events', () => {
    const handleChange = vi.fn();
    render(<Input label="Course Name" onChange={handleChange} />);
    const input = screen.getByLabelText(/course name/i);

    fireEvent.change(input, { target: { value: 'CS455' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect((input as HTMLInputElement).value).toBe('CS455');
  });
});
