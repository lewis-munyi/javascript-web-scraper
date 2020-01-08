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

const getBlogUrls = async url => {
	try {
		console.info(`\n  Getting posts URLs from ${url}.  \n`);

		const response = await axios.get(url);
		const $ = cheerio.load(response.data);
		const pageArticles = $("article");

		let blogURLs = [];

		pageArticles.each((index, article) => {
			if ($(article).attr("itemtype") == "http://schema.org/Article") {
				link = $(".post-title  a", article).attr("href") + " ".replace(/\s\s+/g, "");
				blogURLs.push(link);
			}
		});

		console.info(`  Extracted ${blogURLs.length} URLs.\n`);

		return blogURLs;
	} catch (error) {
		console.error(`\n  ${error}:\n`);
	}
};

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
			} else if (key == "category") {
				db.collection("misc")
					.update({ categories: FieldValue.arrayUnion(value.name) })
					.then(() => {
						console.info("Pushed category");
					});
			}
		}
		console.log(`\n  Pushed post to firestore. \n`);
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

/*
 * Create get update function
 * This function, when triggered, checks for updates from the blog
 * and updates the "updates" collection.
 * */

exports.getUpdates = functions.https.onRequest(async (req, res) => {
	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	// Fetch URLs from home page
	let links = await getBlogUrls("https://bikozulu.co.ke/");

	// Fetch update URLs from firebase
	const updates = db.collection("misc").doc("updates");

	updates
		.get()
		.then(async doc => {
			if (doc.exists) {
				let newLinkUpdates = [];

				/*
				 * Check if there are any new updates.
				 * If any, update the store and blog
				 * */
				for (let newLink of links) {
					if (!doc.data().urls.includes(newLink)) {
						newLinkUpdates.push(newLink);
					}
				}
				newLinkUpdates = [...new Set(newLinkUpdates)];

				if (newLinkUpdates.length !== 0) {
					/*
					 * Update the URLs in firestore
					 * */

					// Update "updates" collection
					updates
						.set({ timestamp: FieldValue.serverTimestamp(), urls: newLinkUpdates })
						.then(() => {
							console.info(`  Received ${newLinkUpdates.length} updates.  \n`);
							return res.status(200).json({ message: `Updates complete. Received ${newLinkUpdates.length} updates.` });
						})
						.catch(error => {
							console.error(`\n  ${error}\n`);
							return res.status(500).json({ message: error });
						});
				} else {
					console.log(`\n  No updates available\n`);
					return res.status(200).json({ message: "No updates available" });
				}
			} else {
				console.error(`\n  Firestore document is empty\n`);
				return res.status(500).json({ message: "Firestore document is empty" });
			}
		})
		.catch(err => {
			console.error("Error getting document", err);
			return res.status(500).json({ message: error });
		});
});

/*
 * Create get get all links function
 * This function, when triggered, retrieves a list of all post links and post titles,
 * sorts them by the time added in descending order and sends them to the user.
 * */

exports.getAllBlogLinks = functions.https.onRequest((req, res) => {
	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	let blogToSend = [];
	const blog = db
		.collection("blog")
		.orderBy("timestamp", "desc")
		.get()
		.then(snapshot => {
			snapshot.forEach(doc => {
				blogToSend.push({ title: doc.data().title, url: doc.data().url, date: doc.data().date });
			});
			return res.status(200).json(blogToSend);
		})
		.catch(error => {
			console.error(error);
			return res.status(500).json(error);
		});
});

/*
 * Update categories collection
 * This function, when triggered, retrieves a list of all posts,
 * extracts their categories and pushed them into the collection.
 * */

exports.updateCategories = functions.https.onRequest((req, res) => {
	db.collection("blog")
		.get()
		.then(snapshot => {
			snapshot.forEach(doc => {
				db.collection
					.update({ categories: FieldValue.arrayUnion(doc.data().category.name) })
					.then(() => {
						return res.status(200).json({ message: "Successfully updated categories" });
					})
					.catch(error => {
						return res.status(500).json(error);
					});
			});
		})
		.catch(error => {
			return res.status(500).json(error);
		});
});

/*
 * Get a list of all categories
 * */

exports.getCategoryList = functions.https.onRequest((req, res) => {
	db.collection("misc")
		.doc("categories")
		.get()
		.then(doc => {
			return res.status(200).json(doc.data().categories);
		})
		.catch(error => {
			return res.status(500).json(error);
		});
});
