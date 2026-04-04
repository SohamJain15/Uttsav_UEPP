import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';

const AUTH_KEY = 'uttsav_department_auth';
const AuthContext = createContext(null);

const normalizeAuthState = (payload = null) => {
  if (!payload) return null;

  const user = payload?.user || {};
  const displayName =
    user?.fullName ||
    user?.name ||
    user?.username ||
    user?.email?.split('@')?.[0] ||
    'Department User';

  return {
    access_token: payload?.access_token || payload?.token || '',
    token_type: payload?.token_type || 'bearer',
    user: {
      id: user?.id || '',
      email: user?.email || '',
      username: user?.username || user?.email || '',
      fullName: displayName,
      role: user?.role || user?.department || 'Department',
      department: user?.department || user?.role || 'Department',
      departmentLabel: user?.departmentLabel || user?.department || user?.role || 'Department',
    },
  };
};

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? normalizeAuthState(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(getStoredAuth);
  const token = authState?.access_token || '';
  const user = authState?.user || null;

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== AUTH_KEY) return;

      try {
        setAuthState(event.newValue ? normalizeAuthState(JSON.parse(event.newValue)) : null);
      } catch (error) {
        setAuthState(null);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = async (username, password) => {
    try {
      const result = normalizeAuthState(await authService.login({ username, password }));
      setAuthState(result);
      localStorage.setItem(AUTH_KEY, JSON.stringify(result));
      return { isValid: true, user: result.user };
    } catch (error) {
      return {
        isValid: false,
        message: error?.message || 'Login failed. Please verify your credentials.',
      };
    }
  };

  const logout = () => {
    authService.logout();
    setAuthState(null);
    localStorage.removeItem(AUTH_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user?.id),
      login,
      logout,
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
};
