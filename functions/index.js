const axios = require("axios"); // Make Http Requests
const cheerio = require("cheerio"); // Parse HTML pages
const cors = require("cors")({ origin: true }); // Make cross-origin requests
const functions = require("firebase-functions"); // The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const serviceAccount = require("./firebase-adminsdk.json"); // Auth credentials

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});
// Initialize firestore
let db = admin.firestore();
let FieldValue = admin.firestore.FieldValue;
let FieldPath = admin.firestore.FieldPath;
