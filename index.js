const cheerio = require("cheerio");
const axios = require("axios");
const chalk = require("chalk");
const figlet = require("figlet");
const admin = require("firebase-admin");
const firebase = require("firebase/app");
require("dotenv").config();
require("firebase/firestore");
const fs = require("fs");
const writeStream = fs.createWriteStream("urls.csv");
writeStream.write(`URL,Status\n`);

const readline = require("readline").createInterface({
	input: process.stdin,
	output: process.stdout
});

const firebaseConfig = {
	apiKey: process.env.API_KEY,
	authDomain: process.env.AUTH_DOMAIN,
	databaseURL: process.env.DATABASE_URL,
	projectId: process.env.PROJECT_ID,
	storageBucket: process.env.STORAGE_BUCKET,
	messagingSenderId: process.env.MESSAGING_SENDER_ID,
	appId: process.env.APP_ID,
	measurementId: process.env.MEASUREMENT_ID
};

firebase.initializeApp(firebaseConfig);
let FieldValue = admin.firestore.FieldValue;

let serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

let db = admin.firestore();

const getBlogs = async () => {
	let blogs = db.collection("blogs");
	blogs
		.get()
		.then(snapshot => {
			snapshot.forEach(doc => {
				console.log(chalk.yellow(`Reading ${doc.id}`));
				let body = false;
				if (doc.data().body != null && doc.data().body !== "") {
					body = true;
				}
				const writeStream = fs.createWriteStream("blog.csv");
				writeStream.write("ID,URL,TITLE,DATE,BODY,CATEGORY NAME,CATEGORY URL\n");
				// console.log(doc.id, "=>", doc.data());
				writeStream.write(
					`${doc.id.toString()},${
						doc.data().url
					},${doc.data().title.toString()},${doc.data().date.toString()},${body},${doc.data().category.name.toString()},${doc.data().category.url.toString()}\n`
				);

				console.log(chalk.greenBright(`\n  Posts saved to "blog.csv" \n`));
			});
		})
		.catch(err => {
			console.log("Error getting documents", err);
		});
};

const pushToFirebase = data => {
	try {
		for (const [key, value] of Object.entries(data)) {
			if (key == "url") {
				let blog = db.collection("blog").doc(value.slice(23, -1));
				blog.set(data, { merge: true })
					.then(() => {
						// Promise
					})
					.catch(error => {
						console.log(chalk.redBright(`\n  ${chalk.underline.bold(error)} \n`));
					});
				blog.set(
					{
						timestamp: FieldValue.serverTimestamp()
					},
					{ merge: true }
				);
				console.log(chalk.greenBright(`\n  Pushed to firebase. \n`));
			}
		}
	} catch (e) {
		console.log(chalk.redBright(`\n  ${chalk.underline.bold(e)} \n`));
	}
};

const getFullPost = async url => {
	/*
	 * Scrap a full post's content and pass
	 * it to the store method
	 * */
	try {
		console.log(chalk.yellow.bgBlack(`\n  Scraping ${chalk.underline.bold(url)}\n`));

		// Get post
		const response = await axios.get(url);
		if (response.status === 200) {
			console.log(chalk.yellow(`\n  Parsing data ... \n`));
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
			pushToFirebase(post);

			return post;
		}
	} catch (error) {
		console.log(chalk.redBright(`\n ${chalk.underline.bold(error)} \n`));
	}
};

const getBlogUrls = async url => {
	try {
		console.log(chalk.yellow(`\n  Getting posts URLs from ${chalk.underline.bold(url)}.  \n`));

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

		// Push URL to firebase

		console.log(chalk.greenBright(`  Extracted ${blogURLs.length} URLs.\n`));

		return blogURLs;
	} catch (error) {
		console.log(chalk.red(`\n  ${chalk.underline.bold("Oops!")} An error occurred while fetching the latest posts. Error: ${error}:\n`));
	}
};

const getUrlsFromAllPages = async url => {
	// Get URL string
	try {
		console.log(chalk.yellow(`\n  Getting total number of pages from ${chalk.underline.bold(url)}\n`));

		// Fetch and parse html
		const response = await axios.get(url);
		const $ = cheerio.load(response.data);

		/*
		 * Extract page numbers from paginator
		 **/
		const navLinks = $(".nav-links a");
		let pageNumbers = [];

		navLinks.each((index, link) => {
			pageNumbers.push(
				parseInt(
					$(link)
						.attr("href")
						.slice(33, -1)
				)
			);
		});

		const totalPages = Math.max(...pageNumbers); // Find the total number of pages on the blog
		console.log(chalk.greenBright(`  Found ${totalPages + 1} pages.\n`)); // +1 because we have to include the /Home route

		/*
		 * Extract all the blog links in the pages
		 * */

		// Get (latest) routes from Home page add them to a list
		let allUrls = await getBlogUrls("https://bikozulu.co.ke/");

		// Iterate through all the pages adding their URLs to our list
		for (let page = 1; page < totalPages; page++) {
			let urls = await getBlogUrls("https://bikozulu.co.ke/blog/" + page);
			allUrls = allUrls.concat(urls);
		}
		return [...new Set(allUrls)];
	} catch (error) {
		// Catch any error
		console.log(chalk.red(`\n  ${chalk.underline.bold(error)}\n`));
	}
};

