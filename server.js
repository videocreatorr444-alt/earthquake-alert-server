const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Load service account (must be in same folder)
const serviceAccount = require("./service-account.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// USGS URLs
const USGS_URLS = {
  hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
  month: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson"
};

let lastEventId = null;

// Poll USGS every 30 seconds
async function pollUSGS() {
  try {
    const res = await axios.get(USGS_URLS.hour);
    const features = res.data.features;

    if (features.length > 0) {
      const latest = features[0];
      const eventId = latest.id;

      if (eventId !== lastEventId) {
        lastEventId = eventId;

        await admin.messaging().send({
          topic: "earthquake_alerts",
          notification: {
            title: "Earthquake Alert!",
            body: latest.properties.place
          }
        });

        console.log("⚡ NEW Earthquake Alert Sent!");
      }
    }
  } catch (err) {
    console.log("USGS Error:", err.message);
  }
}

setInterval(pollUSGS, 30000);
pollUSGS();

// API endpoint (formatted for app)
app.get("/api/quakes", async (req, res) => {
  const range = req.query.range;

  if (!USGS_URLS[range]) {
    return res.json({ quakes: [] });
  }

  try {
    const data = (await axios.get(USGS_URLS[range])).data;

    // Convert USGS format → App format
    const output = { quakes: [] };

    data.features.forEach(f => {
      output.quakes.push({
        id: f.id,
        place: f.properties.place,
        mag: f.properties.mag,
        time: f.properties.time
      });
    });

    return res.json(output);

  } catch (err) {
    return res.json({ quakes: [] });
  }
});

// Start server
app.listen(3000, () => {
  console.log("Local Server Running on http://localhost:3000");
});
