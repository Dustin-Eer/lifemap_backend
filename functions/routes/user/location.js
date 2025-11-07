const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const {generateId, authenticateToken, boundingBox} = require("../../utils");
const googleMapApiKey = process.env.GOOGLEMAPAPIKEY;

const minSearchLength = 5;
const defaultZoom = 300;

router.get("/location/search", authenticateToken, async (req, res) => {
  const {location, query} = req.query;

  const schema = Joi.object({
    location: Joi.string().pattern(/^\d{1,3}\.\d{0,2},\d{1,3}\.\d{0,2}$/).required(),
    query: Joi.string().required(),
  }).required();

  const {error} = schema.validate(req.query);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const baseQuery = db.collection("locations").orderBy("name");
    const q = (query || "").trim();
    const alt = q.length ? q.charAt(0).toUpperCase() + q.slice(1) : q;

    const [primarySnap, altSnap] = await Promise.all([
      baseQuery.startAt(q).endAt(q + "\uf8ff").get(),
      baseQuery.startAt(alt).endAt(alt + "\uf8ff").get(),
    ]);

    let existingLocations = [...primarySnap.docs, ...altSnap.docs].map((d) => d.data());

    // Deduplicate by name+address
    const seen = new Set();
    existingLocations = existingLocations.filter((loc) => {
      const key = `${(loc.name || "").toLowerCase()}|${(loc.address || "").toLowerCase()}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    if (existingLocations.length === 0) {
      const sampleSnap = await baseQuery.limit(50).get();
      existingLocations = sampleSnap.docs
          .map((d) => d.data())
          .filter((loc) => {
            const nameMatch = (loc.name || "").toLowerCase().includes(query.toLowerCase());
            const addressMatch = (loc.address || "").toLowerCase().includes(query.toLowerCase());

            return (nameMatch || addressMatch);
          });
    }

    const [lat, lng] = location.split(",").map(Number);
    const box = boundingBox(lat, lng, defaultZoom);
    existingLocations = existingLocations.filter((loc) => loc.lat >= box["minLat"] && loc.lat <= box["maxLat"] &&
            loc.lng >= box["minLng"] && loc.lng <= box["maxLng"]);


    const qLower = query.toLowerCase();
    const scoreName = (name, q) => {
      const n = (name || "").trim().toLowerCase();
      const first = n.split(/\s+/)[0] || "";
      if (first === q) return 3; // exact first word match
      if (n.startsWith(q)) return 2; // whole name starts with query
      if (first.startsWith(q)) return 1; // first word prefix
      if (n.includes(q)) return 0; // contains somewhere
      return -1; // weak match
    };
    existingLocations = existingLocations
        .map((loc) => ({...loc, _score: scoreName(loc.name, qLower)}))
        .sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          const aLen = (a.name || "").length;
          const bLen = (b.name || "").length;
          if (aLen !== bLen) return aLen - bLen;
          return (a.name || "").localeCompare(b.name || "");
        });

    existingLocations.forEach((loc) => {
      loc._score = scoreName(loc.name, qLower);
      console.log(loc.name, loc._score);
    });

    const maxScore = existingLocations.length ? existingLocations[0]._score : -1;

    if (maxScore && existingLocations.length >= minSearchLength) {
      return res.status(200).json({message: "Location found in db", locations: existingLocations});
    }

    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.append("query", query);
    url.searchParams.append("radius", 400);
    url.searchParams.append("location", location);
    url.searchParams.append("key", googleMapApiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    const googleLocations = data.results.map((item) => ({
      name: item.name,
      address: item.formatted_address,
      lat: item.geometry.location.lat,
      lng: item.geometry.location.lng,
    }));

    Promise.all(googleLocations.map(async (loc) => {
      const existing = await db.collection("locations")
          .where("name", "==", loc.name)
          .where("address", "==", loc.address)
          .limit(1)
          .get();

      if (existing.empty) {
        const locationId = await generateId({collection: "locations", idPrefix: "LOC"});
        const locationRef = db.collection("locations").doc(locationId);
        locationRef.set({
          id: locationId,
          name: loc.name,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng,
          createAt: new Date().getTime(),
        });
      }
    }));

    return res.status(200).json({message: "Location synced from google map", locations: googleLocations});
  } catch (error) {
    res.status(500).json({
      error: "Error syncing locations",
      message: error.message,
    });
  }
});

module.exports = router;
