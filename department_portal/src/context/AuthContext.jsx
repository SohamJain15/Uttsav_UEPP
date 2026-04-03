import { createContext, useContext, useMemo, useState } from 'react';
import { authenticateCredentials } from '../utils/auth';

const AUTH_KEY = 'uttsav_department_auth';

const AuthContext = createContext(null);

const getStoredUser = () => {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);

  const login = (username, password) => {
    const result = authenticateCredentials(username, password);

    if (!result.isValid) {
      return result;
    }

    setUser(result.user);
    localStorage.setItem(AUTH_KEY, JSON.stringify(result.user));
    return result;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout
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
