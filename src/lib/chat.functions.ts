// Chat server functions — stubbed for Firebase migration.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";

import { generateOllamaAnswer, DEFAULT_OLLAMA_CONFIG, DocChunk } from "@/lib/ollama-rag";

export type Citation = {
    documentId: string;
    documentName: string;
    page: number | null;
    chunkIndex: number;
    similarity: number;
    snippet: string;
};

const AskInput = z.object({
    conversationId: z.string().nullable().optional(),
    question: z.string().min(1).max(4000),
    documentIds: z.array(z.string()).optional(),
    chunks: z.array(z.object({
        documentId: z.string(),
        documentName: z.string(),
        text: z.string(),
        chunkIndex: z.number(),
    })).optional(),
    ollamaConfig: z.object({
        baseUrl: z.string().optional(),
        model: z.string().optional(),
    }).optional(),
});

export const askQuestion = createServerFn({ method: "POST" })
    .middleware([requireFirebaseAuth])
    .inputValidator((input: unknown) => AskInput.parse(input))
    .handler(async ({ data }) => {
        const config = {
            baseUrl: data.ollamaConfig?.baseUrl || DEFAULT_OLLAMA_CONFIG.baseUrl,
            model: data.ollamaConfig?.model || DEFAULT_OLLAMA_CONFIG.model,
        };

        const chunks: DocChunk[] = data.chunks || [];
        const result = await generateOllamaAnswer(data.question, chunks, config);

        const citations: Citation[] = result.citations.map((c, i) => ({
            documentId: c.documentId,
            documentName: c.documentName,
            page: null,
            chunkIndex: i,
            similarity: 1.0,
            snippet: c.snippet,
        }));

        return {
            conversationId: data.conversationId ?? null,
            answer: result.answer,
            citations,
        };
    });

export const deleteConversation = createServerFn({ method: "POST" })
    .middleware([requireFirebaseAuth])
    .inputValidator((input: unknown) =>
        z.object({ conversationId: z.string() }).parse(input),
    )
    .handler(async ({ data, context }) => {
        console.log(`[deleteConversation] Stub: would delete conversation ${data.conversationId}`);
        return { ok: true };
    });

export const renameConversation = createServerFn({ method: "POST" })
    .middleware([requireFirebaseAuth])
    .inputValidator((input: unknown) =>
        z
            .object({ conversationId: z.string(), title: z.string().min(1).max(120) })
            .parse(input),
    )
    .handler(async ({ data, context }) => {
        console.log(`[renameConversation] Stub: would rename conversation ${data.conversationId}`);
        return { ok: true };
    });
