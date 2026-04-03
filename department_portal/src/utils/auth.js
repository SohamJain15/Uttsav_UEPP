const PREFIX_ROLE_MAP = {
  'P-': 'Police',
  'FB-': 'Fire',
  'T-': 'Traffic',
  'M-': 'Municipality',
  'A-': 'Admin'
};

const ROLE_LABELS = {
  Police: 'Police Department',
  Fire: 'Fire Department',
  Traffic: 'Traffic Department',
  Municipality: 'Municipality Department',
  Admin: 'Admin Control Room'
};

export const getRoleFromUsername = (username = '') => {
  const cleaned = username.trim().toUpperCase();
  const prefix = Object.keys(PREFIX_ROLE_MAP).find((key) => cleaned.startsWith(key));
  return prefix ? PREFIX_ROLE_MAP[prefix] : null;
};

export const getDepartmentLabel = (role) => ROLE_LABELS[role] ?? 'Unknown Department';

export const authenticateCredentials = (username, password) => {
  const role = getRoleFromUsername(username);

  if (!role) {
    return {
      isValid: false,
      message: 'Invalid username prefix. Use P-, FB-, T-, M- or A-.'
    };
  }

  if (!password || password.trim().length < 3) {
    return {
      isValid: false,
      message: 'Password must be at least 3 characters.'
    };
  }

  return {
    isValid: true,
    user: {
      username: username.trim(),
      role,
      departmentLabel: getDepartmentLabel(role)
    }
  };
};
