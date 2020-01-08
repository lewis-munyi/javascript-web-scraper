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

const pushPostToFirestore = data => {
	try {
		for (const [key, value] of Object.entries(data)) {
			if (key == "url") {
				let blog = db.collection("blog").doc(value.slice(23, -1));
				blog.set(data, { merge: true })
					.then(() => {
						// Promise
					})
					.catch(error => {
						console.error(`\n  ${error} \n`);
					});
				blog.set(
					{
						timestamp: FieldValue.serverTimestamp()
					},
					{ merge: true }
				);
				console.log(`\n  Pushed post to firestore. \n`);
			}
		}
	} catch (error) {
		console.log(`\n  ${error} \n`);
	}
};

const getFullPost = async url => {
	/*
	 * Scrap a full post's content and pass
	 * it to the store method
	 * */
	try {
		console.info(`\n  Scraping ${url}\n`);

		// Get post
		const response = await axios.get(url);
		if (response.status === 200) {
			console.info(`\n  Parsing data ... \n`);
			const $ = cheerio.load(response.data);

			// Initialize post object
			let post = {
				title: null,
				url: null,
				date: null,
				body: null,
				category: {
					name: null,
					url: null
				}
			};

			// Get post html and iterate through the paragraphs, concatenating them with each other
			const articleParagraphs = $(".post-content p");
			let article = [];
			articleParagraphs.each((index, paragraph) => {
				article.push($(paragraph).text());
			});

			// Populate the post object with parsed data
			post.title = $(".entry-title a")
				.text()
				.replace(/\s\s+/g, "");
			post.url = $(".entry-title a")
				.attr("href")
				.replace(/\s\s+/g, "");
			post.date = $(".post-date")
				.text()
				.replace(/\s\s+/g, "");
			post.category.url = $(".post-meta a")
				.attr("href")
				.replace(/\s\s+/g, "");
			post.category.name = $(".post-meta a")
				.text()
				.replace(/\s\s+/g, "");
			post.body = article.join();

			// Push the post to firestore
			await pushPostToFirestore(post);

			return post;
		}
	} catch (error) {
		console.error(`\n ${error} \n`);
	}
};

const updateLinks = async links => {
	try {
		await db
			.doc("misc/links")
			.get()
			.then(doc => {
				if (doc.exists) {
					for (let link of links) {
						if (!doc.data().urls.includes(link)) {
							newLinks = doc.data().urls.concat(link);
							uploadUrls(newLinks);
						}
					}
				}
			});
	} catch (e) {
		console.error(e);
	}
};

const uploadUrls = async data => {
	/*
	 * Add/update the URLs in firestore
	 * */

	await db
		.doc("misc/links")
		.set({ timestamp: FieldValue.serverTimestamp(), urls: data })
		.then(() => {
			console.log(`  Pushed ${data.length} links to firestore  \n`);
		})
		.catch(error => {
			console.error(`\n  ${error}\n`);
		});
};

/*
 * Create on update event listener
 * This will trigger the scraper to fetch the post from the link(s) in the 'update'
 * document.
 * On complete it should update the `links` document and blog collection, then send to the Telegram bot
 * */

exports.updatesFound = functions.firestore.document("misc/updates").onUpdate(async (change, context) => {
	// Get update(s) from firestore
	const newLinkUpdates = change.after.data().urls;

	// Upload new links(from the updates) to the links catalogue
	console.log("Awaiting uploading new links to catalogue");
	await updateLinks(newLinkUpdates);
	console.log("Uploaded links to catalogue");

	// Update posts collection
	for (const link of newLinkUpdates) {
		await getFullPost(link);
	}

	// Notify bot of update
	console.log("Notifying bot of update ...");
});

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

/*
 * Create on search request function.
 * This function is triggered when a user(bot) sends a http request with the the document query.
 * The function returns a list of matching blog posts in JSON format
 * */

exports.searchBlog = functions.https.onRequest((req, res) => {
	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}
	function toTitleCase(str) {
		return str.replace(/\w\S*/g, function(txt) {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		});
	}
	db.collection("blog")
		.orderBy("title")
		.where("title", ">=", req.query.query)
		.where("title", "<=", toTitleCase(req.query.query) + "z")
		.get()
		.then(function(querySnapshot) {
			if (querySnapshot.empty) {
				return res.status(404).json({ message: `Did not find any results for '${req.query.query}' :(` });
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
