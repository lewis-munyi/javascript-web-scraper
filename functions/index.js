// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");
let serviceAccount = require("./firebase-adminsdk.json");
// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});
