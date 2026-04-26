import { useEffect, useState } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
/* COMPONENTS */
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import Features from "./components/Features.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";

/* PAGES */
import Home from "./pages/Home.jsx";
import Profile from "./pages/Profile.jsx";
import ReportIssue from "./pages/reportissue";
import SchedulePickup from "./pages/SchedulePickup";
import AttendancePage from "./pages/AttendancePage";
import NotificationPage from "./pages/NotificationPage";
import History from "./pages/History";
import MyReports from "./pages/MyReports";
import PickupPayment from "./pages/PickupPayment";
import TrackingPage from "./pages/TrackingPage.jsx";
import VehicleManagement from "./pages/VehicleManagement";
import AdminUserManagement from "./pages/AdminUserManagement";

/* AUTH */
import Login from "./pages/Auth/Login.jsx";
import ForgetPassword from "./pages/Auth/ForgetPassword.jsx";
import Signup from "./pages/Auth/Signup.jsx";
import ResetPassword from "./pages/Auth/ResetPassword";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

/* ADMIN */
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLayout from "./components/AdminLayout";

const App = () => {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <SplashScreen />;

  return (
    <Router >
      <ScrollToTop />
      <Routes>

        {/* AUTH */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* RESIDENT */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/schedule-pickup" element={<SchedulePickup />} />
          <Route path="/notifications" element={<NotificationPage />} />
          <Route path="/report-issue" element={<ReportIssue />} />
          <Route path="/my-reports" element={<MyReports />} />
          <Route path="/history" element={<History />} />
          <Route path="/pickup-payment" element={<PickupPayment />} />
        </Route>

        {/* ADMIN */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin/*" element={<AdminLayout />} />
        </Route>

        <Route path="/admin/vehicles" element={<VehicleManagement />} />
        <Route path="/admin/users" element={<AdminUserManagement />} />

        {/* MAIN WEBSITE */}
        <Route
          path="/"
          element={
            <>
              <Navbar theme={theme} toggleTheme={toggleTheme} />
              <Home />
              <Features />
              <HowItWorks />
              <Footer />
            </>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;