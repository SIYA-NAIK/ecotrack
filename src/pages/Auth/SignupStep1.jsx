import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./authFlow.css";

const SignupStep1 = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");

  const onChange = (e) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const onNext = (e) => {
    e.preventDefault();
    setError("");

    if (!form.full_name || !form.email || !form.phone || !form.password || !form.confirm_password) {
      setError("Please fill all fields.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    // store step1 details in localStorage (until verified)
    localStorage.setItem("signup_step1", JSON.stringify(form));

    navigate("/signup/address");
  };

  return (
    <div className="flow-page">
      <div className="flow-card">
        <div className="stepper">
          <div className="step done">
            <div className="dot done">✓</div>
            <div className="label">Sign Up</div>
          </div>
          <div className="line active" />
          <div className="step active">
            <div className="dot active">2</div>
            <div className="label">Address</div>
          </div>
          <div className="line" />
          <div className="step">
            <div className="dot">3</div>
            <div className="label">Preferences</div>
          </div>
        </div>

        <h2 className="flow-title">Create Account</h2>
        <p className="flow-subtitle">Enter your details to continue.</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={onNext} className="form">
          <div className="field">
            <label>Full Name</label>
            <input name="full_name" value={form.full_name} onChange={onChange} placeholder="Your Name" />
          </div>

          <div className="field">
            <label>Email</label>
            <input name="email" value={form.email} onChange={onChange} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label>Phone</label>
            <input name="phone" value={form.phone} onChange={onChange} placeholder="9876543210" />
          </div>

          <div className="grid2">
            <div className="field">
              <label>Password</label>
              <input type="password" name="password" value={form.password} onChange={onChange} placeholder="********" />
            </div>
            <div className="field">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={onChange}
                placeholder="********"
              />
            </div>
          </div>

          <div className="actions">
            <button type="button" className="btn secondary" onClick={() => navigate("/login")}>
              Back to Login
            </button>
            <button type="submit" className="btn primary">
              Continue
            </button>
          </div>

          <div className="footer-note">Your data is encrypted and never shared 🔒</div>
        </form>
      </div>
    </div>
  );
};

export default SignupStep1;