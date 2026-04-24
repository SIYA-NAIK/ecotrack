import express from "express";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Simple “nonsense” detector
function looksGibberish(str) {
  const s = (str || "").trim();
  if (s.length < 8) return true;

  // too many consonants in a row like "bjkdkjgeg"
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(s.replace(/\s/g, ""))) return true;

  // repeated same char
  if (/(.)\1{5,}/.test(s)) return true;

  return false;
}

function validateAddress({ street, city, state, pincode, country }) {
  let score = 100;
  const reasons = [];

  const streetOk = street && street.trim().length >= 10 && !looksGibberish(street);
  if (!streetOk) { score -= 40; reasons.push("Street address looks invalid or too short."); }

  const cityOk = city && city.trim().length >= 2 && !looksGibberish(city);
  if (!cityOk) { score -= 20; reasons.push("City looks invalid."); }

  const stateOk = state && state.trim().length >= 2 && !looksGibberish(state);
  if (!stateOk) { score -= 15; reasons.push("State looks invalid."); }

  // India pincode = 6 digits
  const pinOk = /^[1-9]\d{5}$/.test((pincode || "").trim());
  if (!pinOk) { score -= 25; reasons.push("Pincode must be a valid 6-digit Indian pincode."); }

  const countryOk = (country || "").toLowerCase() === "india";
  if (!countryOk) { score -= 10; reasons.push("Country must be India."); }

  const valid = score >= 70 && streetOk && pinOk && cityOk && stateOk;

  return { valid, score: Math.max(0, score), reasons };
}

router.post("/verify-address", upload.single("idProof"), (req, res) => {
  const { street, city, state, pincode, country } = req.body;

  // Optional: require file
  // if (!req.file) return res.status(400).json({ valid:false, score:0, message:"ID proof is required." });

  const result = validateAddress({ street, city, state, pincode, country });

  if (!result.valid) {
    return res.status(400).json({
      valid: false,
      score: result.score,
      message: result.reasons[0] || "Address invalid.",
      reasons: result.reasons,
    });
  }

  return res.json({
    valid: true,
    score: result.score,
    message: "Address verified successfully.",
  });
});

export default router;