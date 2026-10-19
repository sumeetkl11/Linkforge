import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// Prohibited legacy models
const DEPRECATED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-2.0-flash-thinking",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro"
]);

function resolveModelName() {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (configured && !DEPRECATED_MODELS.has(configured)) {
    return configured;
  }
  return DEFAULT_GEMINI_MODEL;
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function normalizeAiPriority(priority) {
  const cleanPriority = String(priority || "").toLowerCase();
  if (cleanPriority === "high") return "High";
  if (cleanPriority === "low") return "Low";
  return "Medium";
}

export const GEMINI_BOT_USER = {
  id: "u-gemini",
  name: "Gemini Copilot",
  email: "gemini@syncforge.io",
  role: "AI Engineering Copilot",
  status: "Online",
  username: "gemini",
  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=gemini-ai",
  avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=gemini-ai",
  commits: 0,
  reviews: 0,
  proficiency: 100,
};

/**
 * Generates a structured Kanban task draft using @google/genai and responseSchema.
 */
export async function generateGeminiTaskDraft({
  prompt,
  title,
  description,
  priority,
  tags,
  members,
}) {
  const ai = getAiClient();
  const memberList = Array.isArray(members) ? members : [];
  const defaultAssigneeId = memberList[0]?.id || "u1";

  if (!ai) {
    throw new Error(
      "GEMINI_API_KEY is missing or not configured on the server."
    );
  }

  const memberSummary =
    memberList
      .slice(0, 20)
      .map(
        (member) =>
          `- ${member.id}: ${member.name} (${member.role || "Developer"})`
      )
      .join("\n") || "- u1: Alex Rivera (Lead Developer)";

  const systemInstruction = `You are SyncForge's AI engineering task architect.
Create or enhance one actionable software engineering task for a Kanban board.
Select the most appropriate assigneeId from the provided team members based on their role.
Always include clear acceptance criteria in the description.`;

  const userPrompt = `Team Members:
${memberSummary}

Current Draft Fields:
- Title: ${title || "(none)"}
- Description: ${description || "(none)"}
- Priority: ${priority || "Medium"}
- Tags: ${(Array.isArray(tags) ? tags : []).join(", ") || "(none)"}

User Task Brief:
${prompt || "Enhance and structure the engineering task from the current fields."}`;

  try {
    const response = await ai.models.generateContent({
      model: resolveModelName(),
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Concise, actionable engineering task title.",
            },
            description: {
              type: Type.STRING,
              description:
                "Detailed technical description including bulleted acceptance criteria.",
            },
            priority: {
              type: Type.STRING,
              description: "Priority level: Low, Medium, or High.",
            },
            tags: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "Up to 4 short technical tags (e.g. Backend, Redis, Security).",
            },
            assigneeId: {
              type: Type.STRING,
              description: "The ID of the recommended assignee from the Team Members list.",
            },
          },
          required: ["title", "description", "priority", "tags", "assigneeId"],
        },
      },
    });

    const rawText = response.text?.trim() || "{}";
    const draft = JSON.parse(rawText);

    return {
      title: String(draft.title || title || "Engineering Task").trim(),
      description: String(draft.description || description || "").trim(),
      priority: normalizeAiPriority(draft.priority || priority),
      tags: Array.isArray(draft.tags)
        ? draft.tags
            .map((t) => String(t).trim())
            .filter(Boolean)
            .slice(0, 6)
        : Array.isArray(tags)
        ? tags
        : ["Engineering"],
      assigneeId: draft.assigneeId
        ? String(draft.assigneeId)
        : defaultAssigneeId,
    };
  } catch (err) {
    console.error("[Gemini Service] Task draft error:", err);
    throw new Error(
      err?.message || "Failed to generate task draft with Gemini."
    );
  }
}

/**
 * Generates an engineering copilot response when @gemini or @ai is mentioned in Chat.
 */
export async function generateChatCopilotReply({
  prompt,
  channelName,
  recentMessages = [],
  senderName = "Developer",
}) {
  const ai = getAiClient();
  if (!ai) {
    return {
      content:
        "⚠️ `GEMINI_API_KEY` is not configured on the server. Please add a valid Gemini API key in Settings > Secrets to enable `@gemini` chat responses.",
      codeSnippet: null,
    };
  }

  const historyContext = recentMessages
    .slice(-10)
    .map((m) => `${m.user?.name || "Teammate"}: ${m.content || ""}`)
    .join("\n");

  const systemInstruction = `You are @gemini (Gemini Copilot), an expert staff software engineer embedded inside the SyncForge developer workspace.
Keep answers concise, high-signal, and tailored to software engineers.
If you provide a code example, put the primary code snippet in the "codeSnippet" field (without markdown backticks) and keep the explanation in "reply".`;

  const contents = `Channel/Context: ${channelName ? `#${channelName}` : "Direct Message"}
Recent Conversation History:
${historyContext || "(No prior messages)"}

Message from ${senderName}:
${prompt}`;

  try {
    const response = await ai.models.generateContent({
      model: resolveModelName(),
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description:
                "Clear, concise engineering response to the teammate.",
            },
            codeSnippet: {
              type: Type.STRING,
              description:
                "Optional standalone code snippet if code was requested or helpful. Leave empty string if no code is needed.",
            },
          },
          required: ["reply"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return {
      content:
        String(parsed.reply || "Here is what I found.").trim(),
      codeSnippet:
        parsed.codeSnippet && String(parsed.codeSnippet).trim().length > 0
          ? String(parsed.codeSnippet).trim()
          : null,
    };
  } catch (err) {
    console.error("[Gemini Service] Chat copilot error:", err);
    return {
      content: `⚠️ Gemini Copilot encountered an error processing your request: ${
        err?.message || "Unknown API error"
      }`,
      codeSnippet: null,
    };
  }
}