const uploadUrls = async data => {
	/*
	 * Add/update the URLs in firestore
	 * */

	await db
		.collection("misc")
		.doc("links")
		.set({ timestamp: FieldValue.serverTimestamp(), urls: data })
		.then(() => {
			console.log(chalk.black.bgGreen(`  Pushed ${data.length} links to firestore  \n`));
		})
		.catch(error => {
			console.log(chalk.red(`\n  ${chalk.underline.bold(error)}\n`));
		});
};

const updateLinks = async links => {
	await db
		.collection("misc")
		.doc("links")
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
};

async function mainFunction() {
	/*
	Start program and request for user action
	**/
	readline.question(
		`\n\tAhoy there!  What would you like to do?\n
		${chalk.black.bgGreen(" 1.")} Fetch latest posts (default) \n
		${chalk.black.bgMagenta(" 2.")} Fetch & refresh all post links \n
		${chalk.black.bgCyan(" 3.")} Refresh blog store( This will get all links from Biko's blog, then get each of their posts.)\n 
		${chalk.black.bgGray(" 4.")} Refresh everything (Action 2 + 3). \n
		${chalk.black.bgYellow(" 5.")} Buy me a coffee 💛 ( https://www.buymeacoff.ee/lewismunyi ). \n
		${chalk.black.bgRedBright(" 0.")} Exit. \n\t  `,
		async action => {
			if (action == 1) {
				console.log(chalk.yellow(`\n Fetching latest posts... \n`));

				// Fetch URLs from home page
				let links = await getBlogUrls("https://bikozulu.co.ke/");

				// Fetch update URLs from firebase
				updates = db.collection("misc").doc("updates");

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
								// updates.delete();
								updates
									.set({ timestamp: FieldValue.serverTimestamp(), urls: newLinkUpdates })
									.then(() => {
										console.log(chalk.green(`  Received ${newLinkUpdates.length} updates.  \n`));
									})
									.catch(error => {
										console.log(chalk.red(`\n  ${chalk.underline.bold(error)}\n`));
									});

								// Upload new links to the links catalogue
								await updateLinks(newLinkUpdates);

								// Fetch blog contents for the new links
								console.log(chalk.yellow(`  Updating content ...  \n`));
								for (const link of newLinkUpdates) {
									await getFullPost(link);
								}
							} else {
								console.log(chalk.yellow(`\n  No updates available\n`));
							}
						} else {
							console.log(chalk.red(`\n  Firestore document is empty\n`));
						}
					})
					.catch(err => {
						console.log("Error getting document", err);
					});
				mainFunction();

				/*
				 * Update bot code comes here */
			} else if (action == 2) {
				console.log(chalk.yellow(`\n Fetching all post URLs. This might take a while... \n`));

				// Gets a list of URLs for all existing posts on Biko's blog
				let links = await getUrlsFromAllPages("https://bikozulu.co.ke/blog");

				// Upload all the links to firestore
				await uploadUrls(links);
				mainFunction();
			} else if (action == 3) {
				console.log(chalk.yellow(`\n You might wanna go grab a coffee ☕. This could take a while... \n`));
				// Get all links from firestore
				db.collection("misc")
					.doc("links")
					.get()
					.then(async doc => {
						// FOr each link, get the post and push it
						for (let [i, link] of doc.data().url.entries()) {
							console.log(chalk.yellow(`\n  Fetching post ${i + 1} of ${doc.data().url.length} \n`));
							await getFullPost(link);
						}
					});
				mainFunction();
			} else if (action == 4) {
				console.log(chalk.yellow(`\n You might wanna go grab another coffee ☕. This could take a while... \n`));
				// Gets a list of URLs for all existing posts on Biko's blog
				let links = await getUrlsFromAllPages("https://bikozulu.co.ke/blog");

				// Upload all the links to firestore
				await uploadUrls(links);

				for (const [i, link] of links.entries()) {
					console.log(chalk.inverse(`\n  Fetching post ${i + 1} of ${links.length} \n`));
					await getFullPost(link);
				}

				console.log(chalk.green(`  Whoa!😅 That was some work.  \n`));
				mainFunction();
			} else if (action.toString() === "0") {
				console.log(chalk.white(`  Bye 👋  \n`));
				process.exit(0);
			} else {
				console.log(chalk.red(`\n  Incorrect value. Select a value between 1 and 4. \n`));
				mainFunction();
			}
			readline.close();
		}
	);
}

// Start
figlet.text(
	"Bikozulu",
	{
		font: "Univers",
		horizontalLayout: "default",
		verticalLayout: "default"
	},
	function(err, data) {
		if (err) {
			console.log("Something went wrong...");
			console.dir(err);
			return;
		}
		console.clear();
		console.log("\n " + chalk.yellow.bgBlack(data));
		mainFunction();
	}
);
