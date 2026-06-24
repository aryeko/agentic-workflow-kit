const textEncoder = new TextEncoder();

export const encodeRunEnvelope = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));
