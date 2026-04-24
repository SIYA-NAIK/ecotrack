// // import "../styles/navbar.css";



// // const Navbar = () => {
// //   return (
// //     <nav className="navbar">
// //       <h2 className="logo">EcoTrack</h2>

// //       <ul className="nav-links">
// //         <li>Home</li>
// //         <li>Features</li>
// //         <li>How it Works</li>
// //         <li>Contact</li>
// //       </ul>

// //       <button className="nav-btn">Get Started</button>
// //     </nav>
// //   );
// // };

// // export default Navbar;

// import "../styles/navbar.css";

// const Navbar = ({ darkMode, setDarkMode }) => {
//   const scrollTo = (id) => {
//     document.getElementById(id).scrollIntoView({ behavior: "smooth" });
//   };

//   return (
//     <nav className="navbar">
//       <h2 className="logo" onClick={() => scrollTo("home")}>
//         EcoTrack
//       </h2>

//       <ul className="nav-links">
//         <li onClick={() => scrollTo("home")}>Home</li>
//         <li onClick={() => scrollTo("features")}>Features</li>
//         <li onClick={() => scrollTo("how")}>How it Works</li>
        
//       </ul>

//       <div className="nav-actions">
//         <button
//           className={`theme-toggle ${darkMode ? "active" : ""}`}
//           onClick={() => setDarkMode(!darkMode)}
//           aria-label="Toggle dark mode"
//         >
//           <span className="toggle-thumb" />
//         </button>

//         <button className="nav-btn">Get Started</button>
//       </div>
//     </nav>
//   );
// };

// export default Navbar;


import { useNavigate } from "react-router-dom";
import "../styles/navbar.css";

const Navbar = ({ darkMode, setDarkMode }) => {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      {/* LOGO */}
      <div className="nav-left" onClick={() => navigate("/")}>
        <h2>EcoTrack</h2>
      </div>

      {/* LINKS */}
      <ul className="nav-center">
        <li onClick={() => navigate("/")}>Home</li>
        <li onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
          Features
        </li>
        <li onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
          How it Works
        </li>
      </ul>

      {/* ACTIONS */}
      <div className="nav-right">
        {/* DARK MODE TOGGLE */}
        

        {/* 🔥 GET STARTED → SIGNUP */}
        <button
          className="get-started"
          onClick={() => navigate("/signup")}
        >
          Get Started
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
