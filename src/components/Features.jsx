import { useEffect, useRef, useState } from "react";
import "../styles/features.css";

/* ===== IMPORT IMAGES ===== */
import collectionImg from "../assets/features/collection.png";
import reportImg from "../assets/features/reportissue.png";
import trackingImg from "../assets/features/tracking.png";
import alertImg from "../assets/features/alert.png";
import pickupImg from "../assets/features/requestpickup.png";
import statusImg from "../assets/features/trackstatus.png";
import historyImg from "../assets/features/pasthistory.png";
import adminImg from "../assets/features/admindashboard.png";

/* ===== FEATURES DATA ===== */
const features = [
  {
    title: "Collection Schedule",
    desc: "View your area's garbage collection schedule. Never miss a pickup day again.",
    img: collectionImg,
  },
  {
    title: "Report Issues",
    desc: "Report uncollected garbage with photos and location. Track resolution status.",
    img: reportImg,
  },
  {
    title: "Live Tracking",
    desc: "Track garbage trucks in real-time. Know exactly when collection arrives.",
    img: trackingImg,
  },
  {
    title: "Smart Alerts",
    desc: "Get notifications for collection reminders and status updates.",
    img: alertImg,
  },
  {
    title: "Request Pickups",
    desc: "Request special pickups for large items or bulk waste collection.",
    img: pickupImg,
  },
  {
    title: "Track Status",
    desc: "Monitor collection status from pending to completed in real-time.",
    img: statusImg,
  },
  {
    title: "Collection History",
    desc: "Access your complete collection history and past reports.",
    img: historyImg,
  },
  {
    title: "Admin Dashboard",
    desc: "Municipal authorities can manage schedules and assign staff efficiently.",
    img: adminImg,
  },
];

const Features = () => {
  const sectionRef = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(sectionRef.current);
  }, []);

  return (
    <section
      className={`features-section ${show ? "show" : ""}`}
      id="features"
      ref={sectionRef}
    >
      {/* HEADER */}
      <div className="features-header">
        <span className="features-pill">Features</span>

        <h2>
          Everything You Need for <span>Smart Waste</span>
          <br />
          <span>Management</span>
        </h2>

        <p>
          From tracking schedules to reporting issues, EcoTrack provides all the
          tools for efficient waste management in your community.
        </p>
      </div>

      {/* GRID */}
      <div className="features-grid">
        {features.map((item, index) => (
          <div
            className="feature-card"
            key={index}
            style={{ transitionDelay: `${index * 0.1}s` }}
          >
            {/* IMAGE */}
            <div className="feature-img">
              <img src={item.img} alt={item.title} />
            </div>

            <h4>{item.title}</h4>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;