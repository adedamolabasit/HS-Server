import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { classifyHs } from "./classifyHs";
const { Client, GatewayIntentBits } = require("discord.js");
import { initializeBot } from "./telegramBot";
import { config } from "dotenv";

const app = express();
const port = process.env.PORT;
const discordToken = process.env.DISCORDTOKEN;

app.use(cors());
app.use(bodyParser.json());

const token = process.env.TELEGRAMTOKEN as string;
initializeBot(token);

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

  const classification = await classifyHs({
    config: { ...defaultConfig },
    message: msg.content,
  });

  const rawData = cleanClassificationString(classification);

  const classify = rawData[0];

  if (classify === "hate speech") {
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

    let classification;

    if (fileContent) {
      classification = await classifyHs({
        config: JSON.parse(orgData),
        message,
        fileContent,
      });
    } else {
      classification = await classifyHs({ config: JSON.parse(orgData), message });
    }

    res.json({ classification });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
