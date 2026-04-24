import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { ResidentDataProvider } from "./context/ResidentDataContext.jsx";
import "./styles/global.css";
import "leaflet/dist/leaflet.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ResidentDataProvider>
    <App />
  </ResidentDataProvider>
);


