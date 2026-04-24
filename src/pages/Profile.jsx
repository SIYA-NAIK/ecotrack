import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResidentNavbar from "../components/ResidentNavbar";
import "../styles/profile.css";
import {
  FaUser,
  FaEnvelope,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaCamera,
  FaSave,
} from "react-icons/fa";

const API_BASE = "http://localhost:5000";

function safeParseUser(rawUser) {
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function resolveAvatarUrl(photo) {
  const trimmedPhoto = String(photo || "").trim();
  if (!trimmedPhoto) return null;

  if (
    trimmedPhoto.startsWith("http://") ||
    trimmedPhoto.startsWith("https://") ||
    trimmedPhoto.startsWith("data:")
  ) {
    return trimmedPhoto;
  }

  return `${API_BASE}/uploads/${trimmedPhoto}`;
}

function buildAddress(houseNo, area, city) {
  return [houseNo, area, city]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function syncProfileToStorage(profile) {
  const currentUser = safeParseUser(localStorage.getItem("user")) || {};
  const nextUser = {
    ...currentUser,
    id: profile.id,
    full_name: profile.full_name,
    name: profile.full_name,
    email: profile.email,
    role: profile.role || currentUser.role || "resident",
    photo: profile.photo || null,
    phone: profile.phone || "",
    city: profile.city || "",
    area: profile.area || "",
    house_no: profile.house_no || "",
    address: buildAddress(profile.house_no, profile.area, profile.city),
    address_verified: Number(profile.address_verified || 0),
  };

  localStorage.setItem("user", JSON.stringify(nextUser));

  const nextAvatar = resolveAvatarUrl(profile.photo);
  if (nextAvatar) {
    localStorage.setItem("profile_avatar", nextAvatar);
  } else {
    localStorage.removeItem("profile_avatar");
  }

  window.dispatchEvent(new Event("resident:user-updated"));
}

export default function Profile() {
  const navigate = useNavigate();
  const storedUser = safeParseUser(localStorage.getItem("user"));
  const userId = storedUser?.id || null;

  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);

  const [form, setForm] = useState({
    full_name: storedUser?.full_name || storedUser?.name || "",
    email: storedUser?.email || "",
    phone: storedUser?.phone || "",
    area: storedUser?.area || "",
    city: storedUser?.city || "",
    house_no: storedUser?.house_no || storedUser?.address || "",
  });

  const [avatar, setAvatar] = useState(() => {
    const storedAvatar = localStorage.getItem("profile_avatar");
    return storedAvatar || resolveAvatarUrl(storedUser?.photo);
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [message, setMessage] = useState("");
  const [addressVerified, setAddressVerified] = useState(
    Boolean(storedUser?.address_verified)
  );

  const profileCompletion = useMemo(() => {
    const values = [
      form.full_name,
      form.email,
      form.phone,
      form.house_no,
      form.area,
      form.city,
    ];
    const filled = values.filter((value) => String(value || "").trim()).length;
    return Math.round((filled / values.length) * 100);
  }, [form]);

  useEffect(() => {
    let mounted = true;

    const fetchAreas = async () => {
      try {
        setAreasLoading(true);
        const res = await fetch(`${API_BASE}/api/areas`);
        const data = await res.json();

        if (!mounted) return;

        if (res.ok) {
          setAreas(Array.isArray(data) ? data : []);
        } else {
          console.error("Failed to fetch areas:", data.message);
          setAreas([]);
        }
      } catch (error) {
        if (!mounted) return;
        console.error("Failed to fetch areas:", error);
        setAreas([]);
      } finally {
        if (mounted) setAreasLoading(false);
      }
    };

    fetchAreas();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setMessage("User not found. Please login again.");
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setMessage("");

        const res = await fetch(`${API_BASE}/api/profile/${userId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to load profile");
        }

        if (!mounted) return;

        setForm({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          area: data.area || "",
          city: data.city || "",
          house_no: data.house_no || "",
        });
        setAddressVerified(Boolean(Number(data.address_verified || 0)));
        setAvatar(resolveAvatarUrl(data.photo));
        syncProfileToStorage(data);
      } catch (error) {
        if (!mounted) return;
        console.error("Load profile error:", error);
        setMessage(error.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const onChange = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onPickAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(String(reader.result || ""));
      setPhotoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const onSave = async (event) => {
    event.preventDefault();

    if (!userId) {
      setMessage("User not found. Please login again.");
      return;
    }

    if (!form.full_name.trim() || !form.email.trim()) {
      setMessage("Full name and email are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = new FormData();
      payload.append("full_name", form.full_name.trim());
      payload.append("email", form.email.trim());
      payload.append("phone", form.phone.trim());
      payload.append("area", form.area.trim());
      payload.append("city", form.city.trim());
      payload.append("house_no", form.house_no.trim());

      if (photoFile) {
        payload.append("photo", photoFile);
      }

      const res = await fetch(`${API_BASE}/api/profile/${userId}`, {
        method: "PUT",
        body: payload,
      });
      const data = await res.json();

      if (!res.ok || !data.profile) {
        throw new Error(data.message || "Failed to save profile");
      }

      setForm({
        full_name: data.profile.full_name || "",
        email: data.profile.email || "",
        phone: data.profile.phone || "",
        area: data.profile.area || "",
        city: data.profile.city || "",
        house_no: data.profile.house_no || "",
      });
      setAddressVerified(Boolean(Number(data.profile.address_verified || 0)));
      setAvatar(resolveAvatarUrl(data.profile.photo) || avatar);
      setPhotoFile(null);
      syncProfileToStorage(data.profile);
      setMessage("Profile saved successfully.");
    } catch (error) {
      console.error("Save profile error:", error);
      setMessage(error.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ResidentNavbar />

      <section className="profile-hero">
        <div className="profile-pill">
          <span className="pill-dot" />
          Waste Management System
        </div>

        <h1>My Profile</h1>
        <p>Manage your personal details, address, and profile photo.</p>
      </section>

      <main className="profile-wrap">
        <div className="profile-grid">
          <section className="profile-card">
            <div className="profile-card-head">
              <div className="profile-card-ic">
                <FaUser />
              </div>
              <div>
                <h3>Profile Details</h3>
                <p className="profile-card-sub">
                  Keep your resident information current for accurate pickups.
                </p>
              </div>
            </div>

            {message ? <div className="profile-msg">{message}</div> : null}

            <form onSubmit={onSave} className="profile-form">
              <div className="profile-row">
                <div className="profile-field">
                  <label>Full Name</label>
                  <div className="profile-input">
                    <input
                      value={form.full_name}
                      onChange={onChange("full_name")}
                      placeholder="Enter full name"
                      disabled={loading}
                    />
                    <span className="profile-ic">
                      <FaUser />
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <div className="profile-input">
                    <input
                      type="email"
                      value={form.email}
                      onChange={onChange("email")}
                      placeholder="Enter email"
                      disabled={loading}
                    />
                    <span className="profile-ic">
                      <FaEnvelope />
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-field">
                  <label>Phone</label>
                  <div className="profile-input">
                    <input
                      value={form.phone}
                      onChange={onChange("phone")}
                      placeholder="Enter phone"
                      disabled={loading}
                    />
                    <span className="profile-ic">
                      <FaPhoneAlt />
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <label>Area</label>
                  <div className="profile-input">
                    <select
                      value={form.area}
                      onChange={onChange("area")}
                      disabled={loading || areasLoading}
                    >
                      <option value="">
                        {areasLoading ? "Loading areas..." : "Select Area"}
                      </option>

                      {areas
                        .filter(
                          (a) =>
                            String(a.status || "Active").toLowerCase() ===
                            "active"
                        )
                        .map((a) => (
                          <option key={a.id} value={a.area}>
                            {a.area}
                          </option>
                        ))}
                    </select>
                    <span className="profile-ic">
                      <FaMapMarkerAlt />
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-field">
                  <label>City</label>
                  <div className="profile-input">
                    <input
                      value={form.city}
                      onChange={onChange("city")}
                      placeholder="Enter city"
                      disabled={loading}
                    />
                    <span className="profile-ic">
                      <FaMapMarkerAlt />
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <label>House No / Street</label>
                  <div className="profile-input">
                    <input
                      value={form.house_no}
                      onChange={onChange("house_no")}
                      placeholder="Enter house number or street"
                      disabled={loading}
                    />
                    <span className="profile-ic">
                      <FaMapMarkerAlt />
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="profile-primary"
                type="submit"
                disabled={saving || loading}
              >
                <FaSave className="btn-ic" />
                {saving ? "Saving..." : loading ? "Loading..." : "Save Changes"}
              </button>
            </form>
          </section>

          <aside className="profile-side">
            <div className="profile-card">
              <div className="profile-card-head">
                <div className="profile-card-ic">
                  <FaCamera />
                </div>
                <div>
                  <h3>Profile Photo</h3>
                  <p className="profile-card-sub">Shown in the resident navbar</p>
                </div>
              </div>

              <div className="avatar-box">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="avatar-img" />
                ) : (
                  <div className="avatar-fallback">
                    {(form.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                )}

                <label className="upload-btn">
                  <FaCamera style={{ marginRight: 8 }} />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onPickAvatar}
                    hidden
                  />
                </label>

                <p className="avatar-hint">
                  Image uploads are saved to the backend and reflected across
                  resident pages.
                </p>
              </div>
            </div>

            <div className="impact-card">
              <h3>Profile Status</h3>
              <div className="impact-stats">
                <div>
                  <p>COMPLETION</p>
                  <h2>{profileCompletion}%</h2>
                </div>
                <div>
                  <p>ADDRESS</p>
                  <h2>{addressVerified ? "Verified" : "Pending"}</h2>
                </div>
                <div>
                  <p>NAVIGATION</p>
                  <h2>
                    {buildAddress(form.house_no, form.area, form.city)
                      ? "Ready"
                      : "Add"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="upload-btn"
                style={{ marginTop: 18 }}
                onClick={() => navigate("/address-verification")}
              >
                {addressVerified
                  ? "Review Address Verification"
                  : "Verify Address"}
              </button>
            </div>
          </aside>
        </div>

        <div className="profile-footer">
          EcoTrack • Keep your details updated for accurate pickup scheduling.
        </div>
      </main>
    </>
  );
}