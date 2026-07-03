import { CONFIG } from "@config/config";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

export interface OcrMenuItem {
  name: string;
  price: string;
  note: string;
}

export interface OcrMenuSection {
  title: string;
  items: OcrMenuItem[];
}

export interface OcrMenuResult {
  sections: OcrMenuSection[];
  rawText: string;
}

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: "json_object" };
  max_tokens?: number;
  temperature?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OcrService {
  private static readonly REQUEST_TIMEOUT_MS = 45_000;
  private static readonly MAX_TOKENS = 1200;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly primaryModel: string;
  private readonly fallbackModels: string[];

  constructor() {
    this.apiKey = CONFIG.openrouter.apiKey;
    this.baseUrl = CONFIG.openrouter.baseUrl;
    this.primaryModel = CONFIG.openrouter.ocrPrimaryModel;
    this.fallbackModels = CONFIG.openrouter.ocrFallbackModels;
  }

  async extractMenuFromImage(imageBase64: string): Promise<OcrMenuResult> {
    if (!this.apiKey) {
      throw new AppError("OCR service not configured", 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    const prompt = this.buildPrompt();
    const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

    try {
      return await this.callModel(this.primaryModel, prompt, imageUrl);
    } catch (primaryError) {
      console.warn(`Primary OCR model (${this.primaryModel}) failed, trying fallbacks:`, primaryError);
      const errors: Array<{ model: string; error: unknown }> = [];

      for (const model of this.fallbackModels) {
        try {
          return await this.callModel(model, prompt, imageUrl);
        } catch (fallbackError) {
          errors.push({ model, error: fallbackError });
          console.warn(`OCR fallback model (${model}) failed:`, fallbackError);
        }
      }

      console.error("All OCR models failed:", errors);
      throw new AppError("Both OCR models unavailable", 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  private buildPrompt(): string {
    return `Extract this restaurant menu image into compact JSON. Return ONLY valid JSON in this exact shape:

{
  "sections": [
    {
      "title": "Section name",
      "items": [
        { "name": "Item name", "price": "Numeric price as string", "note": "Short optional note" }
      ]
    }
  ],
  "rawText": "Short OCR text summary"
}

Rules:
- Detect sections by headers where possible
- Extract item name, price, and short note only when present
- Normalize prices to digits only, without currency symbols
- If no clear section exists, use "Main Menu"
- Keep rawText concise
- Return JSON only, with no markdown or commentary`;
  }

  private async callModel(model: string, prompt: string, imageUrl: string): Promise<OcrMenuResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OcrService.REQUEST_TIMEOUT_MS);
    const messages: OpenRouterMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ];

    const requestBody: OpenRouterRequest = {
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: OcrService.MAX_TOKENS,
      temperature: 0.1,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://khor.com",
          "X-Title": "Khor Partner Portal OCR",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(`OpenRouter API error: ${response.status} ${errorText}`, 502, ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      const data = await response.json() as OpenRouterResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new AppError("Empty response from OCR model", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      return this.parseResponse(content);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError(`OCR model timed out after ${OcrService.REQUEST_TIMEOUT_MS / 1000}s`, 504, ErrorCodes.INTERNAL_SERVER_ERROR);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(content: string): OcrMenuResult {
    let parsed: { sections: OcrMenuSection[]; rawText: string };

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError("Invalid JSON response from OCR model", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new AppError("Invalid response structure from OCR model", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    const normalizedSections = parsed.sections.map((section) => ({
      title: String(section.title || "Main Menu").trim(),
      items: (section.items || []).map((item) => ({
        name: String(item.name || "").trim(),
        price: String(item.price || "").trim(),
        note: String(item.note || "").trim(),
      })).filter((item) => item.name || item.price),
    })).filter((section) => section.items.length > 0);

    if (normalizedSections.length === 0) {
      normalizedSections.push({
        title: "Main Menu",
        items: [{ name: "", price: "", note: "" }],
      });
    }

    return {
      sections: normalizedSections,
      rawText: String(parsed.rawText || "").trim(),
    };
  }
}

export const ocrService = new OcrService();
