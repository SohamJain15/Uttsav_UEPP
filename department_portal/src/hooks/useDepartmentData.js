import { useCallback, useEffect, useRef, useState } from 'react';
import { departmentService } from '../services/departmentService';

const buildJurisdiction = (applications, role) => {
  if (!role) return [];
  if (role === 'Admin') return ['All Jurisdictions'];

  const pincodes = new Set();
  applications.forEach((application) => {
    const required = Array.isArray(application.requiredDepartments)
      ? application.requiredDepartments
      : [];
    if (required.includes(role) && application.pincode) {
      pincodes.add(String(application.pincode));
    }
  });

  return Array.from(pincodes).sort();
};

const buildPincodeDepartmentMapping = (applications) => {
  const mapping = {};

  applications.forEach((application) => {
    const pincode = String(application.pincode || '').trim();
    if (!pincode) return;

    const departments = Array.isArray(application.requiredDepartments)
      ? application.requiredDepartments.filter(Boolean)
      : [];

    if (!mapping[pincode]) {
      mapping[pincode] = [];
    }

    departments.forEach((department) => {
      if (!mapping[pincode].includes(department)) {
        mapping[pincode].push(department);
      }
    });
  });

  return mapping;
};

export const useDepartmentData = (role) => {
  const POLL_INTERVAL_MS = 30000;
  const [applications, setApplications] = useState([]);
  const [jurisdiction, setJurisdiction] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    if (!role) {
      setApplications([]);
      setJurisdiction([]);
      setMapping({});
      setError('');
      hasLoadedRef.current = false;
      return;
    }

    inFlightRef.current = true;
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError('');

    try {
      const nextApplications = await departmentService.getApplications();
      setApplications(nextApplications);
      setJurisdiction(buildJurisdiction(nextApplications, role));
      setMapping(buildPincodeDepartmentMapping(nextApplications));
    } catch (loadError) {
      setApplications([]);
      setJurisdiction(role === 'Admin' ? ['All Jurisdictions'] : []);
      setMapping({});
      setError(loadError?.message || 'Failed to fetch department applications.');
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [role]);

  useEffect(() => {
    load();
    const runVisibleRefresh = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    const intervalId = setInterval(runVisibleRefresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', runVisibleRefresh);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', runVisibleRefresh);
    };
  }, [load]);

  return {
    applications,
    jurisdiction,
    pincodeDepartmentMapping: mapping,
    refresh: load,
    isLoading,
    error,
  };
};
