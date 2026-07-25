// DocBrain RAG Engine powered by Gemini (matching DocBrain_RAG_Google_Colab.ipynb)

export type DocChunk = {
  documentId: string;
  documentName: string;
  text: string;
  chunkIndex: number;
};

// Recursive Character Text Splitter (chunk_size=500, chunk_overlap=100)
export function chunkDocumentText(
  documentId: string,
  documentName: string,
  fullText: string,
  chunkSize = 500,
  overlap = 100
): DocChunk[] {
  const cleanText = fullText.replace(/\r\n/g, "\n").trim();
  if (!cleanText) return [];

  const chunks: DocChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < cleanText.length) {
    let end = Math.min(start + chunkSize, cleanText.length);
    if (end < cleanText.length) {
      const window = cleanText.slice(start, end);
      const lastSpace = window.lastIndexOf(" ");
      const lastNewline = window.lastIndexOf("\n");
      const breakAt = Math.max(lastSpace, lastNewline);
      if (breakAt > chunkSize * 0.4) {
        end = start + breakAt;
      }
    }

    const chunkText = cleanText.slice(start, end).trim();
    if (chunkText.length > 15) {
      chunks.push({
        documentId,
        documentName,
        text: chunkText,
        chunkIndex: chunkIndex++,
      });
    }

    if (end >= cleanText.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

// Simple TF/Keyword Context Matcher for retrieving top k relevant chunks
export function retrieveRelevantChunks(
  question: string,
  chunks: DocChunk[],
  topK = 5
): DocChunk[] {
  if (chunks.length === 0) return [];

  const words = question
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return chunks.slice(0, topK);

  const scored = chunks.map((chunk) => {
    const chunkLower = chunk.text.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (chunkLower.includes(word)) {
        score += 1;
        // extra points for exact word match
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        const matches = chunkLower.match(regex);
        if (matches) score += matches.length;
      }
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Take top K chunks (if none matched keyword score > 0, take first K chunks)
  const top = scored.slice(0, topK).map((s) => s.chunk);
  return top;
}

// Call Gemini API using model from Colab Notebook (gemini-2.5-flash with gemini-1.5-flash fallback)
export async function generateGeminiAnswer(
  question: string,
  relevantChunks: DocChunk[],
  apiKey: string
): Promise<{ answer: string; citations: { documentId: string; documentName: string; snippet: string }[] }> {
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Please configure your API key in Settings.");
  }

  const context = relevantChunks
    .map((c, i) => `[Source ${i + 1} - ${c.documentName}]\n${c.text}`)
    .join("\n\n");

  // Prompt template matching DocBrain_RAG_Google_Colab.ipynb
  const prompt = relevantChunks.length > 0
    ? `Answer ONLY from the supplied context.
If the answer is unavailable, say:
"I couldn't find that in the uploaded documents."

Context:
${context}

Question:
${question}`
    : `No documents were found in the workspace. Reply letting the user know to upload documents first.

Question:
${question}`;

  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorText}`);
      }

      const json = await res.json();
      const textResponse =
        json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error("Empty response received from Gemini model.");
      }

      const citations = relevantChunks.map((c) => ({
        documentId: c.documentId,
        documentName: c.documentName,
        snippet: c.text.slice(0, 180),
      }));

      return {
        answer: textResponse,
        citations,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // if invalid key, don't retry other models
      if (lastError.message.includes("API key not valid") || lastError.message.includes("API_KEY_INVALID")) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Failed to generate response with Gemini.");
}
