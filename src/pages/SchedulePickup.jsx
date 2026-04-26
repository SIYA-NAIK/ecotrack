import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "./schedulepickup.css";
import "../styles/styles.css";
import ResidentNavbar from "../components/ResidentNavbar";
import TrackingMiniMap from "../components/TrackingMiniMap";
import { useResidentData } from "../context/ResidentDataContext";
import {
  FaCube,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaRegStickyNote,
  FaChevronRight,
  FaCheckCircle,
  FaBolt,
  FaExclamationTriangle,
  FaWineBottle,
  FaMoneyBillWave,
  FaMobileAlt,
} from "react-icons/fa";

const DEFAULT_MAP_CENTER = [15.3991, 74.0124];

const userLocationIcon = new L.DivIcon({
  className: "spMiniPin spMiniPinUser",
  html: `<div class="spMiniPinInner">📍</div>`,
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

export default function SchedulePickup() {
  const navigate = useNavigate();
  const { userId, upcomingPickups } = useResidentData();

  const types = useMemo(
    () => [
      {
        label: "Bulky Items",
        icon: <FaCube />,
        fee: 0,
        note: "Furniture, mattresses, large boxes",
      },
      {
        label: "E-Waste",
        icon: <FaBolt />,
        fee: 300,
        note: "Old electronics, chargers, batteries",
      },
      {
        label: "Hazardous Waste",
        icon: <FaExclamationTriangle />,
        fee: 400,
        note: "Chemicals, paint, pesticides, medical waste",
      },
      {
        label: "Glass Waste",
        icon: <FaWineBottle />,
        fee: 350,
        note: "Broken bottles, glass jars, window glass pieces",
      },
    ],
    []
  );

  const timeSlots = useMemo(
    () => [
      {
        label: "08:00 AM - 10:00 AM",
        start: "08:00",
        cutoffLabel: "07:30 AM",
      },
      {
        label: "10:00 AM - 12:00 PM",
        start: "10:00",
        cutoffLabel: "09:30 AM",
      },
      {
        label: "12:00 PM - 02:00 PM",
        start: "12:00",
        cutoffLabel: "11:30 AM",
      },
      {
        label: "02:00 PM - 04:00 PM",
        start: "14:00",
        cutoffLabel: "01:30 PM",
      },
      {
        label: "04:00 PM - 06:00 PM",
        start: "16:00",
        cutoffLabel: "03:30 PM",
      },
      {
        label: "06:00 PM - 08:00 PM",
        start: "18:00",
        cutoffLabel: "05:30 PM",
      },
    ],
    []
  );

  const bulkyItems = useMemo(
    () => [
      { label: "Sofa", fee: 1 },
      { label: "Bed", fee: 900 },
      { label: "Mattress", fee: 500 },
      { label: "Table", fee: 600 },
      { label: "Chair", fee: 300 },
      { label: "Cupboard", fee: 1000 },
      { label: "Large Box", fee: 400 },
    ],
    []
  );

  const [activeType, setActiveType] = useState(types[0].label);
  const [pickupDate, setPickupDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [bulkyItem, setBulkyItem] = useState("");
  const [otherBulkyItem, setOtherBulkyItem] = useState("");
  const [otherBulkyPrice, setOtherBulkyPrice] = useState("");
  const [shownNoSlotsPopup, setShownNoSlotsPopup] = useState(false);

  const formatInputDate = (date) => date.toISOString().split("T")[0];
  const todayDate = formatInputDate(new Date());
  const minDate = todayDate;

  const selectedBulkyItemDetails = useMemo(() => {
    return bulkyItems.find((item) => item.label === bulkyItem) || null;
  }, [bulkyItem, bulkyItems]);

  const amount = useMemo(() => {
    if (activeType === "Bulky Items") {
      if (bulkyItem === "Other") {
        return Number(otherBulkyPrice) || 0;
      }
      return selectedBulkyItemDetails?.fee ?? 0;
    }

    const selected = types.find((t) => t.label === activeType);
    return selected?.fee ?? 0;
  }, [activeType, bulkyItem, otherBulkyPrice, selectedBulkyItemDetails, types]);

  const mapCenter = useMemo(() => {
    if (pickupLat && pickupLng) {
      return [Number(pickupLat), Number(pickupLng)];
    }
    return DEFAULT_MAP_CENTER;
  }, [pickupLat, pickupLng]);

  const selectedTimeSlot = useMemo(() => {
    return timeSlots.find((slot) => slot.label === preferredTime) || null;
  }, [preferredTime, timeSlots]);

  const isSameDay = (date1, date2) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const getAvailableTimeSlots = useCallback(
    (selectedDate) => {
      if (!selectedDate) return [];

      const now = new Date();
      const selected = new Date(selectedDate);

      if (!isSameDay(selected, now)) {
        return timeSlots;
      }

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return timeSlots.filter((slot) => {
        const [startHours, startMinutes] = slot.start.split(":").map(Number);
        const slotStartMinutes = startHours * 60 + startMinutes;
        const bookingCutoffMinutes = slotStartMinutes - 30;

        return currentMinutes < bookingCutoffMinutes;
      });
    },
    [timeSlots]
  );

  const noSlotsAvailable =
    pickupDate === todayDate && getAvailableTimeSlots(pickupDate).length === 0;

  useEffect(() => {
    if (!pickupDate) {
      setPickupDate(todayDate);
    }
  }, [pickupDate, todayDate]);

  useEffect(() => {
    const availableSlots = getAvailableTimeSlots(pickupDate);
    const stillValid = availableSlots.some(
      (slot) => slot.label === preferredTime
    );

    if (preferredTime && !stillValid) {
      setPreferredTime("");
    }
  }, [pickupDate, preferredTime, getAvailableTimeSlots]);

  useEffect(() => {
    if (activeType !== "Bulky Items") {
      setBulkyItem("");
      setOtherBulkyItem("");
      setOtherBulkyPrice("");
    }
  }, [activeType]);

  useEffect(() => {
    if (bulkyItem !== "Other") {
      setOtherBulkyItem("");
      setOtherBulkyPrice("");
    }
  }, [bulkyItem]);

  useEffect(() => {
    if (noSlotsAvailable && !shownNoSlotsPopup) {
      alert("Book your pickup tomorrow.");
      setShownNoSlotsPopup(true);
    }

    if (!noSlotsAvailable && shownNoSlotsPopup) {
      setShownNoSlotsPopup(false);
    }
  }, [noSlotsAvailable, shownNoSlotsPopup]);

  const validate = () => {
    if (!activeType) return "Please select waste type.";

    if (activeType === "Bulky Items" && !bulkyItem) {
      return "Please select bulky item.";
    }

    if (
      activeType === "Bulky Items" &&
      bulkyItem === "Other" &&
      !otherBulkyItem.trim()
    ) {
      return "Please enter the specific bulky item.";
    }

    if (
      activeType === "Bulky Items" &&
      bulkyItem === "Other" &&
      (!otherBulkyPrice || Number(otherBulkyPrice) <= 0)
    ) {
      return "Please enter a valid price for the specific bulky item.";
    }

    if (!pickupDate) return "Please select pickup date.";
    if (!preferredTime) return "Please select preferred time slot.";
    if (!pickupAddress.trim()) return "Please enter pickup address.";
    if (!paymentMethod) return "Please select payment method.";

    const availableSlots = getAvailableTimeSlots(pickupDate);
    const isValidSlot = availableSlots.some(
      (slot) => slot.label === preferredTime
    );

    if (!isValidSlot) {
      return "Selected time slot is no longer available. Please choose another slot.";
    }

    return null;
  };

  const getIcon = (type) => {
    if (type === "Bulky Items") return <FaCube />;
    if (type === "E-Waste") return <FaBolt />;
    if (type === "Hazardous Waste") return <FaExclamationTriangle />;
    if (type === "Glass Waste") return <FaWineBottle />;
    return <FaCube />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      setPickupAddress(data.display_name || `Lat: ${lat}, Lng: ${lng}`);
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      setPickupAddress(`Lat: ${lat}, Lng: ${lng}`);
    }
  };

  const getGpsAddress = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported on this device.");
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setPickupLat(lat.toFixed(7));
        setPickupLng(lng.toFixed(7));

        await reverseGeocode(lat, lng);
        setLoadingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Location permission denied or unavailable.");
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15001,
      }
    );
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      alert("⚠ " + validationError);
      return;
    }

    try {
      setSubmitting(true);

      if (!userId) {
        alert("User not found. Please login again.");
        return;
      }

      const resolvedBulkyItem =
        activeType === "Bulky Items"
          ? bulkyItem === "Other"
            ? otherBulkyItem.trim()
            : bulkyItem
          : "";

      navigate("/pickup-payment", {
        state: {
          userId,
          wasteType: activeType,
          bulkyItem: resolvedBulkyItem,
          pickupDate,
          preferredTime,
          pickupAddress,
          pickupLat,
          pickupLng,
          instructions,
          paymentMethod,
          amount,
        },
      });
    } catch (err) {
      console.error("Navigation error:", err);
      alert("Unable to continue to payment page.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sp-page">
      <ResidentNavbar activeTab="" />

      <header className="sp-hero">
        <div className="sp-hero-top">
          <span className="sp-pill">
            <span className="sp-pill-dot" />
            Waste Management System
          </span>
        </div>

        <h1 className="sp-title">Schedule Your Pickup</h1>
        <p className="sp-subtitle">
          Special pickups require a small service fee — payable by UPI or cash
          on pickup.
        </p>
      </header>

      <main className="sp-main">
        <h2 className="sp-section-title">Select Waste Type</h2>

        <div className="sp-type-grid">
          {types.map((type) => (
            <button
              key={type.label}
              type="button"
              className={`sp-type-card ${
                activeType === type.label ? "is-active" : ""
              }`}
              onClick={() => setActiveType(type.label)}
              title={type.note}
            >
              <span className="sp-type-icon">{type.icon}</span>
              <span className="sp-type-label">{type.label}</span>
              <span className="sp-type-fee">
                {type.label === "Bulky Items"
                  ? bulkyItem
                    ? `Fee: ₹${amount}`
                    : "Fee: Select item"
                  : `Fee: ₹${type.fee}`}
              </span>
            </button>
          ))}
        </div>

        <section className="sp-two-col">
          <div className="sp-card sp-form-card">
            <div className="sp-card-head">
              <span className="sp-card-head-ic">
                <FaCalendarAlt />
              </span>
              <h3>Schedule Details</h3>
            </div>

            <div className="sp-form">
              {activeType === "Bulky Items" && (
                <div className="sp-field">
                  <label>Select Bulky Item</label>

                  <div className="sp-input">
                    <select
                      value={bulkyItem}
                      onChange={(e) => setBulkyItem(e.target.value)}
                    >
                      <option value="">Select bulky item</option>
                      {bulkyItems.map((item) => (
                        <option key={item.label} value={item.label}>
                          {"fee" in item
                            ? `${item.label} - ₹${item.fee}`
                            : item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {bulkyItem && bulkyItem !== "Other" && selectedBulkyItemDetails && (
                    <div className="sp-alert sp-alert-warn">
                      Selected item fee: <b>₹{selectedBulkyItemDetails.fee}</b>
                    </div>
                  )}

                  {bulkyItem === "Other" && (
                    <>
                      <div className="sp-input sp-mt-8">
                        <input
                          type="text"
                          placeholder="Enter specific bulky item"
                          value={otherBulkyItem}
                          onChange={(e) => setOtherBulkyItem(e.target.value)}
                        />
                      </div>

                      <div className="sp-input sp-mt-8">
                        <input
                          type="number"
                          placeholder="Enter price for this item"
                          value={otherBulkyPrice}
                          onChange={(e) => setOtherBulkyPrice(e.target.value)}
                          min="1"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="sp-row">
                <div className="sp-field">
                  <label>Pickup Date</label>
                  <div className="sp-input">
                    <input
                      type="date"
                      value={pickupDate}
                      min={minDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sp-field">
                  <label>Preferred Time</label>
                  <div className="sp-input">
                    <select
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      disabled={noSlotsAvailable}
                    >
                      <option value="">Select time slot</option>
                      {getAvailableTimeSlots(pickupDate).map((slot) => (
                        <option key={slot.label} value={slot.label}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedTimeSlot &&
                getAvailableTimeSlots(pickupDate).some(
                  (slot) => slot.label === selectedTimeSlot.label
                ) && (
                  <div className="sp-alert sp-alert-warn">
                    You can only book this pickup before{" "}
                    <b>{selectedTimeSlot.cutoffLabel}</b>.
                  </div>
                )}

              {noSlotsAvailable && (
                <div className="sp-alert sp-alert-warn">
                  Book your pickup tomorrow.
                </div>
              )}

              <div className="sp-field">
                <label>Pickup Address</label>
                <div className="sp-input">
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Enter your address"
                  />
                  <span className="sp-input-ic">
                    <FaMapMarkerAlt />
                  </span>
                </div>

                <button
                  type="button"
                  className="sp-gps-btn"
                  onClick={getGpsAddress}
                  disabled={loadingLocation}
                >
                  <FaMapMarkerAlt />
                  {loadingLocation
                    ? "Detecting location..."
                    : "Use Current Location"}
                </button>

                <div className="sp-coords">
                  <span>
                    <b>Latitude:</b> {pickupLat || "--"}
                  </span>
                  <span>
                    <b>Longitude:</b> {pickupLng || "--"}
                  </span>
                </div>
              </div>

              <div className="sp-field">
                <label>Pickup Location Preview</label>

                <div className="sp-mini-map-wrap">
                  <MapContainer
                    center={mapCenter}
                    zoom={16}
                    scrollWheelZoom={false}
                    className="sp-mini-map"
                    zoomAnimation={false}
                    fadeAnimation={false}
                    markerZoomAnimation={false}
                  >
                    <ChangeMapView center={mapCenter} />
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {pickupLat && pickupLng ? (
                      <Marker
                        position={[Number(pickupLat), Number(pickupLng)]}
                        icon={userLocationIcon}
                      >
                        <Popup>
                          <b>Pickup Point</b>
                          <div>{pickupAddress || "Selected address"}</div>
                        </Popup>
                      </Marker>
                    ) : null}
                  </MapContainer>
                </div>

                <div className="sp-map-hint">
                  Current-location coordinates are optional, but they enable more
                  accurate truck assignment and live tracking.
                </div>
              </div>

              <div className="sp-field">
                <label>Special Instructions (optional)</label>
                <div className="sp-input">
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Ring the doorbell once"
                  />
                  <span className="sp-input-ic">
                    <FaRegStickyNote />
                  </span>
                </div>
              </div>

              <div className="sp-field">
                <label>Payment Method</label>

                <div className="sp-payment-options">
                  <label
                    className={`sp-payment-card ${
                      paymentMethod === "cash" ? "active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === "cash"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="sp-payment-icon">
                      <FaMoneyBillWave />
                    </span>
                    <span>Cash on Pickup</span>
                  </label>

                  <label
                    className={`sp-payment-card ${
                      paymentMethod === "upi" ? "active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={paymentMethod === "upi"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="sp-payment-icon">
                      <FaMobileAlt />
                    </span>
                    <span>UPI Payment</span>
                  </label>
                </div>
              </div>

              <div className="sp-fee-box">
                <div className="sp-fee-top">
                  <div className="sp-fee-title">Service Fee</div>
                  <div className="sp-fee-amount">{`₹${amount}`}</div>
                </div>

                <div className="sp-fee-text">
                  Payment Method:{" "}
                  <b>
                    {paymentMethod === "upi" ? "UPI Payment" : "Cash on Pickup"}
                  </b>
                </div>

                <div className="sp-fee-status">
                  Status:{" "}
                  <b className="sp-status-confirmed">READY FOR PAYMENT</b>
                </div>
              </div>

              <button
                className="sp-primary"
                type="button"
                onClick={handleSubmit}
                disabled={submitting || noSlotsAvailable}
              >
                <FaCheckCircle className="sp-btn-ic" />
                {submitting ? "Processing..." : "Continue to Payment"}
              </button>
            </div>
          </div>

          <div className="sp-right-col">
            <div className="sp-card sp-tracker-card">
              <div className="sp-card-head">
                <span className="sp-card-head-ic">
                  <FaMapMarkerAlt />
                </span>
                <h3>Live Tracking</h3>
              </div>

              <div className="sp-tracker-wrap">
                <TrackingMiniMap />
              </div>
            </div>

            <div className="sp-card sp-upcoming">
              <div className="sp-card-head">
                <span className="sp-card-head-ic">
                  <FaClock />
                </span>
                <h3>Upcoming Pickups</h3>
              </div>

              <div className="sp-up-list">
                {upcomingPickups.length === 0 ? (
                  <div className="sp-empty-state">No upcoming pickups yet</div>
                ) : (
                  upcomingPickups.map((pickup) => (
                    <div className="sp-up-item" key={pickup.id}>
                      <span className="sp-up-badge">
                        {getIcon(pickup.waste_type)}
                      </span>

                      <div className="sp-up-text">
                        <div className="sp-up-title">
                          {pickup.waste_type === "Bulky Items"
                            ? `Bulky Items (${
                                pickup.bulky_item || pickup.bulkyItem || "Item"
                              })`
                            : pickup.waste_type}
                        </div>

                        <div className="sp-up-sub">
                          {formatDate(pickup.pickup_date)} •{" "}
                          {pickup.preferred_time}
                        </div>

                        {pickup.payment_method && (
                          <div className="sp-up-sub">
                            Payment:{" "}
                            {pickup.payment_method === "upi"
                              ? "UPI Payment"
                              : "Cash on Pickup"}
                          </div>
                        )}
                      </div>

                      <FaChevronRight className="sp-up-arrow" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="sp-footer">
          © 2026 EcoTrack • Waste Management System
        </footer>
      </main>
    </div>
  );
}