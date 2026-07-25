// Text extraction + chunking for the RAG pipeline. Runs only on the server.

export type Chunk = { content: string; page: number | null; index: number };

export async function extractText(
    bytes: ArrayBuffer,
    mime: string,
    filename: string,
): Promise<{ text: string; pages: string[] | null }> {
    const lower = (filename || "").toLowerCase();
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
        const { extractText: unpdfExtract, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(bytes));
        const { text } = await unpdfExtract(pdf, { mergePages: false });
        const pages = Array.isArray(text) ? text : [String(text)];
        return { text: pages.join("\n\n"), pages };
    }
    // txt, md, csv, and unknown fall back to UTF-8 decode
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { text, pages: null };
}

// Simple recursive chunker: ~1000 chars, 150 overlap, sentence-aware.
export function chunkText(
    input: { text: string; pages: string[] | null },
    opts: { size?: number; overlap?: number } = {},
): Chunk[] {
    const size = opts.size ?? 1000;
    const overlap = opts.overlap ?? 150;

    const source: { text: string; page: number | null }[] = input.pages
        ? input.pages.map((t, i) => ({ text: t, page: i + 1 }))
        : [{ text: input.text, page: null }];

    const chunks: Chunk[] = [];
    let running = 0;
    for (const { text, page } of source) {
        const clean = text.replace(/\r/g, "").trim();
        if (!clean) continue;
        let start = 0;
        while (start < clean.length) {
            let end = Math.min(start + size, clean.length);
            // try to break on paragraph or sentence
            if (end < clean.length) {
                const window = clean.slice(start, end);
                const lastPara = window.lastIndexOf("\n\n");
                const lastSent = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
                const breakAt = lastPara > size * 0.5 ? lastPara : lastSent > size * 0.5 ? lastSent + 1 : -1;
                if (breakAt > 0) end = start + breakAt;
            }
            const piece = clean.slice(start, end).trim();
            if (piece.length > 20) {
                chunks.push({ content: piece, page, index: running++ });
            }
            if (end >= clean.length) break;
            start = Math.max(end - overlap, start + 1);
        }
    }
    return chunks;
}
