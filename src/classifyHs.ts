import { OpenAI } from "openai";
require("dotenv/config");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const HS_definition =
  "Hate speech is defined as speech that attacks a person or group based on attributes such as race, religion, sexual orientation, or gender."; // Define as needed

const examples = [
  {
    "example input": "You lost! Succer!",
    "example output": ["not hate speech", [], 1],
  },
  {
    "example input": "you hateful sack of flesh",
    "example output": ["not hate speech", [], 1],
  },
  {
    "example input": "“Pick one, kidd,” one nudged. Then, “Choose FA GO TT.”",
    "example output": ["hate speech", ["sexual orientation"], 1],
  },
  {
    "example input":
      '“Kept being called a "Jew" for no reason.”; "A player on the other team was named Hitler.” “[One player] threatened to get antisemitic if I didnt talk. [They] talked about Jew tunnels.”',
    "example output": ["hate speech", ["race"], 1],
  },
  {
    "example input":
      "if money was grown on trees women would be dating monkeys oh wait never mind",
    "example output": ["hate speech", ["sex"], 1],
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
    "example input": "You lost! Succer!",
    "example output": ["not hate speech", [], 1],
    explanation:
      "This statement expresses frustration and is an insult but does not target any group or individual based on identity. So it is not hate speech.",
  },
  {
    "example input": "You hateful sack of flesh",
    "example output": ["not hate speech", [], 1],
    explanation:
      "The statement is a personal insult but does not target any specific group or individual based on identity. So it is not hate speech.",
  },
  {
    "example input": "“Pick one, kidd,” one nudged. Then, “Choose FA GO TT.”",
    "example output": ["hate speech", ["sexual orientation"], 1],
    explanation:
      "The use of the slur 'FA GO TT' is a direct attack on sexual orientation, intended to demean or insult. So it is hate speech.",
  },
  {
    "example input":
      '“Kept being called a "Jew" for no reason.”; "A player on the other team was named Hitler.” “[One player] threatened to get antisemitic if I didn\'t talk. [They] talked about Jew tunnels.”',
    "example output": ["hate speech", ["race"], 1],
    explanation:
      "The use of antisemitic language, association with Hitler, and threats based on Jewish identity constitute hate speech targeting race and religion.",
  },
  {
    "example input":
      "If money was grown on trees women would be dating monkeys oh wait never mind",
    "example output": ["hate speech", ["sex"], 1],
    explanation:
      "This statement uses stereotypes to demean women by comparing them to animals, which is hate speech based on sex.",
  },
  {
    "example input":
      "Well my dear LGBTQ brothers and sisters, I do not want to die at the hands of a Muslim terrorist, and as you are putting my life in danger with your politics, I would like to suggest that you all go f**k yourselves",
    "example output": [
      "hate speech",
      ["gender identity", "sexual orientation", "religion"],
      [0.97, 0.97, 1],
    ],
    explanation:
      "This statement combines hostility toward the LGBTQ community with derogatory references to religion, specifically Muslims, and assigns blame. It targets multiple identities and is hate speech.",
  },
];

export async function classifyHs({
  config,
  message,
  fileContent,
}: {
  config: {
    id?: string;
    orgId?: string;
    communityType: string;
    context: string;
    protectedCharacteristics: string[];
    model: string;
    isPrivate: boolean;
    languagesUsed: string;
    geography: string;
    safeguardingFocus: string;
  };
  message: string | undefined;

  fileContent?: string | undefined;
}): Promise<any> {
  const prompt = `
    DEFINITIONS:
    Consider the following definition: '${HS_definition}'.

GEOGRAPHIC CONTEXT:
This organization operates in '${
    config?.geography
  }'. Be mindful of **regional interpretations of hate speech** in these locations.

    - If certain terms or expressions are **legally restricted** in these regions, classify them more strictly.  
    - If cultural nuances affect interpretation, adapt accordingly.  
    - Consider regional dialects and multi-language factors ('${
        config?.languagesUsed
      }').

    ORGANIZATION CONTEXT:
    '${config?.context}'
    Safeguarding Focus: '${config?.safeguardingFocus}'

    Protected Characteristics: '${config?.protectedCharacteristics}'


    OUTPUT:
    The output should only contain 3 elements: 
    1) "hate speech" or "not hate speech", 
    2) list of protected characteristic labels from the list: ${
      config?.protectedCharacteristics
    }, 
    3) list of probabilities with two decimal points, one for each protected characteristic.

    OUTPUT FORMAT:
    ['hate speech', ['sexual orientation'], [0.98]]

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
    throw new Error(`Error with OpenAI API: ${error.message}`);
  }
}
