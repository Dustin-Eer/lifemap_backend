const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp(); // ✅ Only once
const app = require("./app");

exports.api = onRequest(app);
