import api from './api';

const ROLE_LABELS = {
  Police: 'Police Department',
  Fire: 'Fire Department',
  Traffic: 'Traffic Department',
  Municipality: 'Municipality Department',
  Admin: 'Admin Control Room',
};

const normalizeRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'admin' || normalized === 'superadmin') return 'Admin';
  if (normalized.includes('police')) return 'Police';
  if (normalized.includes('fire')) return 'Fire';
  if (normalized.includes('traffic')) return 'Traffic';
  if (normalized.includes('municip')) return 'Municipality';
  return null;
};

const extractRole = ({ profile, user }) =>
  normalizeRole(profile?.department) ||
  normalizeRole(user?.user_metadata?.department) ||
  normalizeRole(user?.department);

export const authService = {
  async login({ username, password }) {
    const normalizedUsername = String(username || '').trim().toUpperCase();
    const usernameWithoutDash = normalizedUsername.replace('-', '');
    const startsWithValidPrefix =
      usernameWithoutDash.startsWith('P') ||
      usernameWithoutDash.startsWith('T') ||
      usernameWithoutDash.startsWith('FB') ||
      usernameWithoutDash.startsWith('M');

    if (!startsWithValidPrefix) {
      throw new Error('Department username must start with P, T, FB, or M.');
    }

    const loginResponse = await api.post('/api/auth/login', {
      email: normalizedUsername,
      password,
    });
    const accessToken =
      loginResponse?.access_token ||
      loginResponse?.token ||
      loginResponse?.session?.access_token ||
      '';

    if (!accessToken) {
      throw new Error('Login failed: access token was not returned.');
    }

    const profileResponse = await api.get('/api/user/profile');
    const profile = profileResponse?.profile || loginResponse?.profile || {};
    const user = profileResponse?.user || loginResponse?.user || {};
    const role = extractRole({ profile, user });

    if (!role) {
      throw new Error(
        'Your account does not have a valid department role. Set department to Police, Fire, Traffic, Municipality, or Admin.'
      );
    }

    return {
      access_token: accessToken,
      token_type: loginResponse?.token_type || 'bearer',
      user: {
        id: user?.id || profile?.id || '',
        email: user?.email || profile?.email || '',
        username: profile?.username || profile?.prefix || normalizedUsername,
        fullName: profile?.full_name || user?.full_name || '',
        department: profile?.department || user?.user_metadata?.department || role,
        role,
        departmentLabel: ROLE_LABELS[role] || role,
      },
    };
  },
};
