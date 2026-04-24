import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResidentNavbar from "../components/ResidentNavbar";
import "./reportissue.css";

import {
  FaExclamationTriangle,
  FaCamera,
  FaMapMarkerAlt,
  FaRegStickyNote,
  FaChevronRight,
  FaBolt,
  FaBan,
  FaTrash,
} from "react-icons/fa";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BACKEND_URL = "https://ecotrack-mqko.onrender.com";
const DEFAULT_MAP_CENTER = [15.3991, 74.0124];

const reportLocationIcon = new L.DivIcon({
  className: "riMiniPin riMiniPinUser",
  html: `<div class="riMiniPinInner">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function ChangeMapView({ center }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    if (!map?._container?.isConnected) return;
    map.setView(center, 16, { animate: false });
  }, [center, map]);

  return null;
}

export default function ReportIssue() {
  const navigate = useNavigate();

  const [activeType, setActiveType] = useState("Missed Collection");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState([]);
  const [priority, setPriority] = useState("Medium");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [issueLat, setIssueLat] = useState("");
  const [issueLng, setIssueLng] = useState("");

  const types = [
    { label: "Missed Collection", icon: <FaTrash /> },
    { label: "Bin Overflow", icon: <FaExclamationTriangle /> },
    { label: "Damaged Bin", icon: <FaBolt /> },
    { label: "Illegal Dumping", icon: <FaBan /> },
  ];

  const detailsPlaceholder = useMemo(() => {
    const placeholders = {
      "Missed Collection":
        "E.g. Garbage was not collected today from my area even though pickup is usually done in the morning.",
      "Bin Overflow":
        "E.g. The public bin near the main road is overflowing and waste is spilling outside since yesterday.",
      "Damaged Bin":
        "E.g. The dustbin near our building has a broken lid / cracked body and cannot be used properly.",
      "Illegal Dumping":
        "E.g. Someone has dumped garbage in the open area near the roadside / field behind our locality.",
    };

    return (
      placeholders[activeType] ||
      "Enter issue details clearly so the team can take action quickly."
    );
  }, [activeType]);

  const mapCenter = useMemo(() => {
    if (issueLat && issueLng) {
      return [Number(issueLat), Number(issueLng)];
    }

    return DEFAULT_MAP_CENTER;
  }, [issueLat, issueLng]);

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setIssueLat(lat.toFixed(7));
        setIssueLng(lng.toFixed(7));

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          setAddress(data.display_name || `Lat:${lat}, Lng:${lng}`);
        } catch {
          setAddress(`Lat:${lat}, Lng:${lng}`);
        } finally {
          setLoadingLocation(false);
        }
      },
      () => {
        alert("Location permission denied");
        setLoadingLocation(false);
      }
    );
  };

  const onSubmit = async () => {
    if (!activeType || !address || !details || photos.length === 0) {
      alert("⚠ Please fill all required details and upload at least one photo.");
      return;
    }

    try {
      setSubmitting(true);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user?.id;

      if (!userId) {
        alert("❌ User not logged in. Please login again.");
        return;
      }

      const fd = new FormData();
      fd.append("userId", userId);
      fd.append("citizen_name", user?.full_name || user?.name || "Resident");
      fd.append(
        "location",
        landmark ? `${address} (Landmark: ${landmark})` : address
      );
      fd.append("issue_type", activeType);
      fd.append("description", details);
      fd.append("priority", String(priority).toLowerCase());

      // backend currently accepts one photo
      fd.append("photo", photos[0]);

      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "❌ Failed to submit report");
        return;
      }

      alert(`✅ Report submitted successfully! Report ID: ${data.id}`);

      setActiveType("Missed Collection");
      setAddress("");
      setLandmark("");
      setDetails("");
      setPhotos([]);
      setPriority("Medium");
      setIssueLat("");
      setIssueLng("");

      // send user to their reports page so they can see it
      navigate("/my-reports");
    } catch (e) {
      console.log(e);
      alert("❌ Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ri-page">
      <ResidentNavbar />

      <div className="ri-hero">
        <div className="ri-hero-top">
          <div className="ri-pill">
            <span className="ri-pill-dot" />
            Waste Management System
          </div>
        </div>

        <h1 className="ri-title">Report Issue</h1>
        <p className="ri-subtitle">
          Keep your community clean — report garbage issues in seconds.
        </p>
      </div>

      <div className="ri-main">
        <div className="ri-section-title">Select Issue Type</div>

        <div className="ri-type-grid">
          {types.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`ri-type-card ${
                activeType === t.label ? "is-active" : ""
              }`}
              onClick={() => setActiveType(t.label)}
            >
              <div className="ri-type-icon">{t.icon}</div>
              <div className="ri-type-label">{t.label}</div>
            </button>
          ))}
        </div>

        <div className="ri-two-col">
          <div className="ri-card">
            <div className="ri-card-head">
              <div className="ri-card-head-ic">
                <FaMapMarkerAlt />
              </div>
              <h3>Issue Details</h3>
            </div>

            <div className="ri-form">
              <div className="ri-row">
                <div className="ri-field">
                  <label>Address *</label>
                  <div className="ri-input">
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your address"
                    />
                    <span className="ri-input-ic">
                      <FaMapMarkerAlt />
                    </span>
                  </div>
                </div>

                <div className="ri-field">
                  <label>Landmark</label>
                  <div className="ri-input">
                    <input
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Nearby landmark"
                    />
                    <span className="ri-input-ic">📍</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="ri-primary ri-ghost"
                onClick={getLocation}
                disabled={loadingLocation}
              >
                {loadingLocation ? "Detecting location..." : "Use GPS Location"}
              </button>

              <div className="ri-field">
                <label>Issue Location Preview</label>

                <div className="ri-mini-map-wrap">
                  <MapContainer
                    center={mapCenter}
                    zoom={16}
                    scrollWheelZoom={false}
                    className="ri-mini-map"
                    zoomAnimation={false}
                    fadeAnimation={false}
                    markerZoomAnimation={false}
                  >
                    <ChangeMapView center={mapCenter} />
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {issueLat && issueLng ? (
                      <Marker
                        position={[Number(issueLat), Number(issueLng)]}
                        icon={reportLocationIcon}
                      >
                        <Popup>
                          <b>Issue Location</b>
                          <div>{address || "Selected issue location"}</div>
                        </Popup>
                      </Marker>
                    ) : null}
                  </MapContainer>
                </div>

                <div className="ri-coords">
                  <span>
                    <b>Latitude:</b> {issueLat || "--"}
                  </span>
                  <span>
                    <b>Longitude:</b> {issueLng || "--"}
                  </span>
                </div>
              </div>

              <div className="ri-field">
                <label>
                  <FaRegStickyNote /> Additional Details *
                </label>
                <textarea
                  className="ri-textarea"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={detailsPlaceholder}
                />
              </div>

              <div className="ri-field">
                <label>Priority Level</label>
                <div className="ri-priority-row">
                  {["Low", "Medium", "High"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`ri-priority ${
                        priority === p ? "is-active" : ""
                      }`}
                      onClick={() => setPriority(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="ri-card">
            <div className="ri-card-head">
              <div className="ri-card-head-ic">
                <FaCamera />
              </div>
              <h3>Upload Photos</h3>
            </div>

            <label className="ri-upload">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (photos.length + files.length > 4) {
                    alert("You can upload maximum 4 images only.");
                    return;
                  }
                  setPhotos((prev) => [...prev, ...files]);
                }}
              />

              {photos.length === 0 ? (
                <div className="ri-upload-empty">
                  <FaCamera className="ri-cam" />
                  <div className="ri-upload-text">
                    <strong>Add photos</strong>
                    <span>Up to 4 images</span>
                  </div>
                </div>
              ) : (
                <div className="ri-preview-row">
                  {photos.map((img, index) => (
                    <div key={index} className="ri-preview">
                      <img src={URL.createObjectURL(img)} alt={`preview-${index}`} />
                      <button
                        type="button"
                        className="ri-x"
                        onClick={(ev) => {
                          ev.preventDefault();
                          setPhotos((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </label>

            <button
              type="button"
              className="ri-primary"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Report"}
              <FaChevronRight className="ri-btn-ic" />
            </button>

            <div className="ri-footer">
              EcoTrack — Making waste management smarter, cleaner.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
