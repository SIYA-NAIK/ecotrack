import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useResidentData } from "../context/ResidentDataContext";

const API_BASE = "http://localhost:5000";
const REFRESH_MS = 3000;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const truckIcon = new L.DivIcon({
  className: "trkPin trkPinTruck",
  html: `<div class="trkPinInner">🚚</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const homeIcon = new L.DivIcon({
  className: "trkPin trkPinHome",
  html: `<div class="trkPinInner">🏠</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length < 2) return;
    if (!map?._container?.isConnected) return;
    map.fitBounds(L.latLngBounds(points), {
      padding: [30, 30],
      animate: false,
    });
  }, [points, map]);

  return null;
}

export default function TrackingMiniMap() {
  const { userId } = useResidentData();
  const truckId = "ECO-001";

  const [live, setLive] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  const [err, setErr] = useState("");
  const loadLiveRef = React.useRef(async () => {});

  async function getJson(url) {
    const r = await fetch(url);
    const text = await r.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!r.ok) {
      throw new Error(data?.message || `Request failed ${r.status}`);
    }

    return data;
  }

  loadLiveRef.current = async () => {
    if (!userId) return;

    try {
      setErr("");
      const data = await getJson(
        `${API_BASE}/resident/live?userId=${encodeURIComponent(
          userId
        )}&truckId=${encodeURIComponent(truckId)}`
      );
      setLive(data);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  };

  useEffect(() => {
    if (!userId) return;

    loadLiveRef.current();
    const timer = setInterval(() => loadLiveRef.current(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [userId]);

  const truckLat = live?.truck?.lat;
  const truckLng = live?.truck?.lng;
  const homeLat = live?.home?.lat;
  const homeLng = live?.home?.lng;

  useEffect(() => {
    async function loadRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${Number(
          truckLng
        )},${Number(truckLat)};${Number(homeLng)},${Number(
          homeLat
        )}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        const coords = data?.routes?.[0]?.geometry?.coordinates || [];
        if (!coords.length) {
          setRouteLine([
            [Number(truckLat), Number(truckLng)],
            [Number(homeLat), Number(homeLng)],
          ]);
          return;
        }

        setRouteLine(coords.map(([lng, lat]) => [lat, lng]));
      } catch {
        setRouteLine([
          [Number(truckLat), Number(truckLng)],
          [Number(homeLat), Number(homeLng)],
        ]);
      }
    }

    if (!truckLat || !truckLng || !homeLat || !homeLng) {
      setRouteLine([]);
      return;
    }

    loadRoute();
  }, [truckLat, truckLng, homeLat, homeLng]);

  const center = useMemo(() => {
    const t = live?.truck;
    const h = live?.home;

    if (t?.lat && t?.lng) return [Number(t.lat), Number(t.lng)];
    if (h?.lat && h?.lng) return [Number(h.lat), Number(h.lng)];

    return [15.3991, 74.0124];
  }, [live]);

  const isDailyTracker = live?.tracking_mode === "daily";
  const hasHomeCoords = Boolean(live?.home?.lat && live?.home?.lng);
  const bannerText =
    isDailyTracker && !hasHomeCoords
      ? `${live?.home?.area || live?.truck?.zone || "Area"} pickup live`
      : null;

  return (
    <div className="tracking-mini-shell">
      <MapContainer
        center={center}
        zoom={13}
        zoomControl={false}
        scrollWheelZoom={false}
        className="tracking-mini-map"
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
      >
        <ZoomControl position="bottomleft" />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {routeLine.length > 1 && <FitBounds points={routeLine} />}

        {routeLine.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{ dashArray: "8 8", weight: 3, opacity: 0.85 }}
          />
        )}

        {live?.home?.lat && live?.home?.lng && (
          <Marker
            position={[Number(live.home.lat), Number(live.home.lng)]}
            icon={homeIcon}
          >
            <Popup>
              <b>{isDailyTracker ? "Pickup Area" : "Pickup Location"}</b>
              <div>{live?.home?.address || "Scheduled pickup"}</div>
            </Popup>
          </Marker>
        )}

        {live?.truck?.lat && live?.truck?.lng && (
          <Marker
            position={[Number(live.truck.lat), Number(live.truck.lng)]}
            icon={truckIcon}
          >
            <Popup>
              <b>{live?.truck?.truck_id || "Truck"}</b>
              <div>Driver: {live?.truck?.driver_name || "--"}</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {bannerText ? (
        <div className="tracking-mini-banner">{bannerText}</div>
      ) : null}

      {err ? <div className="tracking-mini-error">{err}</div> : null}
    </div>
  );
}
