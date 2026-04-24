import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { FiActivity, FiMapPin, FiTruck, FiUser, FiZap } from "react-icons/fi";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../components/admindashboard.css";
import "./livetrackingadmin.css";

const BACKEND_URL = "https://ecotrack-mqko.onrender.com";

const CENTER_PONDA = [15.3991, 74.0124];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function timeAgo(ts) {
  if (!ts) return "unknown";

  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function health(lastUpdated) {
  if (!lastUpdated) return { label: "Offline", tone: "offline" };

  const age = Date.now() - lastUpdated;

  if (age < 15000) return { label: "Live", tone: "live" };
  if (age < 60000) return { label: "Idle", tone: "idle" };
  return { label: "Offline", tone: "offline" };
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const delta = toRad(lon2 - lon1);

  const y = Math.sin(delta) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta);

  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

function statusColor(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "active") return "#16a34a";
  if (normalizedStatus === "maintenance") return "#f59e0b";
  if (normalizedStatus === "inactive") return "#ef4444";

  return "#0f3d2e";
}

function makeTruckIcon({ color, rotation = 0 }) {
  return new L.DivIcon({
    className: "",
    html: `
      <div style="
        width:38px;
        height:38px;
        border-radius:14px;
        background:${color};
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 14px 30px rgba(2,6,23,.22);
        border:2px solid rgba(255,255,255,.95);
        transform: rotate(${rotation}deg);
      ">
        <span style="color:white;font-size:16px;transform: rotate(${-rotation}deg);">🚚</span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function useSmoothPositions(targetById, smoothingMs = 650) {
  const [smooth, setSmooth] = useState(targetById);
  const fromRef = useRef(targetById);
  const toRef = useRef(targetById);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    toRef.current = targetById;

    const fromKeys = Object.keys(fromRef.current || {});
    const toKeys = Object.keys(targetById || {});

    if (!fromKeys.length) {
      fromRef.current = targetById;
      setSmooth(targetById);
      return;
    }

    startRef.current = performance.now();

    const tick = (now) => {
      const start = startRef.current ?? now;
      const progress = Math.min(1, (now - start) / smoothingMs);
      const next = {};

      toKeys.forEach((id) => {
        const from = fromRef.current[id];
        const to = toRef.current[id];

        if (!from || !to) {
          next[id] = to;
          return;
        }

        next[id] = {
          ...to,
          lat: from.lat + (to.lat - from.lat) * progress,
          lng: from.lng + (to.lng - from.lng) * progress,
          rotation: to.rotation ?? from.rotation ?? 0,
        };
      });

      setSmooth(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = toRef.current;
        setSmooth(toRef.current);
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [targetById, smoothingMs]);

  return smooth;
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

function MapFocus({ truck }) {
  const map = useMap();
  const previousTruckId = useRef(null);

  useEffect(() => {
    if (!truck) return;
    if (!Number.isFinite(truck.lat) || !Number.isFinite(truck.lng)) return;
    if (!map?._container?.isConnected) return;

    const sameTruck = previousTruckId.current === truck.truck_id;
    previousTruckId.current = truck.truck_id;

    if (!sameTruck) {
      map.setView([truck.lat, truck.lng], Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }, [map, truck?.truck_id, truck?.lat, truck?.lng]);

  return null;
}

function StatCard({ title, value, sub, icon }) {
  return (
    <div className="statCard">
      <div className="statTop">
        <div className="statLabel">{title}</div>
        <div className="statIcon">{icon}</div>
      </div>
      <div className="statValue">{value}</div>
      <div className="statSub">{sub}</div>
    </div>
  );
}

export default function LiveTrackingAdmin() {
  const [rawById, setRawById] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All Areas");
  const [refreshOn, setRefreshOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const historyRef = useRef({});

  const fetchLive = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const res = await fetch(`${BACKEND_URL}/live-tracking`);
      if (!res.ok) {
        throw new Error("Live tracking API not reachable.");
      }

      const data = await res.json();
      const trucks = Array.isArray(data) ? data : [];
      const now = Date.now();

      const activeIds = new Set();

      setRawById((prev) => {
        const next = {};

        trucks.forEach((truck) => {
          const id = truck.truck_id || truck.vehicle_number || truck.id;
          const lat = Number(truck.lat);
          const lng = Number(truck.lng);

          if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

          activeIds.add(String(id));

          const previousTruck = prev[String(id)];
          let rotation = previousTruck?.rotation ?? 0;

          if (
            previousTruck &&
            Number.isFinite(previousTruck.lat) &&
            Number.isFinite(previousTruck.lng) &&
            (previousTruck.lat !== lat || previousTruck.lng !== lng)
          ) {
            rotation = bearingDeg(previousTruck.lat, previousTruck.lng, lat, lng);
          }

          const backendUpdated =
            truck.lastUpdated ||
            truck.last_updated ||
            truck.updated_at ||
            truck.timestamp ||
            null;

          next[String(id)] = {
            id: truck.id ?? id,
            truck_id: String(id),
            driver_name: truck.driver_name || "Driver",
            area: truck.area || truck.area_assigned || "Unknown Area",
            status: truck.status || "active",
            speed: Number(truck.speed ?? 0),
            lat,
            lng,
            lastUpdated: backendUpdated ? new Date(backendUpdated).getTime() : now,
            rotation,
          };

          const trail = historyRef.current[String(id)] || [];
          const lastPoint = trail[trail.length - 1];

          const moved =
            !lastPoint ||
            Math.abs(lastPoint.lat - lat) > 0.00002 ||
            Math.abs(lastPoint.lng - lng) > 0.00002;

          if (moved) {
            historyRef.current[String(id)] = [
              ...trail.slice(-29),
              { lat, lng, ts: now },
            ];
          }
        });

        Object.keys(historyRef.current).forEach((id) => {
          if (!activeIds.has(id)) {
            delete historyRef.current[id];
          }
        });

        return next;
      });
    } catch (fetchError) {
      console.error("Live tracking fetch failed:", fetchError);
      setError(fetchError.message || "Failed to load live tracking.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    if (!refreshOn) return undefined;

    const interval = setInterval(() => {
      fetchLive({ silent: true });
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchLive, refreshOn]);

  const smoothById = useSmoothPositions(rawById, 650);

  const areas = useMemo(() => {
    const values = new Set(["All Areas"]);
    Object.values(rawById).forEach((truck) =>
      values.add(truck.area || "Unknown Area")
    );
    return Array.from(values);
  }, [rawById]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return Object.values(rawById)
      .filter((truck) => (area === "All Areas" ? true : truck.area === area))
      .filter((truck) => {
        if (!normalizedQuery) return true;

        return (
          String(truck.truck_id || "").toLowerCase().includes(normalizedQuery) ||
          String(truck.driver_name || "").toLowerCase().includes(normalizedQuery) ||
          String(truck.area || "").toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  }, [query, rawById, area]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }

    if (!filtered.some((truck) => truck.truck_id === selectedId)) {
      setSelectedId(filtered[0].truck_id);
    }
  }, [filtered, selectedId]);

  const selectedTruck = useMemo(
    () => filtered.find((truck) => truck.truck_id === selectedId) || null,
    [filtered, selectedId]
  );

  const focusedTruck = useMemo(() => {
    if (!selectedTruck) return null;
    return smoothById[selectedTruck.truck_id] || selectedTruck;
  }, [selectedTruck, smoothById]);

  const visibleIds = useMemo(
    () => new Set(filtered.map((truck) => truck.truck_id)),
    [filtered]
  );

  const totalTrucks = Object.keys(rawById).length;

  const liveCount = useMemo(
    () =>
      Object.values(rawById).filter(
        (truck) => health(truck.lastUpdated).label === "Live"
      ).length,
    [rawById]
  );

  const avgSpeed = useMemo(() => {
    const speeds = filtered
      .map((truck) => Number(truck.speed || 0))
      .filter((speed) => Number.isFinite(speed));

    if (!speeds.length) return 0;

    const total = speeds.reduce((sum, speed) => sum + speed, 0);
    return Math.round(total / speeds.length);
  }, [filtered]);

  const selectedHealth = selectedTruck
    ? health(selectedTruck.lastUpdated)
    : null;

  return (
    <div className="trackingAdminPage">
      <div className="adminHeader">
        <div>
          <h1 className="pageTitle">Live Tracking</h1>
          <p className="pageSub">
            Real-time fleet tracking for the admin control panel.
          </p>
        </div>

        <div className="adminHeaderBtns trackerToolbar">
          <input
            className="trackerField trackerSearchField"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search truck, driver, or area"
            type="text"
          />

          <select
            className="trackerField trackerSelectField"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            {areas.map((areaOption) => (
              <option key={areaOption} value={areaOption}>
                {areaOption}
              </option>
            ))}
          </select>

          <button
            className={`chipBtn ${refreshOn ? "live" : ""}`}
            onClick={() => setRefreshOn((prev) => !prev)}
            type="button"
          >
            {refreshOn ? "● Live" : "Paused"}
          </button>

          <button
            className="chipBtn"
            disabled={loading}
            onClick={() => fetchLive()}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="adminError">{error}</div> : null}

      <div className="stats5 trackerStatsGrid">
        <StatCard
          title="Tracked Trucks"
          value={totalTrucks}
          sub="Vehicles currently available in the tracker"
          icon={<FiTruck />}
        />
        <StatCard
          title="Live Signals"
          value={liveCount}
          sub="Fresh updates received in the last 15 seconds"
          icon={<FiActivity />}
        />
        <StatCard
          title="Visible on Map"
          value={filtered.length}
          sub={area === "All Areas" ? "All areas in current view" : `Filtered for ${area}`}
          icon={<FiMapPin />}
        />
        <StatCard
          title="Avg Speed"
          value={`${avgSpeed} km/h`}
          sub="Average speed of the currently visible fleet"
          icon={<FiZap />}
        />
      </div>

      <div className="trackerAdminGrid">
        <section className="cardBox trackerMapCard">
          <div className="cardTitleRow">
            <div>
              <div className="cardTitle">Fleet Map</div>
              <div className="miniMuted">
                {selectedTruck
                  ? `Focused on ${selectedTruck.truck_id}`
                  : "Select a truck from the panel to focus the map"}
              </div>
            </div>

            {selectedTruck ? (
              <span className={`trackerHealthBadge trackerHealthBadge-${selectedHealth.tone}`}>
                {selectedHealth.label}
              </span>
            ) : null}
          </div>

          <div className="trackerMapShell">
            <MapContainer
              center={CENTER_PONDA}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              boxZoom={false}
              zoomAnimation={false}
              fadeAnimation={false}
              markerZoomAnimation={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <ForceResize />
              <MapFocus truck={focusedTruck} />

              {Object.keys(historyRef.current).map((id) => {
                if (!visibleIds.has(id)) return null;

                const trail = historyRef.current[id] || [];
                if (trail.length < 2) return null;

                return (
                  <Polyline
                    key={`trail-${id}`}
                    pathOptions={{ color: "#10b981", opacity: 0.55, weight: 4 }}
                    positions={trail.map((point) => [point.lat, point.lng])}
                  />
                );
              })}

              {filtered.map((truck) => {
                const smoothTruck = smoothById[truck.truck_id] || truck;

                if (
                  !Number.isFinite(smoothTruck?.lat) ||
                  !Number.isFinite(smoothTruck?.lng)
                ) {
                  return null;
                }

                return (
                  <Marker
                    key={truck.truck_id}
                    eventHandlers={{ click: () => setSelectedId(truck.truck_id) }}
                    icon={makeTruckIcon({
                      color: statusColor(truck.status),
                      rotation: smoothTruck.rotation || 0,
                    })}
                    position={[smoothTruck.lat, smoothTruck.lng]}
                  >
                    <Popup>
                      <div className="trackerPopup">
                        <div className="trackerPopupTitle">{truck.truck_id}</div>
                        <div className="trackerPopupMeta">
                          Driver: {truck.driver_name}
                          <br />
                          Area: {truck.area}
                          <br />
                          Status: {truck.status}
                          <br />
                          Speed: {truck.speed} km/h
                          <br />
                          Updated: {timeAgo(truck.lastUpdated)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {!loading && filtered.length === 0 ? (
              <div className="trackerEmptyState">
                No trucks match the current search and area filters.
              </div>
            ) : null}
          </div>
        </section>

        <aside className="cardBox trackerSideCard">
          <div className="cardTitleRow">
            <div>
              <div className="cardTitle">Tracked Vehicles</div>
              <div className="miniMuted">
                Click a vehicle to highlight it and focus the map.
              </div>
            </div>

            <span className="trackerCountPill">{filtered.length}</span>
          </div>

          {selectedTruck ? (
            <div className="trackerSelectedCard">
              <div className="trackerSelectedHeader">
                <div>
                  <div className="trackerSelectedTitle">{selectedTruck.truck_id}</div>
                  <div className="trackerSelectedSubtitle">{selectedTruck.driver_name}</div>
                </div>

                <span className={`trackerHealthBadge trackerHealthBadge-${selectedHealth.tone}`}>
                  {selectedHealth.label}
                </span>
              </div>

              <div className="trackerSelectedGrid">
                <div>
                  <span>Area</span>
                  <strong>{selectedTruck.area}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{selectedTruck.status}</strong>
                </div>
                <div>
                  <span>Speed</span>
                  <strong>{selectedTruck.speed} km/h</strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>{timeAgo(selectedTruck.lastUpdated)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="trackerEmptyPanel">No active vehicle selected.</div>
          )}

          <div className="trackerVehicleList">
            {loading && !totalTrucks ? (
              <div className="trackerEmptyPanel">Loading live tracking...</div>
            ) : filtered.length === 0 ? (
              <div className="trackerEmptyPanel">No tracked vehicles found.</div>
            ) : (
              filtered.map((truck) => {
                const truckHealth = health(truck.lastUpdated);
                const active = selectedId === truck.truck_id;

                return (
                  <button
                    className={`trackerVehicleItem ${active ? "active" : ""}`}
                    key={truck.truck_id}
                    onClick={() => setSelectedId(truck.truck_id)}
                    type="button"
                  >
                    <div className="trackerVehicleHead">
                      <div>
                        <div className="trackerVehicleTitle">{truck.truck_id}</div>
                        <div className="trackerVehicleSub">
                          <FiUser />
                          {truck.driver_name}
                        </div>
                      </div>

                      <span className={`trackerHealthBadge trackerHealthBadge-${truckHealth.tone}`}>
                        {truckHealth.label}
                      </span>
                    </div>

                    <div className="trackerVehicleMeta">
                      <span>
                        <FiMapPin />
                        {truck.area}
                      </span>
                      <span>
                        <FiZap />
                        {truck.speed} km/h
                      </span>
                    </div>

                    <div className="trackerVehicleFoot">
                      <span className="trackerStatusDot">
                        <span
                          className="trackerStatusDotInner"
                          style={{ background: statusColor(truck.status) }}
                        />
                        {truck.status}
                      </span>
                      <span>Updated {timeAgo(truck.lastUpdated)}</span>
                    </div>

                    <div className="trackerSpeedBar">
                      <div
                        className="trackerSpeedBarFill"
                        style={{
                          background: statusColor(truck.status),
                          width: `${clamp((truck.speed || 0) * 2, 5, 100)}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}