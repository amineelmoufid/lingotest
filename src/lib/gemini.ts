import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are an expert English language assessor and friendly chatbot.
Your goal is to chat with the user and determine their English proficiency level according to the CEFR scale (A1, A2, B1, B2, C1, C2).
Start by asking them why they want to learn English, and then have a natural conversation.
Ask engaging questions to test their vocabulary, grammar, and comprehension.
Keep your responses relatively short to encourage them to speak more.

When you feel you have enough information to assess their level (usually after 5-8 turns), you should provide the assessment.
To provide the assessment, output a JSON block at the end of your message in the following format:
\`\`\`json
{
  "assessment": "B1",
  "feedback": "Your grammar is good, but you could improve your vocabulary related to professional topics."
}
\`\`\`
Do not output this JSON until you are ready to give the final assessment. Until then, just converse naturally.`;

export async function generateChatResponse(history: { role: 'user' | 'model', content: string }[]) {
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-preview',
    contents: contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    }
  });

  return response.text;
}
