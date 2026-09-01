import 'server-only';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  system: string;
  messages: AiMessage[];
  temperature?: number;
}

export interface GenerateResult {
  text: string;
}

export interface AiProvider {
  generateText(options: GenerateOptions): Promise<GenerateResult>;
}

function getKey(): string | undefined {
  return process.env.KIMI_API_KEY;
}

export function isAiConfigured(): boolean {
  return Boolean(getKey());
}

function describeKeyProblem(): string | null {
  const key = getKey();
  if (!key || key.trim() === '') return 'KIMI_API_KEY is not set.';
  if (/[•●∙·*]/.test(key)) {
    return 'KIMI_API_KEY appears to be a masked display value; re-copy the real key.';
  }
  for (let i = 0; i < key.length; i += 1) {
    if (key.charCodeAt(i) > 255) {
      return 'KIMI_API_KEY contains a character that cannot be sent in a request header.';
    }
  }
  if (/\s/.test(key)) return 'KIMI_API_KEY contains whitespace.';
  return null;
}

class KimiProvider implements AiProvider {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = (process.env.KIMI_BASE_URL ?? 'https://api.moonshot.ai').replace(/\/$/, '');
    this.model = process.env.KIMI_MODEL ?? 'kimi-latest';
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult> {
    const keyProblem = describeKeyProblem();
    if (keyProblem) throw new Error(keyProblem);

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getKey()}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: options.temperature ?? 0.4,
        messages: [{ role: 'system', content: options.system }, ...options.messages],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown error');
      throw new Error(`Kimi API error (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (json.error?.message) {
      throw new Error(`Kimi API error: ${json.error.message}`);
    }

    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Kimi returned an empty response.');
    return { text };
  }
}

export function getAiProvider(): AiProvider | null {
  if (!isAiConfigured()) return null;
  return new KimiProvider();
}
