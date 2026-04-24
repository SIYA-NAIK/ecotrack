import { useEffect, useRef, useState } from "react";
import "../styles/howitworks.css";
import {
  FaUserPlus,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";

const steps = [
  {
    title: "Create Account",
    desc: "Sign up with your email and add your location to get started.",
    icon: <FaUserPlus />,
  },
  {
    title: "Find Your Schedule",
    desc: "View the garbage collection schedule for your specific area.",
    icon: <FaCalendarAlt />,
  },
  {
    title: "Report Issues",
    desc: "Snap a photo and report any uncollected waste or problems.",
    icon: <FaExclamationTriangle />,
  },
  {
    title: "Track Resolution",
    desc: "Monitor the status until your issue is resolved.",
    icon: <FaCheckCircle />,
  },
];

const HowItWorks = () => {
  const sectionRef = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShow(true),
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`how-section ${show ? "show" : ""}`}
      id="how"
      ref={sectionRef}
    >
      {/* HEADER */}
      <div className="how-header">
        <span className="how-pill">How It Works</span>

        <h2>
          Simple Steps to a <span>Cleaner Community</span>
        </h2>

        <p>
          Getting started with EcoTrack is easy. Follow these simple steps to
          help keep your neighborhood clean.
        </p>
      </div>

      {/* STEPS */}
      <div className="how-steps">
        {steps.map((step, index) => (
          <div className="how-card" key={index}>
            <div className="step-number">0{index + 1}</div>

            {/* ✅ ICON BOX */}
            <div className="step-icon">
              <div className="step-icon-inner">
                {step.icon}
              </div>
            </div>

            <h4>{step.title}</h4>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;