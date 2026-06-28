import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from '../app/forgot-password/page';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({ api: { post: jest.fn() } }));

const mockedPost = api.post as jest.Mock;

describe('ForgotPasswordPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits the email and shows the confirmation screen', async () => {
    mockedPost.mockResolvedValue({ data: {} });
    render(<ForgotPasswordPage />);

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'me@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'me@example.com' })
    );
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('surfaces a server error message', async () => {
    mockedPost.mockRejectedValue({ response: { data: { error: 'Something broke' } } });
    render(<ForgotPasswordPage />);

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'me@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText('Something broke')).toBeInTheDocument();
    // Should NOT advance to the confirmation screen
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});
