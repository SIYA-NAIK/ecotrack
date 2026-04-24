import React from "react";
import "../styles/footer.css";
import { FaFacebookF, FaTwitter, FaInstagram, FaLinkedinIn } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* BRAND */}
        <div className="footer-brand">
          <div className="brand-row">
            <div className="brand-icon">♻️</div>
            <h2>EcoTrack</h2>
          </div>

          <p>
            Making waste management smarter, cleaner, and more efficient for
            communities everywhere.
          </p>

          {/* ✅ UPDATED SOCIAL ICONS */}
          <div className="footer-social">
            <a
              href="https://www.facebook.com/"
              className="social-icon"
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
            >
              <FaFacebookF />
            </a>

            <a
              href="https://x.com/"
              className="social-icon"
              aria-label="Twitter"
              target="_blank"
              rel="noreferrer"
            >
              <FaTwitter />
            </a>

            <a
              href="https://www.instagram.com/"
              className="social-icon"
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
            >
              <FaInstagram />
            </a>

            <a
              href="https://www.linkedin.com/"
              className="social-icon"
              aria-label="LinkedIn"
              target="_blank"
              rel="noreferrer"
            >
              <FaLinkedinIn />
            </a>
          </div>
        </div>

        {/* QUICK LINKS */}
        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li>Home</li>
            <li>Schedule</li>
            <li>Report Issue</li>
            <li>Track Collection</li>
            <li>Notifications</li>
          </ul>
        </div>

        {/* RESOURCES */}
        

        {/* CONTACT */}
        <div className="footer-col">
          <h4>Contact Us</h4>
          <ul className="contact-list">
            <li>📍 GVMs College Farmagudi</li>
            <li>📞 +1 (234) 567-890</li>
            <li>✉️ help@ecotrack.com</li>
          </ul>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="footer-bottom">
        <p>© 2024 EcoTrack. All rights reserved.</p>

        <div className="footer-links">
          <span>Terms of Service</span>
          <span>Privacy Policy</span>
          <span>Cookie Policy</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
