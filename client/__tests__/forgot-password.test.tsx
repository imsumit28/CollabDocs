import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from '../app/forgot-password/page';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));

const mockedPost = api.post as jest.Mock;

async function submitEmail(email = 'me@example.com') {
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), email);
  await userEvent.click(screen.getByRole('button', { name: /send otp/i }));
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests an OTP and advances to the code-entry step', async () => {
    mockedPost.mockResolvedValue({ data: { message: 'sent' } });
    render(<ForgotPasswordPage />);

    await submitEmail();

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'me@example.com' })
    );
    expect(await screen.findByRole('heading', { name: /enter the code/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /verification code/i })).toBeInTheDocument();
  });

  it('shows the Google-account screen when the API reports an OAuth account', async () => {
    mockedPost.mockResolvedValue({ data: { code: 'OAUTH_ACCOUNT' } });
    render(<ForgotPasswordPage />);

    await submitEmail('google@example.com');

    expect(await screen.findByRole('heading', { name: /use google to sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/created using google sign-in/i)).toBeInTheDocument();
  });

  it('surfaces a server error message', async () => {
    mockedPost.mockRejectedValue({ response: { data: { error: 'Something broke' } } });
    render(<ForgotPasswordPage />);

    await submitEmail();

    expect(await screen.findByText('Something broke')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /enter the code/i })).not.toBeInTheDocument();
  });

  it('verifies the OTP and advances to the reset-password step', async () => {
    mockedPost
      .mockResolvedValueOnce({ data: { message: 'sent' } }) // forgot-password
      .mockResolvedValueOnce({ data: { resetToken: 'ticket-123' } }); // verify-otp
    render(<ForgotPasswordPage />);

    await submitEmail();
    await screen.findByRole('heading', { name: /enter the code/i });

    const boxes = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) {
      await userEvent.type(boxes[i], String(i + 1));
    }
    await userEvent.click(screen.getByRole('button', { name: /verify otp/i }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/auth/verify-otp', { email: 'me@example.com', otp: '123456' })
    );
    expect(await screen.findByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
  });
});
