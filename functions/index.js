const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp(); // ✅ Only once
const app = require("./app");

exports.api = functions.https.onRequest(app);
