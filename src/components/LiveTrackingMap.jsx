import React, { useEffect, useMemo, useRef, useState } from "react";
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

import "../styles/styles.css";

const API_BASE = "https://ecotrack-mqko.onrender.com";
const API = `${API_BASE}/api`;
const DEFAULT_TRUCK_ID = "ECO-001";
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
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const homeIcon = new L.DivIcon({
  className: "trkPin trkPinHome",
  html: `<div class="trkPinInner">🏠</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function safeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function etaText(n) {
  const v = safeNum(n);
  if (v == null) return "--";
  return Math.max(0, Math.round(v));
}

function kmText(n) {
  const v = safeNum(n);
  if (v == null) return "--";
  return v.toFixed(2);
}

function FitBounds({ route }) {
  const map = useMap();

  useEffect(() => {
    if (!route || route.length < 2) return;
    if (!map?._container?.isConnected) return;
    map.fitBounds(L.latLngBounds(route), {
      padding: [70, 70],
      animate: false,
    });
  }, [route, map]);

  return null;
}

function ForceResize() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!map?._container?.isConnected || !map._loaded) return;
      map.invalidateSize({ pan: false, debounceMoveend: true });
    }, 250);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export default function LiveTrackingMap() {
  const { userId } = useResidentData();
  const [truckId] = useState(DEFAULT_TRUCK_ID);

  const [live, setLive] = useState(null);
  const [stats, setStats] = useState({
    totalPickups: 0,
    ecoScore: 0,
  });
  const [roadRoute, setRoadRoute] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const timerRef = useRef(null);
  const loadLiveRef = useRef(async () => {});
  const loadStatsRef = useRef(async () => {});

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
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || e));
    }
  };

  loadStatsRef.current = async () => {
    if (!userId) return;

    try {
      const data = await getJson(
        `${API_BASE}/resident/stats?userId=${encodeURIComponent(userId)}`
      );

      setStats({
        totalPickups: Number(data?.totalPickups || 0),
        ecoScore: Number(data?.ecoScore || 0),
      });
    } catch (e) {
      console.error("Stats load failed:", e);
      setStats({
        totalPickups: 0,
        ecoScore: 0,
      });
    }
  };

  useEffect(() => {
    if (!userId) {
      setErr("User not found. Please login again.");
      setLoading(false);
      return;
    }

    loadLiveRef.current();
    loadStatsRef.current();

    timerRef.current = setInterval(() => {
      loadLiveRef.current();
      loadStatsRef.current();
    }, REFRESH_MS);

    return () => clearInterval(timerRef.current);
  }, [userId]);

  const truckLat = live?.truck?.lat;
  const truckLng = live?.truck?.lng;
  const homeLat = live?.home?.lat;
  const homeLng = live?.home?.lng;

  useEffect(() => {
    async function loadRoadRoute() {
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
          setRoadRoute([
            [Number(truckLat), Number(truckLng)],
            [Number(homeLat), Number(homeLng)],
          ]);
          return;
        }

        setRoadRoute(coords.map(([lng, lat]) => [lat, lng]));
      } catch (e) {
        console.error("Road route fetch failed:", e);
        setRoadRoute([
          [Number(truckLat), Number(truckLng)],
          [Number(homeLat), Number(homeLng)],
        ]);
      }
    }

    if (!truckLat || !truckLng || !homeLat || !homeLng) {
      setRoadRoute([]);
      return;
    }

    loadRoadRoute();
  }, [truckLat, truckLng, homeLat, homeLng]);

  const center = useMemo(() => {
    const t = live?.truck;
    const h = live?.home;

    if (t?.lat && t?.lng) return [Number(t.lat), Number(t.lng)];
    if (h?.lat && h?.lng) return [Number(h.lat), Number(h.lng)];

    return [15.3991, 74.0124];
  }, [live]);

  const progress = useMemo(() => {
    const p = safeNum(live?.progress);
    if (p != null) return Math.max(0, Math.min(100, p));
    const d = safeNum(live?.distance_km);
    if (d == null) return 0;
    return Math.max(10, Math.min(100, 100 - d * 15));
  }, [live]);

  const isDailyTracker = live?.tracking_mode === "daily";
  const hasHomeCoords = Boolean(live?.home?.lat && live?.home?.lng);
  const etaKicker =
    isDailyTracker && !hasHomeCoords ? "SERVICE ETA" : "ESTIMATED ARRIVAL";
  const progressLabel =
    isDailyTracker && !hasHomeCoords ? "Pickup window" : "Remaining distance";
  const progressValue =
    isDailyTracker && !hasHomeCoords
      ? live?.home?.window_label || live?.home?.preferred_time || "--"
      : loading
      ? "--"
      : `${kmText(live?.distance_km)} km`;
  const trackerStatus = isDailyTracker
    ? String(live?.home?.pickup_status || live?.truck?.status || "scheduled")
    : String(live?.truck?.status || "active");
  const trackerSub = isDailyTracker
    ? "Area-based live status for your regular daily collection."
    : "Latest pickup details from your schedule.";
  const trackerZoneText = isDailyTracker
    ? live?.home?.area || live?.truck?.zone || "your area"
    : live?.truck?.zone || "--";
  const pickupTimeLabel =
    live?.home?.window_label ||
    [live?.home?.preferred_time, live?.home?.end_time].filter(Boolean).join(" - ") ||
    live?.home?.preferred_time ||
    "--";

  return (
    <div className="trackingShell">
      <header className="trkTopbar">
        <div className="trkBrand">
          <div className="trkLogo">♻️</div>
          <div>
            <div className="trkTitle">EcoTrack</div>
            <div className="trkSub">
              {isDailyTracker ? "Resident Daily Pickup Tracker" : "Resident Live Tracker"}
            </div>
          </div>
        </div>

        <div className="trkActions">
          <div className={`trkLive ${err ? "warn" : "ok"}`}>
            <span className="trkDot" />
            {err ? "Offline" : "Live"}
          </div>
          <button
            className="trkBtnGhost"
            onClick={() => loadLiveRef.current()}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="trkGrid">
        <aside className="trkLeft">
          <div className="trkCard trkEtaCard">
            <div className="trkRow trkBetween">
              <div>
                <div className="trkKicker">{etaKicker}</div>
                <div className="trkEta">
                  {loading ? "--" : etaText(live?.eta_min)}
                  <span className="trkEtaUnit"> mins</span>
                </div>
              </div>
              <div className="trkChip">⏱</div>
            </div>

            <div className="trkMutedLine">
              <span className="trkPulse" />
              {isDailyTracker
                ? `Serving ${trackerZoneText}`
                : live?.truck?.zone
                ? `Currently at ${live.truck.zone}`
                : "Route active"}
            </div>

            <div className="trkBarWrap">
              <div className="trkBarTop">
                <span>{progressLabel}</span>
                <b>{progressValue}</b>
              </div>
              <div className="trkBar">
                <div className="trkBarFill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="trkMetaGrid">
              <div className="trkMetaItem">
                <span>Truck</span>
                <b>{live?.truck?.truck_id || truckId}</b>
              </div>
              <div className="trkMetaItem">
                <span>Driver</span>
                <b>{live?.truck?.driver_name || "--"}</b>
              </div>
              <div className="trkMetaItem">
                <span>{isDailyTracker ? "Service" : "Status"}</span>
                <b>{trackerStatus}</b>
              </div>
              <div className="trkMetaItem">
                <span>Speed</span>
                <b>{Number(live?.truck?.speed || 0)} km/h</b>
              </div>
            </div>

            {err ? <div className="trkError">⚠️ {err}</div> : null}
          </div>
        </aside>

        <main className="trkMapCard">
          <MapContainer
            center={center}
            zoom={12}
            zoomControl={false}
            className="trkMap"
            zoomAnimation={false}
            fadeAnimation={false}
            markerZoomAnimation={false}
          >
            <ForceResize />
            <ZoomControl position="bottomleft" />

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {roadRoute.length > 1 && <FitBounds route={roadRoute} />}

            {roadRoute.length > 1 ? (
              <Polyline
                positions={roadRoute}
                pathOptions={{ dashArray: "10 10", weight: 4, opacity: 0.9 }}
              />
            ) : null}

            {live?.home?.lat && live?.home?.lng ? (
              <Marker
                position={[Number(live.home.lat), Number(live.home.lng)]}
                icon={homeIcon}
              >
                <Popup>
                  <b>Pickup Location</b>
                  <div>{live?.home?.address || "Scheduled pickup"}</div>
                  <div>Date: {live?.home?.pickup_date || "--"}</div>
                  <div>Time: {pickupTimeLabel}</div>
                  <div>Waste Type: {live?.home?.waste_type || "--"}</div>
                </Popup>
              </Marker>
            ) : null}

            {live?.truck?.lat && live?.truck?.lng ? (
              <Marker
                position={[Number(live.truck.lat), Number(live.truck.lng)]}
                icon={truckIcon}
              >
                <Popup>
                  <b>{live?.truck?.truck_id || truckId}</b>
                  <div>Driver: {live?.truck?.driver_name || "--"}</div>
                  <div>Zone: {live?.truck?.zone || "--"}</div>
                  <div>Status: {live?.truck?.status || "--"}</div>
                  <div>Speed: {Number(live?.truck?.speed || 0)} km/h</div>
                </Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </main>

        <aside className="trkRight">
          <div className="trkCard trkHistoryCard">
            <div className="trkHistoryHeader">
              <div>
                <div className="trkHistoryTitle">
                  {isDailyTracker ? "Today’s Area Pickup" : "Scheduled Pickup"}
                </div>
                <div className="trkHistorySub">{trackerSub}</div>
              </div>
            </div>

            <div className="trkEmpty">
              <div>
                <b>{isDailyTracker ? "Address / Area:" : "Address:"}</b>{" "}
                {live?.home?.address || "--"}
              </div>
              {isDailyTracker ? (
                <div style={{ marginTop: 8 }}>
                  <b>Area:</b> {live?.home?.area || live?.truck?.zone || "--"}
                </div>
              ) : null}
              <div style={{ marginTop: 8 }}>
                <b>Date:</b> {live?.home?.pickup_date || "--"}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>{isDailyTracker ? "Window:" : "Time:"}</b> {pickupTimeLabel}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>Waste Type:</b> {live?.home?.waste_type || "--"}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>Assigned Truck:</b>{" "}
                {live?.home?.assigned_truck_id || live?.truck?.truck_id || "--"}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>Pickup Status:</b> {live?.home?.pickup_status || "--"}
              </div>
            </div>

            <div className="trkMiniRow">
              <div className="trkMiniCard">
                <div className="trkMiniLabel">Total Pickups</div>
                <div className="trkMiniValue">{stats.totalPickups}</div>
              </div>
              <div className="trkMiniCard">
                <div className="trkMiniLabel">Eco Score</div>
                <div className="trkMiniValue">{stats.ecoScore}</div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#64748b",
                    fontWeight: 700,
                  }}
                >
                  {stats.ecoScore >= 100
                    ? "Excellent 🌱"
                    : stats.ecoScore >= 50
                    ? "Good ♻️"
                    : stats.ecoScore >= 20
                    ? "Improving 🌿"
                    : "Needs improvement"}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
