// import { useEffect, useState } from "react";
// import "../styles/splash.css";
// import bg from "../assets/bg.png";   // background image
// import logo from "../assets/logo.png"; // logo image (can be different)

// const SplashScreen = () => {
//   const [progress, setProgress] = useState(0);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setProgress((prev) => {
//         if (prev >= 100) {
//           clearInterval(interval);
//           return 100;
//         }
//         return prev + 1;
//       });
//     }, 25); // speed of loading

//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div className="splash">
//       {/* Blurred Background */}
//       <img src={bg} alt="background" className="splash-bg" />

//       {/* Glass Card */}
//       <div className="splash-card">
//         <img src={logo} alt="EcoTrack Logo" className="splash-logo" />

//         <h1>EcoTrack</h1>
//         <p>Smart Waste Management Platform</p>

//         {/* Progress Bar */}
//         <div className="progress-box">
//           <div
//             className="progress-fill"
//             style={{ width: `${progress}%` }}
//           ></div>
//         </div>

//         <span className="progress-text">{progress}%</span>
//       </div>
//     </div>
//   );
// };

// export default SplashScreen;

import { useEffect, useState } from "react";
import "../styles/splash.css";
import bg from "../assets/bg.png";
import logo from "../assets/logo.png";

const SplashScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 🔒 LOCK SCROLL DURING SPLASH
    document.body.style.overflow = "hidden";

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);

          // 🔓 UNLOCK SCROLL WHEN DONE
          document.body.style.overflow = "auto";

          return 100;
        }
        return prev + 1;
      });
    }, 25);

    return () => {
      clearInterval(interval);
      document.body.style.overflow = "auto"; // safety unlock
    };
  }, []);

  return (
    <div className="splash">
      {/* Blurred Background */}
      <img src={bg} alt="background" className="splash-bg" />

      {/* Glass Card */}
      <div className="splash-card">
        <img src={logo} alt="EcoTrack Logo" className="splash-logo" />

        <h1>EcoTrack</h1>
        <p> Waste Management Platform</p>

        {/* Progress Bar */}
        <div className="progress-box">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <span className="progress-text">{progress}%</span>
      </div>
    </div>
  );
};

export default SplashScreen;
