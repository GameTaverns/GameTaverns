// Shared AI client for edge functions — Cortex is the SOLE AI provider
// All AI requests route to the self-hosted Cortex engine at cortex.tzolak.com
// No external AI services (Google, Perplexity, OpenAI, Anthropic) are used.

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIRequestOptions {
  messages: AIMessage[];
  model?: string;
  max_tokens?: number;
  tools?: AITool[];
  tool_choice?: { type: "function"; function: { name: string } };
}

export interface AIResponse {
  success: boolean;
  content?: string;
  toolCallArguments?: Record<string, unknown>;
  error?: string;
  rateLimited?: boolean;
}

const CORTEX_ENDPOINT = "https://cortex.tzolak.com/api/lmstudio";

/**
 * Check if AI is configured — Cortex requires no API key, always available
 */
export function isAIConfigured(): boolean {
  return true;
}

/**
 * Get AI provider name for logging
 */
export function getAIProviderName(): string {
  return "Cortex (self-hosted qwen2.5-14b)";
}

/**
 * Make an AI completion request via Cortex
 */
export async function aiComplete(options: AIRequestOptions): Promise<AIResponse> {
  console.log(`[AI] Using provider: ${getAIProviderName()}`);

  try {
    const wantsStructuredOutput = Boolean(options.tools && options.tools.length > 0);

    const requestBody: Record<string, unknown> = {
      messages: [...options.messages],
    };

    if (options.max_tokens) requestBody.max_tokens = options.max_tokens;

    if (wantsStructuredOutput) {
      // Cortex/LM Studio may not support tool calling — use JSON instruction in prompt
      const tool = options.tools![0];
      const schema = tool.function.parameters;
      const schemaStr = JSON.stringify(schema, null, 2);
      const jsonInstruction =
        `\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object matching this schema:\n${schemaStr}`;

      const messages = requestBody.messages as AIMessage[];
      const systemIdx = messages.findIndex((m) => m.role === "system");

      if (systemIdx >= 0) {
        messages[systemIdx] = {
          ...messages[systemIdx],
          content: messages[systemIdx].content + jsonInstruction,
        };
      } else {
        messages.unshift({
          role: "system",
          content: `You are a data extraction assistant. ${jsonInstruction}`,
        });
      }

      requestBody.messages = messages;
    }

    const response = await fetch(CORTEX_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] Cortex error (${response.status}):`, errorText);

      if (response.status === 429) {
        return { success: false, error: "Rate limit exceeded. Please try again later.", rateLimited: true };
      }

      return { success: false, error: `AI request failed: ${response.status}` };
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      console.error("[AI] JSON parse error:", e);
      return { success: false, error: "AI service returned an invalid response. Please retry." };
    }

    // Parse OpenAI-compatible response
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    if (!choice) {
      return { success: false, error: "No response from Cortex" };
    }

    const message = choice.message as Record<string, unknown> | undefined;

    // Check for tool calls (if Cortex supports them)
    const toolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;
    const toolCall = toolCalls?.[0];
    if (toolCall) {
      const func = toolCall.function as Record<string, unknown> | undefined;
      if (func?.arguments) {
        try {
          const args = JSON.parse(func.arguments as string);
          return { success: true, toolCallArguments: args };
        } catch {
          return { success: false, error: "Failed to parse tool call arguments" };
        }
      }
    }

    const content = message?.content as string | undefined;
    if (!content) {
      return { success: false, error: "Empty response from Cortex" };
    }

    // If structured output was requested via prompt injection, try to parse JSON from content
    if (wantsStructuredOutput) {
      try {
        const parsed = JSON.parse(content);
        return { success: true, toolCallArguments: parsed };
      } catch {
        // Try extracting from code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1].trim());
            return { success: true, toolCallArguments: parsed };
          } catch {
            // Fall through
          }
        }
        return { success: false, error: "Failed to parse structured response from Cortex" };
      }
    }

    return { success: true, content };
  } catch (e) {
    console.error("[AI] Cortex request error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "AI request failed",
    };
  }
}
