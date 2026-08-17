import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import { buildSessionHeaders, getStoredSessionId, storeSessionId } from "../utils/sessionAuth.js";

function authHeaders(sessionId = "") {
  return buildSessionHeaders(sessionId, { "Content-Type": "application/json" });
}

export default function AuthGate({ children }) {
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [mfaStatus, setMfaStatus] = useState(null);
  const [pendingEnrollment, setPendingEnrollment] = useState(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const title = useMemo(() => (mfaStep ? "MFA Verification" : "Administrator Sign In"), [mfaStep]);

  const resolveAuthState = async () => {
    const sessionId = getStoredSessionId();
    if (!sessionId) {
      setAuthenticated(false);
      setAuthChecking(false);
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/auth/me"), {
        method: "GET",
        headers: authHeaders(sessionId),
      });

      if (!response.ok) {
        storeSessionId("");
        setAuthenticated(false);
        setAuthChecking(false);
        return;
      }

      setAuthenticated(true);
      setAuthChecking(false);
    } catch {
      storeSessionId("");
      setAuthenticated(false);
      setAuthChecking(false);
    }
  };

  const refreshMfaStatus = async () => {
    const sessionId = getStoredSessionId();
    if (!sessionId) return;

    try {
      const response = await fetch(buildApiUrl("/api/auth/mfa/status"), {
        method: "GET",
        headers: authHeaders(sessionId),
      });

      if (!response.ok) return;
      const payload = await response.json();
      setMfaStatus(payload);
    } catch {
      // Keep UI stable on status failures.
    }
  };

  useEffect(() => {
    resolveAuthState();
  }, []);

  useEffect(() => {
    const handleLoggedOut = () => {
      setAuthenticated(false);
      setMfaStep(false);
      setChallengeId("");
      setSecurityOpen(false);
      setPendingEnrollment(null);
      setRecoveryCodes([]);
      // Push a fresh history entry so the Back button returns here (login screen), not the app.
      if (typeof window !== "undefined") {
        window.history.pushState({ rsos_authenticated: false }, "", window.location.pathname);
      }
    };

    window.addEventListener("rsos-logged-out", handleLoggedOut);
    return () => {
      window.removeEventListener("rsos-logged-out", handleLoggedOut);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setSecurityOpen(false);
      setPendingEnrollment(null);
      setRecoveryCodes([]);
      return;
    }

    const intervalId = window.setInterval(async () => {
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        setAuthenticated(false);
        setMfaStep(false);
        setChallengeId("");
        return;
      }

      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), {
          method: "GET",
          headers: authHeaders(sessionId),
        });

        if (!response.ok) {
          storeSessionId("");
          setAuthenticated(false);
          setMfaStep(false);
          setChallengeId("");
        }
      } catch {
        // Keep current session state during transient network issues.
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !securityOpen) return;
    refreshMfaStatus();
  }, [authenticated, securityOpen]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setLoginLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status >= 500) {
          setErrorMessage("Server error. Please try again in a moment.");
        } else if (response.status === 429) {
          setErrorMessage("Too many attempts. Please wait before trying again.");
        } else {
          setErrorMessage("Invalid credentials.");
        }
        return;
      }

      if (payload?.mfaRequired) {
        setMfaStep(true);
        setChallengeId(String(payload.challengeId || ""));
        setPassword("");
        return;
      }

      const sessionId = String(payload?.session?.id || "");
      if (!sessionId) {
        setErrorMessage("Authentication failed.");
        return;
      }

      storeSessionId(sessionId);
      setAuthenticated(true);
      setMfaStep(false);
      setChallengeId("");
      setMfaCode("");
      setPassword("");
      setErrorMessage("");
    } catch {
      setErrorMessage("Unable to sign in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMfaVerify = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setLoginLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/auth/mfa/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: mfaCode }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage("Invalid verification code.");
        return;
      }

      const sessionId = String(payload?.session?.id || "");
      if (!sessionId) {
        setErrorMessage("Authentication failed.");
        return;
      }

      storeSessionId(sessionId);
      setAuthenticated(true);
      setMfaStep(false);
      setChallengeId("");
      setMfaCode("");
      setErrorMessage("");
    } catch {
      setErrorMessage("Unable to verify MFA code.");
    } finally {
      setLoginLoading(false);
    }
  };

  const startMfaEnrollment = async () => {
    setSecurityMessage("");
    setRecoveryCodes([]);
    setConfirmCode("");

    const sessionId = getStoredSessionId();
    if (!sessionId) {
      setSecurityMessage("No active session.");
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/auth/mfa/enroll"), {
        method: "POST",
        headers: authHeaders(sessionId),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSecurityMessage("Unable to start MFA setup.");
        return;
      }

      setPendingEnrollment({
        secret: payload.secret,
        otpauthUrl: payload.otpauthUrl,
      });
      setSecurityMessage("Enter a current authenticator code to confirm setup.");
    } catch {
      setSecurityMessage("Unable to start MFA setup.");
    }
  };

  const confirmMfaEnrollmentAction = async (event) => {
    event.preventDefault();
    setSecurityMessage("");

    const sessionId = getStoredSessionId();
    if (!sessionId) {
      setSecurityMessage("No active session.");
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/auth/mfa/confirm"), {
        method: "POST",
        headers: authHeaders(sessionId),
        body: JSON.stringify({ code: confirmCode }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSecurityMessage("Unable to confirm MFA setup.");
        return;
      }

      setRecoveryCodes(Array.isArray(payload.recoveryCodes) ? payload.recoveryCodes : []);
      setPendingEnrollment(null);
      setConfirmCode("");
      setSecurityMessage("MFA enabled. Save recovery codes now; they are shown once.");
      await refreshMfaStatus();
    } catch {
      setSecurityMessage("Unable to confirm MFA setup.");
    }
  };

  const disableMfaAction = async (event) => {
    event.preventDefault();
    setSecurityMessage("");

    const sessionId = getStoredSessionId();
    if (!sessionId) {
      setSecurityMessage("No active session.");
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/auth/mfa/disable"), {
        method: "POST",
        headers: authHeaders(sessionId),
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode,
        }),
      });

      if (!response.ok) {
        setSecurityMessage("Unable to disable MFA.");
        return;
      }

      setDisablePassword("");
      setDisableCode("");
      setPendingEnrollment(null);
      setRecoveryCodes([]);
      setSecurityMessage("MFA disabled.");
      await refreshMfaStatus();
    } catch {
      setSecurityMessage("Unable to disable MFA.");
    }
  };

  if (authChecking) {
    return (
      <div style={styles.fullscreen}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Royal Star Operating System</h2>
          <p style={styles.subheading}>Validating administrator session...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={styles.fullscreen}>
        <form style={styles.card} onSubmit={mfaStep ? handleMfaVerify : handleLogin}>
          <h2 style={styles.heading}>Royal Star Operating System</h2>
          <p style={styles.subheading}>{title}</p>

          {!mfaStep ? (
            <>
              <label style={styles.label}>
                Username
                <input
                  style={styles.input}
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label style={styles.label}>
                Password
                <input
                  style={styles.input}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label style={styles.label}>
                Authenticator or Recovery Code
                <input
                  style={styles.input}
                  type="text"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                  required
                />
              </label>
            </>
          )}

          {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}

          <button type="submit" style={styles.button} disabled={loginLoading}>
            {loginLoading ? "Please wait..." : (mfaStep ? "Verify" : "Sign In")}
          </button>

          {mfaStep ? (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setMfaStep(false);
                setChallengeId("");
                setMfaCode("");
                setErrorMessage("");
              }}
            >
              Back
            </button>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <>
      {children}

      <button
        type="button"
        style={styles.securityToggle}
        onClick={() => setSecurityOpen((current) => !current)}
      >
        Security
      </button>

      {securityOpen ? (
        <aside style={styles.securityPanel}>
          <h3 style={styles.panelHeading}>MFA Security</h3>
          <p style={styles.panelText}>Enabled: {mfaStatus?.enabled ? "Yes" : "No"}</p>
          <p style={styles.panelText}>Recovery Codes Remaining: {mfaStatus?.recoveryCodesRemaining ?? "-"}</p>

          <button type="button" style={styles.smallButton} onClick={refreshMfaStatus}>Refresh Status</button>
          <button type="button" style={styles.smallButton} onClick={startMfaEnrollment}>Begin Setup</button>

          {pendingEnrollment ? (
            <div style={styles.section}>
              <p style={styles.panelText}>Secret: {pendingEnrollment.secret}</p>
              <p style={styles.panelText}>otpauth URI: {pendingEnrollment.otpauthUrl}</p>

              <form onSubmit={confirmMfaEnrollmentAction}>
                <label style={styles.label}>
                  Confirm Code
                  <input
                    style={styles.input}
                    type="text"
                    value={confirmCode}
                    onChange={(event) => setConfirmCode(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" style={styles.smallButton}>Confirm MFA</button>
              </form>
            </div>
          ) : null}

          {recoveryCodes.length ? (
            <div style={styles.section}>
              <p style={styles.panelText}>Recovery codes (shown once):</p>
              <ul style={styles.recoveryList}>
                {recoveryCodes.map((entry) => (
                  <li key={entry} style={styles.recoveryItem}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <form onSubmit={disableMfaAction} style={styles.section}>
            <label style={styles.label}>
              Current Password
              <input
                style={styles.input}
                type="password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                required
              />
            </label>
            <label style={styles.label}>
              Authenticator or Recovery Code
              <input
                style={styles.input}
                type="text"
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                required
              />
            </label>
            <button type="submit" style={styles.smallButton}>Disable MFA</button>
          </form>

          {securityMessage ? <p style={styles.panelText}>{securityMessage}</p> : null}
        </aside>
      ) : null}
    </>
  );
}

const styles = {
  fullscreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at top, #1a1a1a 0%, #060606 60%, #000000 100%)",
    color: "#f5d26a",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#0d0d0d",
    border: "1px solid #6a5520",
    borderRadius: "14px",
    padding: "24px",
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.45)",
  },
  heading: {
    margin: "0 0 8px",
    color: "#f5d26a",
    fontSize: "1.2rem",
  },
  subheading: {
    margin: "0 0 16px",
    color: "#d0b56a",
    fontSize: "0.92rem",
  },
  label: {
    display: "block",
    marginBottom: "12px",
    color: "#f5d26a",
    fontSize: "0.85rem",
  },
  input: {
    width: "100%",
    marginTop: "6px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #6a5520",
    background: "#141414",
    color: "#fff4d1",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    marginTop: "8px",
    padding: "11px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(180deg, #f5d26a 0%, #d1ad49 100%)",
    color: "#151515",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    marginTop: "8px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #6a5520",
    background: "#0f0f0f",
    color: "#e7c76d",
    cursor: "pointer",
  },
  error: {
    marginTop: "8px",
    marginBottom: "0",
    color: "#ff8c8c",
    fontSize: "0.85rem",
  },
  securityToggle: {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 1000,
    borderRadius: "999px",
    border: "1px solid #6a5520",
    background: "#0f0f0f",
    color: "#f5d26a",
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  securityPanel: {
    position: "fixed",
    right: "16px",
    bottom: "58px",
    width: "340px",
    maxHeight: "70vh",
    overflowY: "auto",
    zIndex: 1000,
    border: "1px solid #6a5520",
    borderRadius: "10px",
    background: "#0b0b0b",
    color: "#f5d26a",
    padding: "12px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
  },
  panelHeading: {
    margin: "0 0 8px",
    fontSize: "1rem",
  },
  panelText: {
    margin: "4px 0",
    fontSize: "0.82rem",
    color: "#e8cd81",
    wordBreak: "break-word",
  },
  smallButton: {
    marginTop: "8px",
    marginRight: "6px",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #6a5520",
    background: "#141414",
    color: "#f5d26a",
    cursor: "pointer",
  },
  section: {
    borderTop: "1px solid #2b220e",
    marginTop: "10px",
    paddingTop: "10px",
  },
  recoveryList: {
    margin: "8px 0",
    paddingLeft: "18px",
  },
  recoveryItem: {
    marginBottom: "4px",
    fontFamily: "monospace",
    fontSize: "0.8rem",
  },
};
