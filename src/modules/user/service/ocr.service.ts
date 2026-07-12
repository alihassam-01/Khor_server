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
  partialFailures?: Array<{
    imageIndex: number;
    reason: string;
  }>;
}

export class OcrService {
  private readonly ocrSpaceApiKey: string;
  private readonly cfAccountId: string;
  private readonly cfApiToken: string;

  constructor() {
    this.ocrSpaceApiKey = CONFIG.ocrSpace?.apiKey || "";
    this.cfAccountId = CONFIG.cloudflareAi?.accountId || "";
    this.cfApiToken = CONFIG.cloudflareAi?.apiToken || "";
  }

  async extractMenuFromImage(imageBase64: string): Promise<OcrMenuResult> {
    return this.extractMenuFromImages([imageBase64]);
  }

  async extractMenuFromImages(imageBase64Images: string[]): Promise<OcrMenuResult> {
    if (!this.ocrSpaceApiKey) {
      throw new AppError("OCR.Space service not configured", 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    if (!this.cfAccountId || !this.cfApiToken) {
      throw new AppError("Cloudflare AI service not configured", 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    if (!imageBase64Images.length) {
      throw new AppError("Image data required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const results: OcrMenuResult[] = [];
    const partialFailures: Array<{ imageIndex: number; reason: string }> = [];

    // Process images sequentially to respect OCR.Space rate limits
    for (const [index, imageBase64] of imageBase64Images.entries()) {
      try {
        const result = await this.processSingleImage(imageBase64);
        results.push(result);
      } catch (error) {
        partialFailures.push({
          imageIndex: index,
          reason: error instanceof Error ? error.message : "OCR failed for this image",
        });
      }
    }

    if (!results.length) {
      console.error("OCR Extraction Failures:", JSON.stringify(partialFailures, null, 2));
      throw new AppError("Failed to extract menu from any image", 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return this.mergeResults(results, partialFailures);
  }

  private async processSingleImage(imageBase64: string): Promise<OcrMenuResult> {
    // Step 1: Send to OCR.Space
    const ocrData = await this.fetchOcrSpaceData(imageBase64);
    
    // Step 2 & 3: Normalize lines and structure data
    const cleanedText = this.processLayout(ocrData);

    // Step 4 & 5: Cloudflare AI for final JSON
    return await this.callCloudflareAi(cleanedText);
  }

  private async fetchOcrSpaceData(imageBase64: string): Promise<any> {
    let mimeType = "image/jpeg";
    if (imageBase64.startsWith("UklGR")) mimeType = "image/webp";
    else if (imageBase64.startsWith("iVBORw0KGgo")) mimeType = "image/png";

    const formData = new URLSearchParams();
    formData.append("base64image", `data:${mimeType};base64,${imageBase64}`);
    formData.append("language", "eng");
    formData.append("OCREngine", "2");
    formData.append("isTable", "true");
    formData.append("isOverlayRequired", "true");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        "apikey": this.ocrSpaceApiKey,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new AppError(`OCR.Space API error: ${response.status}`, response.status, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    const data = await response.json() as any;
    if (data.IsErroredOnProcessing || !data.ParsedResults || !data.ParsedResults.length) {
      console.error("OCR.Space API Error Response:", JSON.stringify(data, null, 2));
      throw new AppError("OCR.Space failed to process image", 500, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    return data.ParsedResults[0];
  }

  private processLayout(parsedResult: any): string {
    if (!parsedResult.TextOverlay || !parsedResult.TextOverlay.Lines) {
      return parsedResult.ParsedText || "";
    }

    const lines = parsedResult.TextOverlay.Lines.map((line: any) => {
      const left = Math.min(...line.Words.map((w: any) => w.Left));
      const right = Math.max(...line.Words.map((w: any) => w.Left + w.Width));
      return {
        text: line.LineText?.trim() || "",
        left,
        right,
        top: line.MinTop,
        height: line.MaxHeight
      };
    });

    if (!lines.length) return "";

    // Sort by top first
    lines.sort((a: any, b: any) => a.top - b.top);

    // Estimate page width
    const pageWidth = Math.max(...lines.map((l: any) => l.right));
    const pageMiddle = pageWidth / 2;

    const leftColumn = lines.filter((line: any) => line.left < pageMiddle);
    const rightColumn = lines.filter((line: any) => line.left >= pageMiddle);

    leftColumn.sort((a: any, b: any) => a.top - b.top);
    rightColumn.sort((a: any, b: any) => a.top - b.top);

    let layoutText = "=== LEFT COLUMN ===\n";
    leftColumn.forEach((l: any) => layoutText += `${l.text}\n`);
    layoutText += "\n=== RIGHT COLUMN ===\n";
    rightColumn.forEach((l: any) => layoutText += `${l.text}\n`);

    return layoutText;
  }

  private async callCloudflareAi(cleanedOcrData: string): Promise<OcrMenuResult> {
    const prompt = `Convert the supplied restaurant menu OCR data into valid JSON.

Rules:
1. Detect sections by headers where possible.
2. Preserve local dish names exactly.
3. Do not invent items, prices or descriptions.
4. Keep every item inside its supplied section.
5. Convert clear prices into numbers but return them as strings in the "price" field.
6. Extract item name, price, and short note (description) only when present.
7. Return JSON ONLY in this exact shape:

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

No markdown wrappers or commentary. Just raw JSON.`;

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.cfApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: cleanedOcrData }
        ],
        temperature: 0,
        max_tokens: 1800
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new AppError(`Cloudflare AI error: ${response.status} ${errText}`, response.status, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    const data = await response.json() as any;
    if (!data.success || !data.result) {
      console.error("Cloudflare AI API Error Response:", JSON.stringify(data, null, 2));
      throw new AppError("Cloudflare AI failed to generate response", 500, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    // Handle different possible shapes of the Cloudflare AI response
    let content = "";
    if (typeof data.result === 'string') {
      content = data.result;
    } else if (data.result.response && typeof data.result.response === 'string') {
      content = data.result.response;
    } else {
      content = JSON.stringify(data.result);
    }

    return this.parseResponse(content, cleanedOcrData);
  }

  private parseResponse(content: string, rawOcr: string): OcrMenuResult {
    let parsed: any = null;

    const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Cloudflare AI Response Parse Error. Raw content:", content);
      throw new AppError("Invalid JSON response from Cloudflare AI", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    if (parsed && parsed.response && Array.isArray(parsed.response.sections)) {
      parsed = parsed.response;
    }

    if (!parsed || !parsed.sections || !Array.isArray(parsed.sections)) {
      console.error("Cloudflare AI Invalid Structure. Parsed:", JSON.stringify(parsed, null, 2));
      throw new AppError("Invalid response structure from Cloudflare AI", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    const normalizedSections = parsed.sections.map((section: any) => ({
      title: String(section.title || "Main Menu").trim(),
      items: (section.items || []).map((item: any) => ({
        name: String(item.name || "").trim(),
        price: String(item.price || "").trim(),
        note: String(item.note || "").trim(),
      })).filter((item: any) => item.name || item.price),
    })).filter((section: any) => section.items.length > 0);

    if (normalizedSections.length === 0) {
      normalizedSections.push({
        title: "Main Menu",
        items: [{ name: "", price: "", note: "" }],
      });
    }

    return {
      sections: normalizedSections,
      rawText: String(parsed.rawText || rawOcr.slice(0, 500)).trim(),
    };
  }

  private mergeResults(
    results: OcrMenuResult[],
    partialFailures: Array<{ imageIndex: number; reason: string }> = [],
  ): OcrMenuResult {
    const sectionsMap = new Map<string, OcrMenuItem[]>();
    const rawTextParts: string[] = [];

    results.forEach((result) => {
      result.sections.forEach((section) => {
        const title = section.title?.trim() || "Main Menu";
        const existingItems = sectionsMap.get(title) ?? [];
        existingItems.push(...section.items);
        sectionsMap.set(title, existingItems);
      });

      if (result.rawText.trim()) {
        rawTextParts.push(result.rawText.trim());
      }
    });

    const sections = Array.from(sectionsMap.entries()).map(([title, items]) => ({
      title,
      items,
    }));

    return {
      sections: sections.length ? sections : [{ title: "Main Menu", items: [{ name: "", price: "", note: "" }] }],
      rawText: rawTextParts.join("\n").trim(),
      partialFailures,
    };
  }
}

export const ocrService = new OcrService();
