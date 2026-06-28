import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({
  api: { post: jest.fn(), get: jest.fn(), defaults: { headers: { common: {} as Record<string, string> } } },
}));

const mockedPost = api.post as jest.Mock;
const mockedGet = api.get as jest.Mock;

function Consumer() {
  const { user, login } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.displayName ?? 'none'}</span>
      <button onClick={() => login('e@x.com', 'pw')}>login</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('restores the session on mount via refresh + /me', async () => {
    mockedPost.mockResolvedValue({ data: { accessToken: 'abc' } });        // /auth/refresh
    mockedGet.mockResolvedValue({ data: { id: '1', email: 'e@x.com', displayName: 'Jane' } }); // /auth/me

    render(<AuthProvider><Consumer /></AuthProvider>);

    expect(await screen.findByText('Jane')).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith('/auth/refresh');
    expect(api.defaults.headers.common['Authorization']).toBe('Bearer abc');
  });

  it('logs in and exposes the user', async () => {
    // No existing session: refresh rejects on mount
    mockedPost.mockImplementation((url: string) => {
      if (url === '/auth/login') {
        return Promise.resolve({ data: { accessToken: 'tok', user: { id: '2', email: 'e@x.com', displayName: 'Bob' } } });
      }
      return Promise.reject(new Error('no session'));
    });

    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByTestId('user')).toHaveTextContent('none');

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith('/auth/login', { email: 'e@x.com', password: 'pw' });
  });
});
