const { env } = require("../config/env");

function extractText(responseData) {
  return responseData?.choices?.[0]?.message?.content || "";
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function normalizeShortText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function toFriendlyFeedback(text) {
  const raw = normalizeShortText(text);
  if (!raw) return "Жауап бар, бірақ талапқа сай толықтыру керек.";
  const harshPatterns = [
    /қатаң/gi,
    /жаман/gi,
    /өте әлсіз/gi,
    /дұрыс емес/gi,
  ];
  const containsHarsh = harshPatterns.some((p) => p.test(raw));
  if (containsHarsh || raw.length < 8) {
    return "Жауапты сәл нақтылап, тапсырма талабына сай дәлел қосыңыз.";
  }
  return raw;
}

async function requestAi(messages) {
  if (!env.grokApiKey) return null;

  const isLikelyGroqKey = env.grokApiKey.startsWith("gsk_");
  const baseUrl =
    env.aiBaseUrl ||
    (isLikelyGroqKey ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions");
  const tryModels = isLikelyGroqKey
    ? [env.grokModel, "llama-3.1-8b-instant", "llama-3.1-70b-versatile"].filter(Boolean)
    : [env.grokModel, "grok-2-latest", "grok-beta"].filter(Boolean);

  for (const model of tryModels) {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.grokApiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages,
      }),
    });

    if (!response.ok) continue;
    const data = await response.json().catch(() => ({}));
    return extractText(data);
  }

  return null;
}

function buildFallbackGrade({ totalMaxScore, answerRows, reason }) {
  const nonEmptyAnswers = answerRows.filter((row) => row.answerText.length > 0);
  const meaningfulAnswers = answerRows.filter((row) => row.answerText.length >= 8);
  const completionRatio = answerRows.length ? nonEmptyAnswers.length / answerRows.length : (nonEmptyAnswers.length ? 1 : 0);
  const baseScore = Math.round(totalMaxScore * completionRatio * 0.6 * 10) / 10;
  const minimumForMeaningful = meaningfulAnswers.length > 0 ? 1 : 0;
  const score = Math.max(minimumForMeaningful, Math.min(totalMaxScore, baseScore));
  const isProviderIssue = reason === "provider_unavailable";
  return {
    score,
    feedback: isProviderIssue
      ? "AI сервисі уақытша қолжетімсіз, сондықтан алдын ала автоматты баға қойылды."
      : "AI жауабын талдау мүмкін болмады, сондықтан алдын ала автоматты баға қойылды.",
    suggestion: meaningfulAnswers.length > 0
      ? "Негізгі ойыңызды қысқа дәлелмен және нақты мысалмен толықтырыңыз."
      : "Тапсырма талабын тармақ бойынша толық жазып шығыңыз.",
  };
}

async function generateAiGrade({ video, answers = [] }) {
  const tasks = (video?.tasks || []).map((task) => ({
    id: String(task?._id || ""),
    title: String(task?.title || ""),
    instruction: String(task?.instruction || ""),
    maxScore: Number(task?.maxScore || 0),
  }));
  const totalMaxScore = tasks.reduce((sum, task) => sum + task.maxScore, 0);

  const answerRows = answers.map((answer) => ({
    taskId: String(answer?.taskId || ""),
    answerText: String(answer?.answerText || "").trim(),
  }));
  if (!tasks.length || totalMaxScore <= 0) {
    return {
      score: 0,
      feedback: "Бұл сабақта бағаланатын тапсырма табылмады, алдын ала баға 0 қойылды.",
      suggestion: "Мұғалім тапсырма критерийін қосқаннан кейін қайта тапсырыңыз.",
    };
  }

  const system = [
    "Сен мұғалім ассистентісің.",
    "Бағалау тілі тек қазақша болсын.",
    "Сыпайы және қолдаушы стильде жаз.",
    "Кемсіту, дөрекі, түсініксіз тіркестер қолданба.",
    "Студент бос емес жауап берген болса, автоматты түрде 0 қоймауға тырыс.",
    "Тек JSON қайтарасың.",
  ].join(" ");
  const user = [
    "Төмендегі форматтан АШЫҚ JSON қайтар:",
    '{"score": number, "feedback": string, "suggestion": string}',
    `score: 0-${totalMaxScore} аралығы`,
    "feedback: 1 қысқа, сыпайы сөйлем (қазақша)",
    "suggestion: 1 қысқа нақты кеңес (қай жерін дамыту/өзгерту керек)",
    "",
    "Тапсырмалар:",
    JSON.stringify(tasks),
    "",
    "Студент жауаптары:",
    JSON.stringify(answerRows),
  ].join("\n");

  if (!env.grokApiKey) {
    return buildFallbackGrade({ totalMaxScore, answerRows, reason: "provider_unavailable" });
  }

  try {
    const raw = await requestAi([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    if (!raw) return buildFallbackGrade({ totalMaxScore, answerRows, reason: "provider_unavailable" });

    const parsed = safeJsonParse(raw.trim());
    if (!parsed || typeof parsed !== "object") {
      return buildFallbackGrade({ totalMaxScore, answerRows, reason: "invalid_ai_payload" });
    }

    const numericScore = Number(parsed.score);
    const clampedScore = Number.isFinite(numericScore)
      ? Math.max(0, Math.min(totalMaxScore, Math.round(numericScore * 10) / 10))
      : null;
    const feedback = toFriendlyFeedback(parsed.feedback);
    const suggestion = normalizeShortText(parsed.suggestion);
    const hasMeaningfulAnswer = answerRows.some((row) => row.answerText.length >= 8);

    let finalScore = clampedScore;
    if (hasMeaningfulAnswer && Number.isFinite(finalScore) && finalScore === 0) {
      finalScore = Math.min(totalMaxScore, 1);
    }
    if (finalScore === null) {
      return buildFallbackGrade({ totalMaxScore, answerRows, reason: "invalid_ai_payload" });
    }
    return {
      score: finalScore,
      feedback: feedback || "Жауап бар, бірақ талапқа сай толықтыру керек.",
      suggestion: suggestion || "Жауапты нақтырақ дәлелдермен толықтыр.",
    };
  } catch (_error) {
    return buildFallbackGrade({ totalMaxScore, answerRows, reason: "provider_unavailable" });
  }
}

module.exports = { generateAiGrade };
