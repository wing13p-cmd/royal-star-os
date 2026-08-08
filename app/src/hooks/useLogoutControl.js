import { useCallback, useEffect, useMemo, useState } from 'react';
import { executeLogout, getStoredSessionId } from '../utils/logoutControl.js';

export function useLogoutControl(onLoggedOut) {
  // Derive availability from localStorage directly — avoids disabling logout on transient API errors.
  const [logoutEnabled, setLogoutEnabled] = useState(() => Boolean(getStoredSessionId()));
  const [logoutMessage, setLogoutMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // Re-evaluate whenever the component mounts or focus returns (e.g. after tab switch).
    const update = () => setLogoutEnabled(Boolean(getStoredSessionId()));
    update();
    window.addEventListener('storage', update);
    window.addEventListener('rsos-logged-out', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('rsos-logged-out', update);
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
      setLogoutEnabled(false);
      setLogoutMessage('Logged out successfully.');
      if (typeof onLoggedOut === 'function') {
        onLoggedOut();
      }
      return;
    }

    setLogoutMessage('Unable to log out right now.');
  }, [loggingOut, logoutEnabled, onLoggedOut]);

  const title = useMemo(
    () => (logoutEnabled ? 'Log out of the active session' : 'Authentication is not active in this runtime'),
    [logoutEnabled],
  );

  return {
    logoutEnabled,
    logoutReason: logoutEnabled ? 'AUTH_ACTIVE' : 'AUTH_NOT_ACTIVE',
    logoutMessage,
    loggingOut,
    handleLogout,
    title,
  };
}
