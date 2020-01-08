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

/*
 * Create on post request function.
 * This function is triggered when a user(bot) sends a http request with the document id/url.
 * The function returns a blog post in JSON format
 * */

exports.getSingleBlogPostFromFirebase = functions.https.onRequest((req, res) => {
	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}
	function titleize(slug) {
		var words = slug.split("-");
		return words
			.map(function(word) {
				return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
			})
			.join(" ");
	}

	db.collection("blog")
		.where("title", "==", titleize(req.query.post_id))
		.get()
		.then(function(querySnapshot) {
			if (querySnapshot.empty) {
				return res.status(404).json({ message: `Post '${req.query.post_id}' was not found :(` });
			}
			let responses = [];
			querySnapshot.forEach(doc => {
				responses.push(doc.data());
			});
			return res.status(200).json(responses);
		})
		.catch(error => {
			// console.log("Error getting documents: ", error);
			return res.status(500).json({ message: `Internal server error ${error}` });
		});
});
