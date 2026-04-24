const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");

const fetch = (...args) =>
  import("node-fetch").then(({ default: nodeFetch }) => nodeFetch(...args));

module.exports = (db) => {
  const router = express.Router();

  const hasMailConfig = Boolean(
    process.env.EMAIL_USER && process.env.EMAIL_PASS
  );

  const transporter = hasMailConfig
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;

  const isValidPin = (pin) => /^[1-9]\d{5}$/.test((pin || "").trim());

  function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function upsertResidentVerification({
    userId,
    street,
    apt,
    city,
    state,
    pincode,
    country,
    otpHash,
    expires,
    verifiedState,
    verifiedDistrict,
    verifiedPostoffice,
  }) {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT id FROM residents WHERE user_id=? LIMIT 1",
        [userId],
        (findErr, rows) => {
          if (findErr) {
            reject(findErr);
            return;
          }

          const params = [
            street || null,
            apt || null,
            city || null,
            state || null,
            pincode || null,
            country || "India",
            otpHash,
            expires,
            pincode || null,
            verifiedState || null,
            verifiedDistrict || null,
            verifiedPostoffice || null,
            userId,
          ];

          if (rows?.length) {
            db.query(
              `UPDATE residents
               SET street=?,
                   apt=?,
                   city=?,
                   state_name=?,
                   pincode=?,
                   country=?,
                   otp_hash=?,
                   otp_expires_at=?,
                   verified_pincode=?,
                   verified_state=?,
                   verified_district=?,
                   verified_postoffice=?,
                   address_verified=0,
                   verified_at=NULL
               WHERE user_id=?`,
              params,
              (updateErr, result) => {
                if (updateErr) reject(updateErr);
                else resolve(result);
              }
            );
            return;
          }

          db.query(
            `INSERT INTO residents
              (
                user_id,
                street,
                apt,
                city,
                state_name,
                pincode,
                country,
                otp_hash,
                otp_expires_at,
                verified_pincode,
                verified_state,
                verified_district,
                verified_postoffice,
                address_verified
              )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              userId,
              street || null,
              apt || null,
              city || null,
              state || null,
              pincode || null,
              country || "India",
              otpHash,
              expires,
              pincode || null,
              verifiedState || null,
              verifiedDistrict || null,
              verifiedPostoffice || null,
            ],
            (insertErr, result) => {
              if (insertErr) reject(insertErr);
              else resolve(result);
            }
          );
        }
      );
    });
  }

  router.post("/address/send-otp", async (req, res) => {
    try {
      const { userId, street, apt, city, state, pincode, country, email } =
        req.body;

      console.log("SEND OTP REQ:", { userId, city, state, pincode, email });

      if (!userId || !street || !city || !state || !pincode || !email) {
        return res
          .status(400)
          .json({ ok: false, message: "All required fields must be filled." });
      }

      if (!isValidPin(pincode)) {
        return res
          .status(400)
          .json({ ok: false, message: "Invalid pincode format." });
      }

      let verifiedState = "";
      let verifiedDistrict = "";
      let verifiedPostoffice = "";
      let postalWarning = "";

      try {
        const url = `https://api.postalpincode.in/pincode/${pincode}`;
        const r = await fetch(url);
        const data = await r.json();

        if (Array.isArray(data) && data[0]?.Status === "Success") {
          const offices = data[0]?.PostOffice || [];
          verifiedState = offices[0]?.State || "";
          verifiedDistrict = offices[0]?.District || "";
          verifiedPostoffice = offices[0]?.Name || "";

          if (
            verifiedState &&
            verifiedState.toLowerCase() !== String(state).trim().toLowerCase()
          ) {
            return res.status(400).json({
              ok: false,
              message: `State mismatch. This pincode belongs to ${verifiedState}.`,
              verifiedState,
              verifiedDistrict,
              verifiedPostoffice,
            });
          }
        } else {
          postalWarning =
            "Postal verification service unavailable. OTP sent using pincode format check only.";
        }
      } catch (postalErr) {
        console.error("PINCODE VERIFY ERROR:", postalErr.message);
        postalWarning =
          "Postal verification service unavailable. OTP sent using pincode format check only.";
      }

      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expires = new Date(Date.now() + 5 * 60 * 1000);

      const result = await upsertResidentVerification({
        userId,
        street,
        apt,
        city,
        state,
        pincode,
        country,
        otpHash,
        expires,
        verifiedState,
        verifiedDistrict,
        verifiedPostoffice,
      });

      console.log("OTP SAVED affectedRows:", result?.affectedRows);

      if (hasMailConfig) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "EcoTrack Address Verification OTP",
            text: `Your EcoTrack OTP is: ${otp}\n\nThis OTP expires in 5 minutes.`,
          });
        } catch (mailErr) {
          console.error("EMAIL SEND ERROR:", mailErr);

          if (process.env.NODE_ENV === "production") {
            return res.status(500).json({
              ok: false,
              message:
                "OTP was generated but email delivery failed. Please try again.",
            });
          }

          return res.json({
            ok: true,
            message:
              "OTP generated. Email delivery failed, so the OTP is exposed for local development.",
            verifiedState,
            verifiedDistrict,
            verifiedPostoffice,
            postalWarning,
            deliveryMode: "development_console",
            devOtp: otp,
          });
        }
      } else {
        console.log(`DEV OTP for user ${userId}: ${otp}`);
        return res.json({
          ok: true,
          message:
            "OTP generated in local development mode. Email is not configured.",
          verifiedState,
          verifiedDistrict,
          verifiedPostoffice,
          postalWarning,
          deliveryMode: "development_console",
          devOtp: otp,
        });
      }

      return res.json({
        ok: true,
        message: "OTP sent successfully.",
        verifiedState,
        verifiedDistrict,
        verifiedPostoffice,
        postalWarning,
        deliveryMode: "email",
      });
    } catch (err) {
      console.error("SEND OTP ERROR:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Server error sending OTP." });
    }
  });

  router.post("/address/verify-otp", (req, res) => {
    const { userId, otp } = req.body;

    console.log("VERIFY OTP REQ:", { userId, otp });

    if (!userId || !otp) {
      return res.status(400).json({ ok: false, message: "UserId and OTP required." });
    }

    db.query(
      `SELECT otp_hash, otp_expires_at FROM residents WHERE user_id=? LIMIT 1`,
      [userId],
      async (err, rows) => {
        if (err) {
          console.error("VERIFY SELECT ERROR:", err);
          return res.status(500).json({ ok: false, message: "DB error" });
        }

        if (!rows.length) {
          return res.status(404).json({ ok: false, message: "Resident not found." });
        }

        const user = rows[0];

        if (!user.otp_hash || !user.otp_expires_at) {
          return res.status(400).json({ ok: false, message: "OTP not requested. Click Send OTP again." });
        }

        if (new Date(user.otp_expires_at).getTime() < Date.now()) {
          return res.status(400).json({ ok: false, message: "OTP expired. Please resend." });
        }

        const match = await bcrypt.compare(String(otp).trim(), user.otp_hash);
        if (!match) {
          return res.status(400).json({ ok: false, message: "Incorrect OTP." });
        }

        db.query(
          `UPDATE residents
           SET address_verified=1, verified_at=NOW(), otp_hash=NULL, otp_expires_at=NULL
           WHERE user_id=?`,
          [userId],
          (err2) => {
            if (err2) {
              console.error("VERIFY UPDATE ERROR:", err2);
              return res.status(500).json({ ok: false, message: "DB update failed" });
            }
            return res.json({ ok: true, message: "Address verified successfully ✅" });
          }
        );
      }
    );
  });

  return router;
};
