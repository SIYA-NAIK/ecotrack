import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";

const ForgetPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validateEmail = (value) => {
    const trimmedValue = String(value || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedValue) return "Email address is required.";
    if (!emailRegex.test(trimmedValue)) {
      return "Please enter a valid email address.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      setMessage("");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const res = await fetch("http://localhost:5000/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to send reset link.");
        return;
      }

      setMessage(data.message || "Reset link sent successfully to your email.");
      setEmail("");
    } catch (err) {
      console.error("Forgot Password Error:", err);
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
              Forgot <span>Password?</span>
            </h1>
            <p>
              Enter your registered email address and we will send you a reset
              link.
            </p>
          </div>

          <div className="auth-right">
            <h2>Forgot Password</h2>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                  setMessage("");
                }}
                className={email.trim() ? "input-success" : ""}
              />

              {error && <p className="auth-error">{error}</p>}
              {message && <p className="auth-success">{message}</p>}

              <button
                className="auth-btn"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send Reset Link →"}
              </button>
            </form>

            <p className="auth-footer">
              Remember your password?{" "}
              <span onClick={() => navigate("/login")}>Back to Login</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;