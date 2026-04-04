import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";

const AUTH_STORAGE_KEY = "uttsav_auth";
const AuthContext = createContext(null);

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const resolveDisplayName = (user = {}, profile = {}) =>
  profile?.name ||
  profile?.full_name ||
  user?.name ||
  user?.full_name ||
  user?.email?.split("@")?.[0] ||
  "User";

const normalizeAuthState = (payload = {}) => {
  const user = payload?.user || {};
  const profile = payload?.profile || {};

  return {
    access_token: payload?.access_token || payload?.token || "",
    token_type: payload?.token_type || "bearer",
    user: {
      id: user?.id || profile?.id || "",
      email: user?.email || profile?.email || "",
      name: resolveDisplayName(user, profile),
      full_name: resolveDisplayName(user, profile),
      role: profile?.role || user?.role || profile?.department || user?.department || "Organizer",
      organization: profile?.organization || user?.organization || "",
      department: profile?.department || user?.department || "Organizer",
      phone: profile?.phone || profile?.phone_number || user?.phone || user?.phone_number || "",
      phone_number: profile?.phone_number || profile?.phone || user?.phone_number || user?.phone || "",
    },
    profile: profile || null,
  };
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => {
    const stored = readStoredAuth();
    return stored ? normalizeAuthState(stored) : null;
  });

  const user = authState?.user || null;
  const token = authState?.access_token || "";

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== AUTH_STORAGE_KEY) return;
      const nextAuth = event.newValue ? normalizeAuthState(JSON.parse(event.newValue)) : null;
      setAuthState(nextAuth);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = async (payload) => {
    const result = normalizeAuthState(await authService.login(payload));
    setAuthState(result);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result));
    return result;
  };

  const refreshProfile = async () => {
    const profile = await authService.getProfile();
    setAuthState((previous) => {
      const nextAuth = normalizeAuthState({
        ...(previous || {}),
        profile: profile || previous?.profile || {},
        user: {
          ...(previous?.user || {}),
          ...(profile || {}),
        },
      });
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      return nextAuth;
    });
    return profile;
  };

  const logout = () => {
    authService.logout();
    setAuthState(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user?.id),
      login,
      logout,
      refreshProfile,
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
};
