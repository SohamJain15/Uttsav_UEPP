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

const normalizeDepartmentUsername = (value = '') => String(value || '').trim().toUpperCase();

export const authService = {
  async login({ username, password }) {
    const loginIdentifier = normalizeDepartmentUsername(username);

    if (!/^(P|F|FB|T|M|A)-[A-Z0-9]+$/.test(loginIdentifier)) {
      throw new Error('Please sign in with a valid department username like P-1001 or F-1001.');
    }

    const loginResponse = await api.post('/api/auth/login', {
      email: loginIdentifier,
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

    // FIX 2: Actively store the token in localStorage BEFORE making the profile request
    // This allows api.js to successfully read the token and attach the Bearer header
    const initialAuthData = {
      access_token: accessToken,
      token_type: loginResponse?.token_type || 'bearer',
      user: loginResponse?.user || {},
      profile: loginResponse?.profile || {}
    };
    localStorage.setItem('uttsav_department_auth', JSON.stringify(initialAuthData));

    // Now this request will succeed because the token is stored
    const profileResponse = await api.get('/api/user/profile');
    const profile = profileResponse?.profile || loginResponse?.profile || {};
    const user = profileResponse?.user || loginResponse?.user || {};
    const role = extractRole({ profile, user });

    if (!role) {
      // Clean up storage if the user doesn't have valid department permissions
      localStorage.removeItem('uttsav_department_auth');
      throw new Error(
        'Your account does not have a valid department role. Set department to Police, Fire, Traffic, Municipality, or Admin.'
      );
    }

    const finalAuthData = {
      access_token: accessToken,
      token_type: loginResponse?.token_type || 'bearer',
      user: {
        id: user?.id || profile?.id || '',
        email: user?.email || profile?.email || '',
        username: profile?.username || loginIdentifier,
        fullName:
          profile?.full_name ||
          user?.user_metadata?.full_name ||
          user?.full_name ||
          profile?.username ||
          loginIdentifier,
        department: profile?.department || user?.user_metadata?.department || role,
        role,
        departmentLabel: ROLE_LABELS[role] || role,
      },
    };

    // FIX 3: Update storage with the fully resolved profile and role
    localStorage.setItem('uttsav_department_auth', JSON.stringify(finalAuthData));

    return finalAuthData;
  },
  
  logout() {
    localStorage.removeItem('uttsav_department_auth');
  }
};
