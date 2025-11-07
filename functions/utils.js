const admin = require("firebase-admin");
const db = admin.firestore();
const jwt = require("jsonwebtoken");

const generateRandomNum = (length) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generateToken = (user) => {
  const {id, phoneNo} = user;
  if (!id || !phoneNo) {
    throw new Error("User object must have id and phoneNo properties");
  }

  return jwt.sign(
      {id: id, email: phoneNo},
      process.env.JWT_SECRET,
  );
};

const decodeToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

const generateId = ({collection, idPrefix, length}) => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const currentMonth = (new Date().getMonth() + 1).toString();
  const counterRef = db.collection("meta").doc(`${collection}${currentYear}${currentMonth}Counter`);

  if (counterRef >= 999999999999) {
    throw new Error("Counter reached max limit");
  }

  return db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const current = doc.exists ? (doc.get("lastNumber") || 0) : 0;
    const newNumber = current + 1;

    t.set(counterRef, {lastNumber: newNumber}, {merge: true});

    const newId = `${idPrefix}${currentYear}${currentMonth}${newNumber.toString().padStart(length || 9, "0")}`;
    return newId;
  });
};

const authenticateToken = (req, res, next) => {
  const token = req.get("Authorization");

  if (!token) return res.status(401).json({error: `No token provided`});

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({error: "Invalid or expired token"}); // invalid or expired
    req.user = decoded; // store payload in req.user
    next();
  });
};

const boundingBox = (lat, lon, radiusKm) => {
  const earthRadiusKm = 6371;
  const pi = Math.PI;
  const latDelta = radiusKm / earthRadiusKm * (180 / pi);
  const lonDelta = radiusKm / (earthRadiusKm * Math.cos(lat * pi / 180)) * (180 / pi);

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lon - lonDelta,
    maxLng: lon + lonDelta,
  };
};

module.exports = {
  generateRandomNum: generateRandomNum,
  generateToken: generateToken,
  generateId: generateId,
  authenticateToken: authenticateToken,
  decodeToken: decodeToken,
  boundingBox: boundingBox,
};
