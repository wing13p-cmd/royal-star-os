import { useCallback, useEffect, useMemo, useState } from 'react';
import { executeLogout, resolveLogoutAvailability } from '../utils/logoutControl.js';

export function useLogoutControl(onLoggedOut) {
  const [logoutEnabled, setLogoutEnabled] = useState(false);
  const [logoutReason, setLogoutReason] = useState('AUTH_NOT_ACTIVE');
  const [logoutMessage, setLogoutMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAvailability = async () => {
      const availability = await resolveLogoutAvailability();
      if (cancelled) return;
      setLogoutEnabled(Boolean(availability.enabled));
      setLogoutReason(availability.reason || 'AUTH_NOT_ACTIVE');
    };

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    if (!logoutEnabled || loggingOut) {
      return;
    }

    setLoggingOut(true);
    const result = await executeLogout();
    setLoggingOut(false);

    if (result.ok) {
      setLogoutMessage('Logged out successfully.');
      if (typeof onLoggedOut === 'function') {
        onLoggedOut();
      }
      return;
    }

    setLogoutMessage('Unable to log out right now.');
  }, [loggingOut, logoutEnabled, onLoggedOut]);

  const title = useMemo(() => {
    if (logoutEnabled) return 'Log out of the active session';
    if (logoutReason === 'AUTH_UNAVAILABLE') return 'Authentication service unavailable in this runtime';
    return 'Authentication is not active in this runtime';
  }, [logoutEnabled, logoutReason]);

  return {
    logoutEnabled,
    logoutReason,
    logoutMessage,
    loggingOut,
    handleLogout,
    title,
  };
}
