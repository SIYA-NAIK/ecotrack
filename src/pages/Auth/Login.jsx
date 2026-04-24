import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import "./auth.css";

const Login = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("resident");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validateField = (name, value) => {
    const trimmedValue = String(value || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    switch (name) {
      case "email":
        if (!trimmedValue) return "Email address is required.";
        if (!emailRegex.test(trimmedValue)) {
          return "Please enter a valid email address.";
        }
        return "";

      case "password":
        if (!trimmedValue) return "Password is required.";
        if (trimmedValue.length < 6) {
          return "Password must be at least 6 characters.";
        }
        return "";

      default:
        return "";
    }
  };

  const validateForm = () => {
    const newErrors = {
      email: validateField("email", email),
      password: validateField("password", password),
    };

    Object.keys(newErrors).forEach((key) => {
      if (!newErrors[key]) delete newErrors[key];
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    setErrors((prev) => ({
      ...prev,
      email: validateField("email", value),
    }));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);

    setErrors((prev) => ({
      ...prev,
      password: validateField("password", value),
    }));
  };

  const handleBlur = (fieldName, value) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: validateField(fieldName, value),
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (String(data.user.role).toLowerCase() === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("Server not responding. Try again!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
    setEmail("");
    setPassword("");
    setErrors({});
  };

  const isFormValid = useMemo(() => {
    const emailError = validateField("email", email);
    const passwordError = validateField("password", password);

    return (
      email.trim() !== "" &&
      password.trim() !== "" &&
      !emailError &&
      !passwordError
    );
  }, [email, password]);

  return (
    <div className="auth-page">
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-left">
            <h1>
              Welcome back to <span>EcoTrack</span>
            </h1>
            <p>Continue your journey towards sustainability.</p>
          </div>

          <div className="auth-right">
            <label className="role-label">Choose a role</label>

            <select
              className="auth-field role-select-custom"
              value={role}
              onChange={handleRoleChange}
            >
              <option value="resident">Resident</option>
              <option value="admin">Admin</option>
            </select>

            <h2>Log In</h2>

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => handleBlur("email", email)}
              className={
                errors.email
                  ? "input-error"
                  : email.trim()
                  ? "input-success"
                  : ""
              }
            />
            {errors.email && <p className="auth-error">{errors.email}</p>}

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => handleBlur("password", password)}
              className={
                errors.password
                  ? "input-error"
                  : password.trim()
                  ? "input-success"
                  : ""
              }
            />
            {errors.password && <p className="auth-error">{errors.password}</p>}

            <p
              className="forgot-password-text"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot Password?
            </p>

            <button
              className="auth-btn"
              onClick={handleLogin}
              disabled={submitting || !isFormValid}
            >
              {submitting ? "Logging In..." : "Log In →"}
            </button>

            {role === "resident" && (
              <div className="social-buttons">
                <div id="googleSignIn" className="social-btn"></div>
              </div>
            )}

            <p className="auth-footer">
              Don’t have an account?{" "}
              <span onClick={() => navigate("/signup")}>Sign up</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;