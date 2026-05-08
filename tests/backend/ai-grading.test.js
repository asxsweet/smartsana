/**
 * ЖИ бағалау: нақты LLM жауабын mock fetch арқылы және кілтсіз fallback маршрутын тексереді.
 */
const mockEnv = {
  grokApiKey: "gsk_test_placeholder",
  grokModel: "llama-3.1-8b-instant",
  aiBaseUrl: "",
};

jest.mock("../../backend/server/src/config/env", () => ({ env: mockEnv }));

const { generateAiGrade } = require("../../backend/server/src/services/ai-grading");

describe("generateAiGrade", () => {
  const video = {
    tasks: [
      { _id: "507f1f77bcf86cd799439011", title: "T1", instruction: "Explain LED", maxScore: 10 },
    ],
  };

  afterEach(() => {
    global.fetch = undefined;
    mockEnv.grokApiKey = "gsk_test_placeholder";
  });

  test("no API key uses heuristic fallback with Kazakh message", async () => {
    mockEnv.grokApiKey = "";
    const result = await generateAiGrade({
      video,
      answers: [{ taskId: "507f1f77bcf86cd799439011", answerText: "Жарықдиод қоректендірілгенде жанып тұрады." }],
      files: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.feedback).toMatch(/AI сервисі|автоматты баға/);
    expect(result.suggestion.length).toBeGreaterThan(5);
  });

  test("parses LLM JSON response and clamps score", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"score": 12, "feedback": "Жақсы жауап", "suggestion": "Diagram қосыңыз"}' } }],
      }),
    }));

    const result = await generateAiGrade({
      video,
      answers: [{ taskId: "507f1f77bcf86cd799439011", answerText: "LED үшін резистор керек." }],
      files: [],
    });

    expect(result.score).toBe(10);
    expect(result.feedback).toContain("Жақсы");
    expect(result.suggestion).toContain("Diagram");
    expect(global.fetch).toHaveBeenCalled();
    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages[1].role).toBe("user");
    expect(typeof body.messages[1].content).toBe("string");
  });

  test("when images attached, sends multimodal content to Groq-compatible API", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"score": 5, "feedback": "Сурет бойынша жақсы көрінеді", "suggestion": "Толықтырыңыз"}' } }],
      }),
    }));

    await generateAiGrade({
      video,
      answers: [{ taskId: "507f1f77bcf86cd799439011", answerText: "See photo" }],
      files: [{ name: "a.png", type: "image/png", url: "https://cdn.example/img.png" }],
    });

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(Array.isArray(body.messages[1].content)).toBe(true);
    expect(body.messages[1].content[0].type).toBe("text");
    expect(body.messages[1].content[1]).toMatchObject({ type: "image_url" });
    expect(body.model).toMatch(/llama|meta-llama|grok|^llama-/i);
  });

  test("invalid JSON from provider falls back to heuristic", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }],
      }),
    }));

    const result = await generateAiGrade({
      video,
      answers: [{ taskId: "507f1f77bcf86cd799439011", answerText: "Answer long enough." }],
      files: [],
    });
    expect(result.feedback).toMatch(/талдау мүмкін болмады|автоматты баға/);
  });
});
