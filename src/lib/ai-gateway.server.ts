// AI Gateway — placeholder for user's own API key configuration.
// Add your OpenAI or Google AI API key to .env to enable these features.

export const CHAT_MODEL = "gpt-4o-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

export function createAiProvider(_apiKey: string) {
    // Stubbed: configure your own AI provider here
    throw new Error("AI provider not configured. Set OPENAI_API_KEY in your .env file.");
}

export async function embedTexts(_inputs: string[], _apiKey: string): Promise<number[][]> {
    throw new Error("Embedding not configured. Set OPENAI_API_KEY in your .env file.");
}

export async function embedText(_input: string, _apiKey: string): Promise<number[]> {
    throw new Error("Embedding not configured. Set OPENAI_API_KEY in your .env file.");
}
