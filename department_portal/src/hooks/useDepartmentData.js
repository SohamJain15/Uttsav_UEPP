import { useCallback, useEffect, useState } from 'react';
import {
  getDepartmentScopedApplications,
  getDepartmentJurisdiction,
  getPortalData
} from '../data/storage';

export const useDepartmentData = (role) => {
  const [applications, setApplications] = useState([]);
  const [jurisdiction, setJurisdiction] = useState([]);
  const [mapping, setMapping] = useState({});

  const load = useCallback(() => {
    if (!role) {
      setApplications([]);
      setJurisdiction([]);
      setMapping({});
      return;
    }

    const portalData = getPortalData();
    setApplications(getDepartmentScopedApplications(role));
    setJurisdiction(getDepartmentJurisdiction(role));
    setMapping(portalData.pincodeDepartmentMapping ?? {});
  }, [role]);

  useEffect(() => {
    load();
    const listener = () => load();
    window.addEventListener('uttsav-data-change', listener);
    return () => window.removeEventListener('uttsav-data-change', listener);
  }, [load]);

  return {
    applications,
    jurisdiction,
    pincodeDepartmentMapping: mapping,
    refresh: load
  };
};
