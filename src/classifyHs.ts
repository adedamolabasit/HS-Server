import { OpenAI } from "openai";
require("dotenv/config");

interface OrganizationParams {
  id?: string;
  orgId?: string;
  communityType: string;
  context: string;
  hateCategories: string[];
  model: string;
  isPrivate: boolean;
}

interface modelConfigParams {
  orgData: OrganizationParams;
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const protected_characteristics_str = [
  "race",
  "religion",
  "ethnic origin",
  "national origin",
  "sex",
  "disability",
  "sexual orientation",
  "gender identity",
  "body size",
];
const HS_definition =
  "Hate speech is defined as speech that attacks a person or group based on attributes such as race, religion, sexual orientation, or gender."; // Define as needed
const examples = [
  {
    "example input": "You lost! Succer!",
    "example output": ["not hate speech", "", 1],
  },
  {
    "example input": "you hateful sack of flesh",
    "example output": ["not hate speech", "", 1],
  },
  {
    "example input": "“Pick one, kidd,” one nudged. Then, “Choose FA GO TT.”",
    "example output": ["hate speech", "sexual orientation", 1],
  },
  {
    "example input":
      '“Kept being called a "Jew" for no reason.”; "A player on the other team was named Hitler.” “[One player] threatened to get antisemitic if I didnt talk. [They] talked about Jew tunnels.”',
    "example output": ["hate speech", "race", 1],
  },
  {
    "example input":
      "if money was grown on trees women would be dating monkeys oh wait never mind",
    "example output": ["hate speech", "sex", 1],
  },
  {
    "example input":
      "well my dear lgbtq brothers and sisters i do not want to die at the hands of a muslim terrorist and as you are putting my life in danger with your politics i would like to suggest that you all go fuck yourselves",
    "example output": [
      "hate speech",
      ["gender identity", "sexual orientation", "religion"],
      1,
    ],
  },
];
const chain_ot = [
  {
    "example input": "There are Jews and Muslims here",
    "example output": ["not hate speech", "", 1],
    explanation:
      "This is a statement naming people's religions. It is neutral in tone, regadless if it's factually correct or not. So it is not hate speech",
  },
  {
    "example input":
      "There are Jews and Muslims here. Let's watch as they k*ll each other.",
    "example output": ["hate speech", "religion", 1],
    explanation:
      "A neutral statement naming people's religions is followed by an implied suggestion that having those religious beliefs will cause people to fight each other. So it is hate speech",
  },
  {
    "example input":
      "You're saying you're a Sikh? I say turban wearing bin laden",
    "example output": ["hate speech", "religion", 1],
    explanation:
      "Person's religion (Sikhism) is devalued and their religious clothing (turban) is compared to a symbol of terrorism - Osama bin Laned. So it is hate speech",
  },
  {
    "example input": "Queers are welcome here",
    "example output": [
      "not hate speech",
      ["sexual orientation", "gender identity"],
      1,
    ],
    explanation:
      "Statement implies inclusion and acceptance. So it is not hate speech",
  },
  {
    "example input":
      "All those alphabet people should f**k off from here and stop grooming children",
    "example output": [
      "hate speech",
      ["sexual orientation", "gender identity"],
      1,
    ],
    explanation:
      "'alphabet people' is a slang term referring to LGBTQ+ community and is used in a hostile context. Suggestion about hurt children is used to incite hatred against LGBTQ+ people. So it is hate speech",
  },
];

export async function classifyHs(
  message: string | undefined,
  fileContent?: string | undefined,
  config?: {
    id?: string;
    orgId?: string;
    communityType: string;
    context: string;
    hateCategories: string[];
    model: string;
    isPrivate: boolean;
  } | undefined
): Promise<any> {
  const prompt = `
    DEFINITIONS:
    Consider the following definition: '${HS_definition}'.

    INSTRUCTION:
    Using the provided definition of hate speech, classify the following fragment from a chat as either hate speech with respect to one or more of protected characteristics from the following list: '${
      config?.hateCategories || protected_characteristics_str
    }', or not hate speech with respect to the protected characteristics from the following list: '${
    config?.hateCategories
  }'.
    '${config?.context  }'

    OUTPUT:
    The output should only contain 3 elements:
    1) "hate speech" or "not hate speech",
    2) one or more protected characteristic labels from the list: '${
      config?.hateCategories || protected_characteristics_str
    }',
    3) the probability with two decimal points.

    OUTPUT FORMAT:
    ['hate speech', 'sexual orientation', 0.98]

    ${
      examples
        ? `EXAMPLES:\nConsider the following examples: '${examples}'`
        : ""
    }
    ${
      chain_ot
        ? `CHAIN-OF-THOUGHT:\nConsider the following chain-of-thought: '${chain_ot}'`
        : ""
    }

   MESSAGE: ${message || ""} ${fileContent || ""}`.trim();


  try {
    const response = await client.chat.completions.create({
      model: config?.model || "gpt-4-turbo",
      temperature: 0.0,
      messages: [{ role: "user", content: prompt }],
    });


    return response.choices[0].message.content;
  } catch (error: any) {
    console.log(error, "error>>")
    throw new Error(`Error with OpenAI API: ${error.message}`);
  }
}
