import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../../services/authService';
import SignUpPage from './SignUpPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'User' } });
  fireEvent.change(screen.getByLabelText('Employee / staff ID'), { target: { value: 'EMP-01' } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'test@example.test' } });
  fireEvent.change(screen.getByLabelText('Subscribed hatchery'), { target: { value: 'camiguin-sagay' } });
  fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'PH' } });
  fireEvent.change(screen.getByLabelText('Province / region'), { target: { value: '1001800000' } });
  fireEvent.change(screen.getByLabelText('City / municipality / district'), { target: { value: '1001805000' } });
  fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: '1001805001' } });
  fireEvent.change(screen.getByLabelText('Street address'), { target: { value: 'Test address' } });
  fireEvent.change(screen.getByLabelText('Emergency contact name'), { target: { value: 'Test contact' } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'TestPass123' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'TestPass123' } });
  fireEvent.click(screen.getByLabelText('I have read and agree to the Terms and Conditions'));
}

describe('signup phone fields', () => {
  it('clears dependent address selections and does not ask for a role or position', () => {
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    expect(screen.queryByLabelText('Requested role')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'PH' } });
    fireEvent.change(screen.getByLabelText('Province / region'), { target: { value: '1001800000' } });
    fireEvent.change(screen.getByLabelText('City / municipality / district'), { target: { value: '1001805000' } });
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: '1001805001' } });
    fireEvent.change(screen.getByLabelText('Province / region'), { target: { value: '1300000000' } });
    expect(screen.getByLabelText('City / municipality / district')).toHaveValue('');
    expect(screen.getByLabelText('Barangay')).toHaveValue('');
    expect(screen.getByLabelText('Barangay')).toBeDisabled();
  });
  it('submits independently selected country codes as international numbers', async () => {
    const signUp = vi.spyOn(authService, 'signUp').mockResolvedValue({ status: 'pending', redirectPath: '/pending-approval' });
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Contact number country code'), { target: { value: 'GB' } });
    expect(screen.getByLabelText('Contact number country code').parentElement).toHaveTextContent('+44');
    expect(screen.getByLabelText('Contact number country code').parentElement?.querySelector('img')).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
    fireEvent.change(screen.getByLabelText('Contact number', { exact: true }), { target: { value: '020 7946 0018' } });
    fireEvent.change(screen.getByLabelText('Emergency contact number country code'), { target: { value: 'US' } });
    fireEvent.change(screen.getByLabelText('Emergency contact number', { exact: true }), { target: { value: '202 555 0123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      phone: '+442079460018', emergencyContactPhone: '+12025550123',
    })));
  });

  it('prevents submission of invalid national numbers', async () => {
    const signUp = vi.spyOn(authService, 'signUp');
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Contact number', { exact: true }), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Emergency contact number', { exact: true }), { target: { value: '0917 555 0100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(await screen.findByText('Enter a valid national contact number for the selected country.')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
});
