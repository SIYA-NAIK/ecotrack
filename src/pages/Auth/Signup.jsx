import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import plant from "../../assets/auth/plant.jpg";



const Signup = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
const [otpSent, setOtpSent] = useState(false);
const [otpVerified, setOtpVerified] = useState(false);
const [sendingOtp, setSendingOtp] = useState(false);

  const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    area: "",
    house_no: "",
    city: "",
    state: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        setLoadingAreas(true);
        const response = await fetch("http://localhost:5000/api/areas");
        const data = await response.json();

        if (response.ok) {
          setAreas(Array.isArray(data) ? data : []);
        } else {
          console.error("Failed to fetch areas:", data.message);
          setAreas([]);
        }
      } catch (err) {
        console.error("Failed to fetch areas:", err);
        setAreas([]);
      } finally {
        setLoadingAreas(false);
      }
    };

    fetchAreas();
  }, []);

  const validateField = (name, value, allValues) => {
    const currentValues = allValues || formData;
    const trimmedValue = typeof value === "string" ? value.trim() : value;

    const nameRegex = /^[A-Za-z\s.'-]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[6-9]\d{9}$/;
    const cityStateRegex = /^[A-Za-z\s.'-]+$/;
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_^+=-])[A-Za-z\d@$!%*?&.#_^+=-]{8,}$/;

    switch (name) {
      case "full_name":
        if (!trimmedValue) return "Full name is required.";
        if (trimmedValue.length < 3) return "Full name must be at least 3 characters.";
        if (!nameRegex.test(trimmedValue)) {
          return "Full name can contain only letters, spaces, and . ' -";
        }
        return "";

      case "email":
        if (!trimmedValue) return "Email address is required.";
        if (!emailRegex.test(trimmedValue)) {
          return "Please enter a valid email address.";
        }
        return "";

      case "phone":
        if (!trimmedValue) return "Phone number is required.";
        if (!/^\d+$/.test(trimmedValue)) {
          return "Phone number must contain digits only.";
        }
        if (!phoneRegex.test(trimmedValue)) {
          return "Enter a valid 10-digit phone number.";
        }
        return "";

      case "area":
        if (!trimmedValue) return "Please select an area.";
        return "";

      case "house_no":
        if (!trimmedValue) return "House number / address is required.";
        if (trimmedValue.length < 5) {
          return "Address must be at least 5 characters.";
        }
        return "";

      case "city":
        if (!trimmedValue) return "City is required.";
        if (!cityStateRegex.test(trimmedValue)) {
          return "City can contain only letters, spaces, and . ' -";
        }
        return "";

      case "state":
        if (!trimmedValue) return "State is required.";
        if (!cityStateRegex.test(trimmedValue)) {
          return "State can contain only letters, spaces, and . ' -";
        }
        return "";

      case "password":
        if (!trimmedValue) return "Password is required.";
        if (!passwordRegex.test(trimmedValue)) {
          return "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
        }
        return "";

      case "confirmPassword":
        if (!trimmedValue) return "Please confirm your password.";
        if (trimmedValue !== currentValues.password) {
          return "Passwords do not match.";
        }
        return "";

      default:
        return "";
    }
  };

  const validateForm = () => {
    const newErrors = {};

    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key], formData);
      if (error) {
        newErrors[key] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
  const { name, value } = e.target;

  let sanitizedValue = value;

  if (name === "phone") {
    sanitizedValue = value.replace(/\D/g, "").slice(0, 10);
  }

  if (name === "full_name" || name === "city" || name === "state") {
    sanitizedValue = value.replace(/\s{2,}/g, " ");
  }

  setFormData((prev) => {
    let updated = {
      ...prev,
      [name]: sanitizedValue,
    };

    // 🔥 AUTO-FILL CITY & STATE
    if (name === "area") {
      const selectedArea = areas.find((a) => a.area === sanitizedValue);

      if (selectedArea) {
        updated.city = selectedArea.city || "";
        updated.state = selectedArea.state || "";
      }
    }

    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: validateField(name, sanitizedValue, updated),
      ...(name === "password" && prev.confirmPassword
        ? {
            confirmPassword: validateField(
              "confirmPassword",
              prev.confirmPassword,
              updated
            ),
          }
        : {}),
    }));

    return updated;
  });
};

  const handleBlur = (e) => {
    const { name, value } = e.target;

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name, value, formData),
    }));
  };

  const isFormValid = useMemo(() => {
    const noEmptyFields = Object.values(formData).every(
      (value) => String(value).trim() !== ""
    );
    const noErrors = Object.values(errors).every((error) => !error);
    return noEmptyFields && noErrors;
  }, [formData, errors]);

  const handleSignup = async () => {
    if (!validateForm()) return;

    const payload = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      password: formData.password,
      role: "resident",
      area: formData.area.trim(),
      house_no: formData.house_no.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      username: null,
    };

    try {
      setSubmitting(true);

      const response = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Account created successfully ✅");
        navigate("/login");
      } else {
        alert(data.message || "Signup failed");
      }
    } catch (err) {
      console.error("Signup error:", err);
      alert("Server not responding.");
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
              Start your <span>EcoTrack</span> journey.
            </h1>
            <p>Create an account and contribute to a sustainable future.</p>
            <img src={plant} alt="Eco plant" />
          </div>

          <div className="auth-right">
            <h2>JOIN ECOTRACK</h2>

            <input
              name="full_name"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.full_name ? "input-error" : ""}
            />
            {errors.full_name && <p className="auth-error">{errors.full_name}</p>}

            <input
  type="email"
  name="email"
  placeholder="Email address"
  value={formData.email}
  onChange={handleChange}
  onBlur={handleBlur}
  autoComplete="new-email"
  className={errors.email ? "input-error" : ""}
