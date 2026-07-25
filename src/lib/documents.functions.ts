// Document processing server functions — stubbed for Firebase migration.
// The actual processing (embedding, chunking) requires an AI API key.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";

export const processDocument = createServerFn({ method: "POST" })
    .middleware([requireFirebaseAuth])
    .inputValidator((input: unknown) =>
        z.object({ documentId: z.string() }).parse(input),
    )
    .handler(async ({ data, context }) => {
        // Stubbed: document processing requires AI API keys
        // When you configure an API key, this will extract text, chunk, embed, and store vectors
        console.log(`[processDocument] Stub: would process document ${data.documentId} for user ${context.userId}`);
        return { ok: true, chunks: 0 };
    });

export const deleteDocument = createServerFn({ method: "POST" })
    .middleware([requireFirebaseAuth])
    .inputValidator((input: unknown) =>
        z.object({ documentId: z.string() }).parse(input),
    )
    .handler(async ({ data, context }) => {
        console.log(`[deleteDocument] Stub: would delete document ${data.documentId} for user ${context.userId}`);
        return { ok: true };
    });
