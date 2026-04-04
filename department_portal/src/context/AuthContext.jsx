import { createContext, useContext, useMemo, useState } from 'react';
import { authService } from '../services/authService';

const AUTH_KEY = 'uttsav_department_auth';

const AuthContext = createContext(null);

const getStoredAuth = () => {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(getStoredAuth);
  const user = authState?.user || null;

  const login = async (username, password) => {
    try {
      const result = await authService.login({ username, password });
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
    setAuthState(null);
    localStorage.removeItem(AUTH_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user]
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
