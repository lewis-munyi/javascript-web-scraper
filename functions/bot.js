require("dotenv").config();
const Telegraf = require("telegraf");
const Extra = require("telegraf/extra");
const Markup = require("telegraf/markup");
const session = require("telegraf/session");
const axios = require("axios");

const bot = new Telegraf(process.env.TOKEN);

// Register session middleware
bot.use(session());

// Register logger middleware
bot.use((ctx, next) => {
	const start = new Date();
	return next().then(() => {
		const ms = new Date() - start;
		console.log("response time %sms", ms);
	});
});

// Get a blog post
bot.on("text", async (ctx, next) => {
	const regex = /https?:\/\/(www\.)?bikozulu.co.ke\/(blog)?[-a-zA-Z0-9@:%._\+~#=]{2,256}/g;
	let title = null;
	if (regex.test(ctx.message.text)) {
		if (ctx.message.text.substring(23, 28) === "blog/") {
			title = ctx.message.text.substring(28, ctx.message.text.length - 1);
		} else {
			title = ctx.message.text.substring(23, ctx.message.text.length - 1);
		}

		try {
			let wholeBody = [];
			let counter = 0;
			let { data } = await axios.get("https://us-central1-bikozulu-bot.cloudfunctions.net/getSingleBlogPostFromFirebase", {
				params: {
					post_id: title
				}
			});
			let headers = `<b>${data[0].title}</b> \n<a href="${data[0].category.url}">${data[0].category.name}</a> \n<i>${data[0].date}</i>\n\n`;
			let body = headers.concat(data[0].body);
			const likesAndComments = Markup.inlineKeyboard([Markup.urlButton("Like ❤️", data[0].url), Markup.urlButton("Comment 💬", `${data[0].url}#reply-title`)]);

			while (body.length > 4000) {
				wholeBody[counter] = body.substring(0, 4096);
				counter += 1;
				body = body.substring(4096, body.length);
			}
			wholeBody[counter] = body;

			for (let [index, block] of wholeBody.entries()) {
				if (index === wholeBody.length - 1) {
					await ctx.replyWithHTML(block, Extra.markup(likesAndComments));
				} else {
					await ctx.replyWithHTML(block);
				}
			}

			// ctx.replyWithMarkdown(data[0].body.substring(1, 4000));
		} catch (e) {
			ctx.reply("Oops! We encountered an error processing your request");
			console.log(e);
		}
	} else {
		ctx.reply("Unrecognized url.");
		ctx.reply("Send a URL like https://bikozulu.co.ke/blog/dear-december or https://bikozulu.co.ke/kananus-scar");
	}
});
// Get latest post
bot.command("getupdates", async ctx => {
	const msgInfo = await ctx.reply("Fetching updates ...");
	let { data } = await axios.get("https://us-central1-bikozulu-bot.cloudfunctions.net/getUpdates");
	ctx.reply(data.message);
});
// Fetch a list of all posts
bot.command("allposts", async ctx => {
	let msgInfo = await ctx.replyWithMarkdown("Fetching all posts ...");
	try {
		let { data } = await axios.get("https://us-central1-bikozulu-bot.cloudfunctions.net/getAllBlogLinks");
		let postList = ["*All blog posts*\n\n"];
		let counter = 0;
		await ctx.replyWithMarkdown(data.length);
		for ([index, item] of data.entries()) {
			let link = `${index + 1}. [${item.title}](${item.url})\t _${item.date}_\n\n`;
			postList = postList.concat(link);
			if (postList[counter].concat(link).length < 4096) {
				postList[counter] = postList[counter] + link;
			} else {
				counter += 1;
				postList[counter] = link;
			}
		}
		// await ctx.replyWithMarkdown(postList.length);
		await ctx.telegram.editMessageText(msgInfo.chat.id, msgInfo.message_id, undefined, postList[0], { parse_mode: "Markdown" });
		for (let i = 1; i < 20; i++) {
			await ctx.replyWithMarkdown(postList[i]);
		}
	} catch (e) {
		console.error(e);
		await ctx.telegram.editMessageText(
			msgInfo.chat.id,
			msgInfo.message_id,
			undefined,
			"*Oops!* I encountered an error processing your request. Please try again later or notify [my creator](@lewismunyi)",
			{ parse_mode: "Markdown" }
		);
		ctx.replyWithMarkdown("*Oops!* I encountered an error processing your request. Please try again later or notify [my creator](https://t.me/lewismunyi)");
	}
});

// Show bot info
bot.command("info", ctx => {
	ctx.replyWithMarkdown(
		`Made with ❤ by: [Lewis Munyi](https://lewis-munyi.github.io)  🇰🇪\n\nReport bugs: [here](t.me/lewismunyi)\n\nDisclaimer: All content posted here is fetched from [Bikozulu](https://bikozulu.co.ke/) and might be subject to copyright`
	);
});

// Say hi when the bot starts
bot.start(ctx => {
	ctx.replyWithMarkdown(`Hi there ${ctx.from.first_name} 👋 \nNice to meet you. \n\nI'm only a 🤖 so you will have to use commands (starting with "/") to interact with me. \n\nHappy reading🙂`);
});

//
// // Login widget events
// bot.on("connected_website", ({ reply }) => reply("Website connected"));
//
// // Telegram passport events
// bot.on("passport_data", ({ reply }) => reply("Telegram password connected"));
//
// // Random location on some text messages
// bot.on("text", ({ replyWithLocation }, next) => {
// 	if (Math.random() > 0.2) {
// 		return next();
// 	}
// 	return Promise.all([replyWithLocation(Math.random() * 180 - 90, Math.random() * 180 - 90), next()]);
// });
//
// // Text messages handling
// bot.hears("Hey", sayYoMiddleware, ctx => {
// 	ctx.session.heyCounter = ctx.session.heyCounter || 0;
// 	ctx.session.heyCounter++;
// 	return ctx.replyWithMarkdown(`_Hey counter:_ ${ctx.session.heyCounter}`);
// });
//
// // Command handling
// bot.command("answer", sayYoMiddleware, ctx => {
// 	console.log(ctx.message);
// 	return ctx.reply("*42*\n [Hello World](https://test.com)", Extra.markdown());
// });
//
// bot.command("cat", ({ replyWithPhoto }) => replyWithPhoto(randomPhoto));
//
// // Streaming photo, in case Telegram doesn't accept direct URL
// bot.command("cat2", ({ replyWithPhoto }) => replyWithPhoto({ url: randomPhoto }));
//
// // Look ma, reply middleware factory
// bot.command("foo", reply("http://coub.com/view/9cjmt"));
//
// // Wow! RegEx
// bot.hears(/reverse (.+)/, ({ match, reply }) =>
// 	reply(
// 		match[1]
// 			.split("")
// 			.reverse()
// 			.join("")
// 	)
// );

// Launch bot
bot.launch();
