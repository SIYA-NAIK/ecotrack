import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./auth.css";

const API_BASE = "https://ecotrack-mqko.onrender.com";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { token } = useParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validatePassword = (value) => {
    const trimmedValue = String(value || "").trim();

    if (!trimmedValue) return "Password is required.";
    if (trimmedValue.length < 6) {
      return "Password must be at least 6 characters.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const passwordError = validatePassword(password);

    if (passwordError) {
      setError(passwordError);
      setMessage("");
      return;
    }

    if (!confirmPassword.trim()) {
      setError("Please confirm your password.");
      setMessage("");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setMessage("");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token.");
      setMessage("");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to reset password.");
        return;
      }

      setMessage(data.message || "Password reset successful ✅");

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error("Reset Password Error:", err);
      setError("Server not responding. Try again!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-left">
            <h1>
              Create New <span>Password</span>
            </h1>
            <p>Enter your new password below to access your EcoTrack account.</p>
          </div>

          <div className="auth-right">
            <h2>Reset Password</h2>

            <form onSubmit={handleSubmit} autoComplete="off">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                  setMessage("");
                }}
                autoComplete="new-password"
                className={password.trim() ? "input-success" : ""}
              />

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                  setMessage("");
                }}
                autoComplete="new-password"
                className={confirmPassword.trim() ? "input-success" : ""}
              />

              {error && <p className="auth-error">{error}</p>}
              {message && <p className="auth-success">{message}</p>}

              <button className="auth-btn" type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Reset Password →"}
              </button>
            </form>

            <p className="auth-footer">
              Back to <span onClick={() => navigate("/login")}>Login</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;