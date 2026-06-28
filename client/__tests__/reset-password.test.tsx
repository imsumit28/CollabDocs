import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '../app/reset-password/page';
import { api } from '../lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: jest.fn() }) }));
jest.mock('../lib/api', () => ({ api: { post: jest.fn() } }));

const mockedPost = api.post as jest.Mock;

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/reset-password');
  });

  it('shows an invalid-link message when no token is present', async () => {
    render(<ResetPasswordPage />);
    expect(await screen.findByText(/invalid link/i)).toBeInTheDocument();
  });

  it('rejects mismatched passwords without calling the API', async () => {
    window.history.pushState({}, '', '/reset-password?token=abc123');
    render(<ResetPasswordPage />);

    const pwFields = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(pwFields[0], 'NewPassword123');
    await userEvent.type(pwFields[1], 'Different123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('submits the new password with the token from the URL', async () => {
    window.history.pushState({}, '', '/reset-password?token=abc123');
    mockedPost.mockResolvedValue({ data: { accessToken: 't' } });
    render(<ResetPasswordPage />);

    const pwFields = screen.getAllByPlaceholderText('••••••••');
    await userEvent.type(pwFields[0], 'NewPassword123');
    await userEvent.type(pwFields[1], 'NewPassword123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/auth/reset-password', { token: 'abc123', password: 'NewPassword123' })
    );
    expect(await screen.findByText(/password reset/i)).toBeInTheDocument();
  });
});