/>
            {errors.email ? (
              <p className="auth-error">{errors.email}</p>
            ) : formData.email.trim() ? (
              <p className="auth-success">Valid email ✓</p>
            ) : null}

            <input
              name="phone"
              placeholder="Phone number"
              value={formData.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={10}
              className={errors.phone ? "input-error" : ""}
            />
            {errors.phone && <p className="auth-error">{errors.phone}</p>}

            <select
              name="area"
              className={`auth-field ${errors.area ? "input-error" : ""}`}
              value={formData.area}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={loadingAreas}
            >
              <option value="">
                {loadingAreas ? "Loading areas..." : "Select Area"}
              </option>

              {areas
                .filter(
                  (a) => String(a.status || "Active").toLowerCase() === "active"
                )
                .map((a) => (
                  <option key={a.id} value={a.area}>
                    {a.area}
                  </option>
                ))}
            </select>
            {errors.area && <p className="auth-error">{errors.area}</p>}

            <input
              name="house_no"
              placeholder="House No / Full Address"
              value={formData.house_no}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.house_no ? "input-error" : ""}
            />
            {errors.house_no && <p className="auth-error">{errors.house_no}</p>}

            <input
  name="city"
  placeholder="City"
  value={formData.city}
  readOnly
  className={errors.city ? "input-error" : ""}
/>

<input
  name="state"
  placeholder="State"
  value={formData.state}
  readOnly
  className={errors.state ? "input-error" : ""}
/>
            {errors.state && <p className="auth-error">{errors.state}</p>}

            <input
  type="password"
  name="password"
  placeholder="Password"
  value={formData.password}
  onChange={handleChange}
  onBlur={handleBlur}
  autoComplete="new-password"
  className={errors.password ? "input-error" : ""}
/>

            <input
  type="password"
  name="confirmPassword"
  placeholder="Confirm password"
  value={formData.confirmPassword}
  onChange={handleChange}
  onBlur={handleBlur}
  autoComplete="new-password"
  className={errors.confirmPassword ? "input-error" : ""}
/>

            <button
              className="auth-btn"
              onClick={handleSignup}
              disabled={submitting || !isFormValid}
            >
              {submitting ? "Creating Account..." : "Sign Up →"}
            </button>

            <div className="auth-footer">
              Already have an account?{" "}
              <span onClick={() => navigate("/login")}>Log in</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;



