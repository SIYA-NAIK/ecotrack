import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaMoneyBillWave,
  FaCheckCircle,
  FaSpinner,
  FaCreditCard,
} from "react-icons/fa";
import ResidentNavbar from "../components/ResidentNavbar";
import "./pickuppayment.css";

const API_BASE = "https://ecotrack-mqko.onrender.com";
const API = `${API_BASE}/api`;


export default function PickupPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const pickupData = location.state || {};

  const [method, setMethod] = useState(
    String(pickupData.paymentMethod || "razorpay").toLowerCase()
  );
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successStatus, setSuccessStatus] = useState("");
  const [successReference, setSuccessReference] = useState("");

  const price = useMemo(() => {
  return Number(pickupData.amount || 0);
}, [pickupData.amount]);

  const gst = useMemo(() => Math.round(price * 0.18), [price]);
  const total = useMemo(() => price + gst, [price, gst]);

  const cashReferenceId = useMemo(() => {
    return "ECO-" + Math.floor(100000 + Math.random() * 900000);
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
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

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const existingScript = document.getElementById("razorpay-checkout-js");
      if (existingScript) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

 const getRazorpayKey = () => {
  console.log("KEY:", process.env.REACT_APP_RAZORPAY_KEY_ID);

  return process.env.REACT_APP_RAZORPAY_KEY_ID || "";
};

  const savePickupToBackend = async ({
    paymentMethodValue,
    paymentStatusValue,
    paymentReferenceValue,
  }) => {
    const stored = localStorage.getItem("user");
    const user = stored ? JSON.parse(stored) : null;
    const userId = pickupData.userId || user?.id;

    if (!userId) {
      throw new Error("User not found. Please login again.");
    }

    const payload = {
  userId,
  wasteType: pickupData.wasteType || "",
  bulkyItem: pickupData.bulkyItem || "",
  pickupDate: pickupData.pickupDate || "",
  preferredTime: pickupData.preferredTime || "",
  pickupAddress: pickupData.pickupAddress || "",
  pickupLat: pickupData.pickupLat || null,
  pickupLng: pickupData.pickupLng || null,
  instructions: pickupData.instructions || "",
  paymentMethod: paymentMethodValue,
  paymentStatus: paymentStatusValue,
  paymentReference: paymentReferenceValue,

  // ✅ ADD THESE (IMPORTANT)
  amount: price,
  gst: gst,
  total: total,

  residentUpiId: null,
  municipalityUpiId: null,
};

    const res = await fetch(`${API_BASE}/api/pickups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data = {};

    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.message || text || "Failed to save pickup.");
    }

    return data;
  };

  const handleCashConfirm = async () => {
    try {
      setSubmitting(true);

      await savePickupToBackend({
        paymentMethodValue: "cash",
        paymentStatusValue: "pending_cash",
        paymentReferenceValue: cashReferenceId,
      });

      setSuccessStatus("PENDING CASH");
      setSuccessReference(cashReferenceId);
      setShowSuccess(true);
    } catch (error) {
      console.error("Cash confirmation error:", error);
      alert(error.message || "Failed to confirm cash payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      setSubmitting(true);

      const razorpayKey = getRazorpayKey();

      if (!razorpayKey) {
        throw new Error(
          "Razorpay Key ID is missing in frontend .env. Add REACT_APP_RAZORPAY_KEY_ID and restart frontend."
        );
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load.");
      }

      const createOrderRes = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          receipt: `pickup_${Date.now()}`,
          notes: {
            wasteType: pickupData.wasteType || "",
            bulkyItem: pickupData.bulkyItem || "",
            pickupDate: pickupData.pickupDate || "",
            preferredTime: pickupData.preferredTime || "",
          },
        }),
      });

      const createOrderData = await createOrderRes.json();

      if (!createOrderRes.ok || !createOrderData.success) {
        throw new Error(createOrderData.message || "Failed to create payment order.");
      }

      const order = createOrderData.order;

      const stored = localStorage.getItem("user");
      const user = stored ? JSON.parse(stored) : null;

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: "EcoTrack",
        description: "Pickup Payment",
        order_id: order.id,
        prefill: {
          name: user?.full_name || user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        notes: {
          wasteType: pickupData.wasteType || "",
          bulkyItem: pickupData.bulkyItem || "",
          pickupDate: pickupData.pickupDate || "",
          preferredTime: pickupData.preferredTime || "",
        },
        theme: {
          color: "#2f8f62",
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.message || "Payment verification failed.");
            }

            await savePickupToBackend({
              paymentMethodValue: "razorpay",
              paymentStatusValue: "paid",
              paymentReferenceValue: response.razorpay_payment_id,
            });

            setSuccessStatus("PAID");
            setSuccessReference(response.razorpay_payment_id);
            setShowSuccess(true);
          } catch (error) {
            console.error("Razorpay verification/save error:", error);
            alert(error.message || "Payment done, but pickup saving failed.");
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            console.log("Razorpay popup closed");
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error("Razorpay payment error:", error);
      alert(error.message || "Failed to start online payment.");
      setSubmitting(false);
    }
  };

  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/history");
  };

  return (
    <div className="pp-page">
      <ResidentNavbar activeTab="" />

      <div className="pp-wrapper">
        <div className="pp-left">
          <button className="pp-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
            Back
          </button>

          <div className="pp-header">
            <span className="pp-pill">EcoTrack Payment</span>
            <h1>Pickup Payment</h1>
            <p>Choose online payment or cash on pickup.</p>
          </div>

          <div className="pp-methods">
            <div
              className={`pp-method-card ${method === "razorpay" ? "active" : ""}`}
              onClick={() => setMethod("razorpay")}
            >
              <div className="pp-method-icon">
                <FaCreditCard />
              </div>

              <div className="pp-method-content">
                <h3>Pay Online</h3>
                <p>Pay instantly using UPI, card, net banking or wallet</p>
              </div>

              <input type="radio" checked={method === "razorpay"} readOnly />
            </div>

            <div
              className={`pp-method-card ${method === "cash" ? "active" : ""}`}
              onClick={() => setMethod("cash")}
            >
              <div className="pp-method-icon">
                <FaMoneyBillWave />
              </div>

              <div className="pp-method-content">
                <h3>Cash on Pickup</h3>
                <p>Pay directly to the collection staff during pickup</p>
              </div>

              <input type="radio" checked={method === "cash"} readOnly />
            </div>
          </div>

          {method === "razorpay" ? (
            <div className="pp-payment-box">
              <h2>Online Payment</h2>

              <div className="pp-cash-box">
                <p>
                  <strong>Gateway:</strong> Razorpay
                </p>
                <p>
                  <strong>Methods:</strong> UPI, Card, Netbanking, Wallet
                </p>
                <p>
                  <strong>Total Amount:</strong> ₹{total}
                </p>
                <p>
                  <strong>Status:</strong> Instant confirmation
                </p>
                <p>
                  <strong>Note:</strong> Your pickup will be saved automatically after successful payment.
                </p>
              </div>

              <button
                className="pp-primary-btn"
                onClick={handleRazorpayPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <FaSpinner className="pp-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaCreditCard />
                    Pay ₹{total} Online
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="pp-payment-box">
              <h2>Cash on Pickup</h2>

              <div className="pp-cash-box">
                <p>
                  <strong>Reference ID:</strong> {cashReferenceId}
                </p>
                <p>
                  <strong>Payment Method:</strong> Cash on Pickup
                </p>
                <p>
                  <strong>Total Amount:</strong> ₹{total}
                </p>
                <p>
                  <strong>Status:</strong> Pending until collection
                </p>
                <p>
                  <strong>Note:</strong> Please keep the amount ready during pickup.
                </p>
              </div>

              <button
                className="pp-primary-btn"
                onClick={handleCashConfirm}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <FaSpinner className="pp-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaMoneyBillWave />
                    Confirm Cash on Pickup
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="pp-right">
          <div className="pp-summary-card">
            <h2>Order Summary</h2>

            <div className="pp-summary-top">
              <div>
                <h4>Amount to be paid</h4>
                <p className="pp-green-text">
                  {method === "razorpay"
                    ? "Selected: Online Payment"
                    : "Selected: Cash on Pickup"}
                </p>
              </div>

              <div className="pp-price-edit">
                <span className="pp-price">₹{price}</span>
              </div>
            </div>

            <hr />

            <div className="pp-row">
              <span>Subtotal</span>
              <span>₹{price}</span>
            </div>

            <div className="pp-row">
              <span>GST (18%)</span>
              <span>₹{gst}</span>
            </div>

            <div className="pp-row pp-total">
              <span>Total</span>
              <span>₹{total}</span>
            </div>

            <hr />

            <div className="pp-pickup-details">
              <h3>Pickup Details</h3>

              <div className="pp-detail-item">
                <span>Waste Type</span>
                <strong>{pickupData.wasteType || "-"}</strong>
              </div>

              {pickupData.bulkyItem ? (
                <div className="pp-detail-item">
                  <span>Bulky Item</span>
                  <strong>{pickupData.bulkyItem}</strong>
                </div>
              ) : null}

              <div className="pp-detail-item">
                <span>Pickup Date</span>
                <strong>{formatDate(pickupData.pickupDate)}</strong>
              </div>

              <div className="pp-detail-item">
                <span>Time Slot</span>
                <strong>{pickupData.preferredTime || "-"}</strong>
              </div>

              <div className="pp-detail-item">
                <span>Address</span>
                <strong>{pickupData.pickupAddress || "-"}</strong>
              </div>

              <div className="pp-detail-item">
                <span>Instructions</span>
                <strong>{pickupData.instructions || "No special instructions"}</strong>
              </div>

              <div className="pp-detail-item">
                <span>Reference ID</span>
                <strong>
                  {method === "cash"
                    ? cashReferenceId
                    : "Will be generated after payment"}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSuccess && (
        <div className="pp-success-overlay">
          <div className="pp-success-modal">
            <div className="pp-success-icon">
              <FaCheckCircle />
            </div>

            <h2>
              {method === "razorpay" ? "Payment Successful" : "Pickup Confirmed"}
            </h2>

            <p>
              {method === "razorpay"
                ? "Your online payment was successful and your pickup has been saved."
                : "Your cash on pickup request has been confirmed successfully."}
            </p>

            <div className="pp-success-details">
              <div className="pp-success-row">
                <span>Reference</span>
                <strong>{successReference}</strong>
              </div>

              <div className="pp-success-row">
                <span>Amount</span>
                <strong>₹{total}</strong>
              </div>

              <div className="pp-success-row">
                <span>Status</span>
                <strong>{successStatus}</strong>
              </div>
            </div>

            <button className="pp-primary-btn" onClick={closeSuccess}>
              Go to History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}