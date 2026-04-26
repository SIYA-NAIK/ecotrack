import React, { useState } from "react";
import ResidentNavbar from "../components/ResidentNavbar";
import "../styles/profile.css";
import {
  FaUser,
  FaEnvelope,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaCamera,
  FaSave,
  FaLock,
} from "react-icons/fa";

const API_BASE = "https://ecotrack-mqko.onrender.com";
const API = `${API_BASE}/api`;

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

function syncProfileToStorage(profile) {
  const currentUser = safeParseUser(localStorage.getItem("user")) || {};

  const nextUser = {
    ...currentUser,
    full_name: profile.full_name,
    name: profile.full_name,
    phone: profile.phone,
    photo: profile.photo || currentUser.photo || null,
  };

  localStorage.setItem("user", JSON.stringify(nextUser));

  const nextAvatar = resolveAvatarUrl(profile.photo);
  if (nextAvatar) {
    localStorage.setItem("profile_avatar", nextAvatar);
  }

  window.dispatchEvent(new Event("resident:user-updated"));
}

export default function Profile() {
  const storedUser = safeParseUser(localStorage.getItem("user"));
  const userId = storedUser?.id || null;

  const [form, setForm] = useState({
    full_name: storedUser?.full_name || storedUser?.name || "",
    email: storedUser?.email || "",
    phone: storedUser?.phone || "",
    area: storedUser?.area || "",
    city: storedUser?.city || "",
    house_no: storedUser?.house_no || "",
  });

  const [avatar, setAvatar] = useState(
    localStorage.getItem("profile_avatar") ||
      resolveAvatarUrl(storedUser?.photo)
  );

  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const onChange = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
  };

  const onPickAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Only image files are allowed.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Image size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result);
      setPhotoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (!form.full_name.trim()) return "Full name is required.";

    if (!/^[A-Za-z\s]+$/.test(form.full_name.trim())) {
      return "Full name should contain only letters.";
    }

    if (!form.phone.trim()) return "Phone number is required.";

    if (!/^\d{10}$/.test(form.phone.trim())) {
      return "Phone number must be exactly 10 digits.";
    }

    return "";
  };

  const onSave = async (e) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      setMessage(error);
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = new FormData();

      // Only editable fields are sent
      payload.append("full_name", form.full_name.trim());
      payload.append("phone", form.phone.trim());

      if (photoFile) {
        payload.append("photo", photoFile);
      }

      const res = await fetch(`${API}/profile/${userId}`, {
        method: "PUT",
        body: payload,
      });

      const data = await res.json();

      if (res.ok && data.profile) {
        syncProfileToStorage(data.profile);
        setMessage("Profile updated successfully!");
      } else {
        setMessage(data.message || "Failed to update profile.");
      }
    } catch {
      setMessage("Error updating profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ResidentNavbar />

      <section className="profile-hero">
        <h1>My Profile</h1>
        <p>Only name, phone number, and profile photo can be updated.</p>
      </section>

      <main className="profile-wrap">
        <div className="profile-grid">
          <section className="profile-card">
            <h3>Profile Details</h3>

            {message && <div className="profile-msg">{message}</div>}

            <form onSubmit={onSave} className="profile-form">
              <div className="profile-row">
                <div className="profile-field">
                  <label>Full Name</label>
                  <div className="profile-input">
                    <FaUser className="profile-ic" />
                    <input
                      value={form.full_name}
                      onChange={onChange("full_name")}
                      placeholder="Enter full name"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <div className="profile-input disabled-input">
                    <FaEnvelope className="profile-ic" />
                    <input type="email" value={form.email} disabled />
                    <FaLock className="lock-ic" />
                  </div>
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-field">
                  <label>Phone</label>
                  <div className="profile-input">
                    <FaPhoneAlt className="profile-ic" />
                    <input
                      value={form.phone}
                      onChange={onChange("phone")}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Area</label>
                  <div className="profile-input disabled-input">
                    <FaMapMarkerAlt className="profile-ic" />
                    <input value={form.area} disabled />
                    <FaLock className="lock-ic" />
                  </div>
                </div>
              </div>

              <div className="profile-row">
                <div className="profile-field">
                  <label>City</label>
                  <div className="profile-input disabled-input">
                    <FaMapMarkerAlt className="profile-ic" />
                    <input value={form.city} disabled />
                    <FaLock className="lock-ic" />
                  </div>
                </div>

                <div className="profile-field">
                  <label>House No / Street</label>
                  <div className="profile-input disabled-input">
                    <FaMapMarkerAlt className="profile-ic" />
                    <input value={form.house_no} disabled />
                    <FaLock className="lock-ic" />
                  </div>
                </div>
              </div>

              <button className="profile-primary" disabled={saving}>
                <FaSave />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>

          <aside className="profile-side">
            <div className="profile-card">
              <h3>Profile Photo</h3>

              <div className="avatar-box">
                {avatar ? (
                  <img src={avatar} className="avatar-img" alt="Profile" />
                ) : (
                  <div className="avatar-fallback">
                    {form.full_name?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}

                <label className="upload-btn">
                  <FaCamera /> Upload Photo
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={onPickAvatar}
                  />
                </label>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}