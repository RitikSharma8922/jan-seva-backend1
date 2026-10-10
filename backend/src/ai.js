
import express from "express";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

router.post("/priority", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({
        error: "Please provide a complaint description."
      });
    }

    if (description.length > 3000) {
      return res.status(400).json({
        error: "Description must be 3000 characters or less."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is not configured on the server."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `
You are an assistant for a civic complaint management platform.

Analyze this complaint and return ONLY valid JSON with these fields:
{
  "priority": "Low, Medium, or High",
  "priorityReason": "A short reason for the priority",
  "summary": "A short summary of the complaint"
}

Set High for credible immediate safety or serious public-health risks.
Set Medium for significant civic problems needing timely attention.
Set Low for routine issues without an apparent urgent risk.
Do not invent facts. If details are insufficient, use Medium and mention the uncertainty.
This is a recommendation for a human officer, not a final decision.

Complaint description:
${description.trim()}
      `,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text);

    const allowedPriorities = ["Low", "Medium", "High"];

    if (
      !allowedPriorities.includes(result.priority) ||
      typeof result.priorityReason !== "string" ||
      typeof result.summary !== "string"
    ) {
      return res.status(502).json({
        error: "AI returned an unexpected response."
      });
    }

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Gemini AI error:", error.message);

    return res.status(502).json({
      error: "AI analysis failed. Please try again."
    });
  }
});

export default router;
