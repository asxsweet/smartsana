const express = require("express");
const { env } = require("../config/env");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/chat", requireAuth, async (req, res) => {
  const { messages = [], system = "" } = req.body || {};

  if (!env.grokApiKey) {
    return res.status(500).json({ message: "AI key not configured" });
  }

  try {
    const payloadMessages = [];
    if (system) payloadMessages.push({ role: "system", content: system });
    for (const msg of messages) {
      payloadMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content || "",
      });
    }

    const isLikelyGroqKey = env.grokApiKey.startsWith("gsk_");
    const baseUrl =
      env.aiBaseUrl ||
      (isLikelyGroqKey ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions");
    const tryModels = isLikelyGroqKey
      ? [env.grokModel, "llama-3.1-8b-instant", "llama-3.1-70b-versatile"].filter(Boolean)
      : [env.grokModel, "grok-2-latest", "grok-beta"].filter(Boolean);
    let data = null;
    let usedModel = null;
    let lastStatus = 500;
    let lastRawText = "";

    for (const model of tryModels) {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.grokApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          messages: payloadMessages,
        }),
      });

      const raw = await response.text();
      lastRawText = raw;
      data = (() => {
        try {
          return raw ? JSON.parse(raw) : {};
        } catch (_e) {
          return {};
        }
      })();
      lastStatus = response.status;
      if (response.ok) {
        usedModel = model;
        break;
      }
    }

    if (!usedModel) {
      const providerMessage = data?.error?.message || data?.message || lastRawText || "Grok/Groq provider request failed";
      return res.status(502).json({
        message: "AI request failed",
        providerMessage,
        status: lastStatus,
        data,
        provider: isLikelyGroqKey ? "groq" : "xai",
        endpoint: baseUrl,
      });
    }

    const text = data?.choices?.[0]?.message?.content || "Қате орын алды.";
    return res.json({
      content: [{ text }],
      model: usedModel,
    });
  } catch (error) {
    return res.status(500).json({
      message: "AI request error",
      providerMessage: error?.message || "Unexpected server error",
    });
  }
});

module.exports = router;
