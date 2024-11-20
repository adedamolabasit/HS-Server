import TelegramBot, { Message } from "node-telegram-bot-api";
import { classifyHs } from "./classifyHs";
import { cleanClassificationString } from "./server";

interface UserState {
  name?: string;
  awaitingInput:
    | "welcome"
    | "inappropriateContent"
    | "submitText"
    | "moreSubmission";
}

const userStates: { [key: number]: UserState } = {};

export const initializeBot = (token: string): void => {
  const bot = new TelegramBot(token, { polling: true });

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

          const classification = await classifyHs(text);

          // Check if no classification result is returned
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

          if (classify === "hatespeech") {
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
