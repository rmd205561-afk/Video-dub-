import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function translateVideo(videoBase64: string, mimeType: string, targetLanguage: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Please watch this video and provide a highly accurate translation of all spoken content into ${targetLanguage}.
    Format the output as a clear transcript with timestamps if possible.
    If there is text on screen, translate that as well.
    Ensure the translation is natural and culturally appropriate.
  `;

  const result = await ai.models.generateContent({
    model: model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: videoBase64
            }
          }
        ]
      }
    ]
  });

  return result.text;
}
