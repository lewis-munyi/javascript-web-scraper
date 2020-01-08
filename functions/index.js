// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");
let serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});
