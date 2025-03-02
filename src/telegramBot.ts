import TelegramBot, { Message } from "node-telegram-bot-api";
import { classifyHs } from "./classifyHs";
import { cleanClassificationString } from "./server";
import express from "express"; // To handle incoming webhook requests

interface UserState {
  name?: string;
  awaitingInput:
    | "welcome"
    | "inappropriateContent"
    | "submitText"
    | "moreSubmission";
}

const userStates: { [key: number]: UserState } = {};

const defaultConfig = {
  id: "0x1A2b3C4d5E6f7890ABcDeF1234567890abCdEf12",
  orgId: "1",
  communityType: "RnDAO.AI",
  context:
    "RnDAO is a majority male web 3 community working on developing CollabTech across US, Europe. There are also a number of high profile female members of the team.",
  protectedCharacteristics: [
    "Age",
    "Disability",
    "Gender reassignment",
    "Marriage and civil partnership",
    "Pregnancy and maternity",
    "Race",
    "Religion or belief",
    "Sex",
    "Sexual orientation",
  ],
  model: "gpt-3.5-turbo",
  isPrivate: false,
  languagesUsed: "English, Spanish",
  geography: "US, UK, Europe, East Asia, Latin America.",
  safeguardingFocus: "Misogyny, Women in Tech",
};

export const initializeBot = (token: string): void => {
  const bot = new TelegramBot(token);

  const isProduction = process.env.PROD === "true";
  const webhookUrl = process.env.URL;
  const port = Number(process.env.PORT) || 3000;

  if (isProduction && webhookUrl) {
    const app = express();

    app.use(express.json());

    app.post(`/bot${token}`, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });

    bot
      .setWebHook(`${webhookUrl}/bot${token}`)
      .then(() => console.log(`Webhook set at: ${webhookUrl}/bot${token}`))
      .catch((err) => console.error("Error setting webhook:", err));

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } else {
    bot
      .startPolling()
      .then(() => console.log("Bot is running in polling mode"))
      .catch((err) => console.error("Error starting polling:", err));
  }

  bot.onText(/\/start(.*)/, (msg: Message, match: RegExpExecArray | null) => {
    const chatId = msg.chat.id;
    const payload = match?.[1]?.trim();

    if (payload) {
      bot.sendMessage(
        chatId,
        `Welcome to ${payload} Text Scanner! You can scan inappropriate content with the ${payload} Organization Value. Let the bot guide you.`,
        {
          reply_markup: {
            keyboard: [
              [
                {
                  text: `Start Text Scanner using ${payload} Organization Value`,
                },
              ],
            ],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        }
      );
    } else {
      bot.sendMessage(
        chatId,
        `Welcome to the WeLivedIt Bot! Have you experienced any inappropriate content?`,
        {
          reply_markup: {
            keyboard: [[{ text: "Yes" }], [{ text: "No" }]],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        }
      );
    }

    userStates[chatId] = { awaitingInput: "inappropriateContent" };
  });

  bot.on("message", async (msg: Message) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const userState = userStates[chatId] || { awaitingInput: "welcome" };

    if (text && text.startsWith("Start Text Scanner using")) {
      bot.sendMessage(
        chatId,
        `Thank you for starting the text scanner. Have you experienced inappropriate content?`,
        {
          reply_markup: {
            keyboard: [[{ text: "Yes" }], [{ text: "No" }]],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        }
      );
      userState.awaitingInput = "inappropriateContent";
    }

    switch (userState.awaitingInput) {
      case "inappropriateContent":
        if (text === "Yes") {
          bot.sendMessage(
            chatId,
            `Please provide the inappropriate content for analysis.`
          );
          userState.awaitingInput = "submitText";
        } else if (text === "No") {
          bot.sendMessage(
            chatId,
            `Thank you for checking in! You can create an AI for your organization to help analyze hate speech. Learn more at (https://we-lived-it.vercel.app/). Please type /start to begin`,
            { parse_mode: "Markdown" }
          );
          delete userStates[chatId];
        }
        break;

      case "submitText":
        if (text) {
          bot.sendMessage(chatId, `_Scanning..._`, { parse_mode: "Markdown" }); // Responds with "Scanning..." in italics

          const classification = await classifyHs({
            config: defaultConfig,
            message: text,
          });

          if (!classification) {
            bot.sendMessage(chatId, `_Scanning failed, please try again._`, {
              parse_mode: "Markdown",
            });
            userState.awaitingInput = "submitText";
            return;
          }

          const rawData = cleanClassificationString(classification);
          const classify = rawData[0];
          const definition = rawData[1];

          let message;

          if (classify === "hate speech") {
            message =
              "This message has been flagged for containing inappropriate content. Please contact the moderator if you think this is a mistake.";
          } else {
            message =
              "This message does not contain any inappropriate content. If you want to know more or speak to someone please contact us at welivedit.contact@gmail.com";
          }

          bot.sendMessage(
            chatId,
            `${message}. Would you like to submit more content?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "Yes, submit more" }],
                  [{ text: "No, end chat" }],
                ],
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
          userState.awaitingInput = "moreSubmission";
        }
        break;

      case "moreSubmission":
        if (text === "Yes, submit more") {
          bot.sendMessage(
            chatId,
            `Please provide the inappropriate content for analysis.`
          );
          userState.awaitingInput = "submitText";
        } else if (text === "No, end chat") {
          bot.sendMessage(
            chatId,
            `Thank you for using WeLivedIt Bot! Goodbye.. Learn more at [WeLivedIt.com](https://we-lived-it.vercel.app/). Please type /start to begin`
          );
          delete userStates[chatId];
        }
        break;

      case "welcome":
    }
  });
};
