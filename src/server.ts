import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { classifyHs } from "./classifyHs";
const { Client, GatewayIntentBits } = require("discord.js");
import { initializeBot } from "./telegramBot";

const app = express();
const port = process.env.PORT;
const discordToken = process.env.DISCORDTOKEN;

app.use(cors());
app.use(bodyParser.json());

const token = process.env.TELEGRAMTOKEN  as string;
// initializeBot(token);

export const cleanClassificationString = (classificationStr: string) => {
  try {
    const cleanedStr = classificationStr.replace(/(^"|"$)/g, "");
    if (cleanedStr.startsWith("[") && cleanedStr.endsWith("]")) {
      return eval(cleanedStr);
    }
  } catch (error) {}

  if (classificationStr.includes("hate speech")) {
    const classification = "hate speech";
    const protectedCharacteristicMatch = classificationStr.match(
      /protected characteristic of (\w+)/i
    );
    const protectedCharacteristic = protectedCharacteristicMatch
      ? [protectedCharacteristicMatch[1]]
      : [];
    const probabilityMatch = classificationStr.match(
      /probability.*?(\d\.\d+)/i
    );
    const probability = probabilityMatch
      ? [parseFloat(probabilityMatch[1])]
      : [1.0]; 

    return [classification, protectedCharacteristic, probability];
  }

  return ["unknown", [], [0]];
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", (c: any) => {
  console.log(`${c.user.tag} is online`);
});

client.on("messageCreate", async (msg: any) => {
  if (msg.author.bot) {
    return;
  }

  const classification = await classifyHs(msg.content);

  const rawData = cleanClassificationString(classification);

  const classify = rawData[0];
  const definition = rawData[1];

  if (classify === "hatespeech") {
    msg.reply(
      "This message has been flagged for containing inappropriate content. Please contact the moderator if you think this is a mistake."
    );
  }
});
client.login(discordToken).catch(console.error);

const upload = multer({ storage: multer.memoryStorage() });

app.post("/classify-hs", upload.single("file"), async (req, res) => {
  try {
    const { message, orgData } = req.body;
    const file = req.file;

    if (!message && !file) {
      return res
        .status(400)
        .json({ error: "Either message or file is required" });
    }

    let fileContent = "";

    if (file) {
      if (file.mimetype === "application/pdf") {
        const pdfData = await pdf(file.buffer);
        fileContent = pdfData.text;
      } else if (
        file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        fileContent = result.value;
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      fileContent = fileContent
        .trim()
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{2,}/g, "\n\n");
    }

    console.log(fileContent, "ew");

    const classification = await classifyHs(message);
    // const classification = await classifyHs(
    //   message,
    //   fileContent,
    //   JSON.parse(orgData)
    // );

    console.log(classification)

    res.json({ classification });
  } catch (error: any) {
    console.log(error, "error");
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
