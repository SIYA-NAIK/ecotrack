const axios = require("axios");

const URL = "http://localhost:5000/driver/update";

const trucks = [
  { id: "ECO-001", lat: 15.3991, lng: 74.0124 },
  { id: "ECO-002", lat: 15.3995, lng: 74.0130 },
  { id: "ECO-003", lat: 15.4000, lng: 74.0140 },
  { id: "ECO-004", lat: 15.3985, lng: 74.0115 },
  { id: "ECO-005", lat: 15.4010, lng: 74.0150 },
  { id: "ECO-006", lat: 15.3975, lng: 74.0105 },
  { id: "ECO-007", lat: 15.4020, lng: 74.0160 },
  { id: "ECO-008", lat: 15.3965, lng: 74.0095 },
];

setInterval(async () => {
  for (let truck of trucks) {
    truck.lat += (Math.random() - 0.5) * 0.001;
    truck.lng += (Math.random() - 0.5) * 0.001;

    const speed = Math.floor(Math.random() * 20) + 20;

    try {
      await axios.post(URL, {
        truck_id: truck.id,
        lat: truck.lat,
        lng: truck.lng,
        speed: speed,
      });

      console.log(`✅ ${truck.id} updated`);
    } catch (e) {
      console.log(`❌ ${truck.id} error`);
    }
  }
}, 3000);