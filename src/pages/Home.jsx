import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";
import heroImg from "../assets/hero.png";

const Home = () => {
  const [activeBtn, setActiveBtn] = useState("");
  const navigate = useNavigate();

  const goToSignup = (btn) => {
    setActiveBtn(btn);
    navigate("/signup"); // ✅ change if your route is different
  };

  return (
    <section className="hero-section" id="home">
      <div className="hero-wrapper">
        {/* LEFT CONTENT */}
        <div className="hero-left">
          <span className="hero-tag">Smart Waste Management Platform</span>

          <h1>
            Building a <span>Cleaner</span>
            <br />
            Tomorrow for Cities
          </h1>

          <p>
            EcoTrack helps citizens and municipalities track waste collection,
            report issues, and maintain a cleaner environment using technology.
          </p>

          <div className="hero-buttons">
            <button
              type="button"
              className={`btn-primary ${activeBtn === "schedule" ? "active" : ""}`}
              onClick={() => goToSignup("schedule")}
            >
              View Schedule
            </button>

            <button
              type="button"
              className={`btn-secondary ${activeBtn === "report" ? "active" : ""}`}
              onClick={() => goToSignup("report")}
            >
              Report Issue
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <h3>500+</h3>
              <p>Daily Collections</p>
            </div>
            <div>
              <h3>2.5K+</h3>
              <p>Issues Solved</p>
            </div>
            <div>
              <h3>150+</h3>
              <p>Areas Covered</p>
            </div>
          </div>
        </div>

        {/* RIGHT IMAGE */}
        <div className="hero-right">
          <img src={heroImg} alt="Smart City Waste Management" />
        </div>
      </div>
    </section>
  );
};

export default Home;