import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
})

export async function generateSummary(prompt: string) {
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  })

  return res.text
}