export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

export async function readFirstChunk(stream: ReadableStream<Uint8Array>): Promise<string> {
  const { value } = await stream.getReader().read();
  return new TextDecoder().decode(value ?? new Uint8Array());
}

export function stripStyleTags(html: string): string {
  return html.replace(/<style [^>]*>[\s\S]*?<\/style>/g, "");
}
