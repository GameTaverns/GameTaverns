// Shared AI client for edge functions - supports Perplexity API for standalone independence
// Falls back to Lovable AI gateway for cloud deployments

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

/**
 * Get AI provider configuration
 * Priority: PERPLEXITY_API_KEY > OPENAI_API_KEY > LOVABLE_API_KEY
 */
function getAIConfig(): { endpoint: string; apiKey: string; model: string } | null {
  // Check for Perplexity (preferred for standalone)
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (perplexityKey) {
    return {
      endpoint: "https://api.perplexity.ai/chat/completions",
      apiKey: perplexityKey,
      model: "sonar", // Good balance of speed and quality
    };
  }

  // Check for OpenAI
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: "gpt-4o-mini",
    };
  }

  // Fall back to Lovable AI gateway (for cloud deployments)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return {
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
      apiKey: lovableKey,
      model: "google/gemini-2.5-flash",
    };
  }

  return null;
}

/**
 * Check if AI is configured
 */
export function isAIConfigured(): boolean {
  return getAIConfig() !== null;
}

/**
 * Get AI provider name for logging
 */
export function getAIProviderName(): string {
  if (Deno.env.get("PERPLEXITY_API_KEY")) return "Perplexity";
  if (Deno.env.get("OPENAI_API_KEY")) return "OpenAI";
  if (Deno.env.get("LOVABLE_API_KEY")) return "Lovable AI";
  return "None";
}

/**
 * Make an AI completion request
 */
export async function aiComplete(options: AIRequestOptions): Promise<AIResponse> {
  const config = getAIConfig();
  
  if (!config) {
    return {
      success: false,
      error: "AI service not configured. Set PERPLEXITY_API_KEY, OPENAI_API_KEY, or LOVABLE_API_KEY.",
    };
  }

  console.log(`Using AI provider: ${getAIProviderName()}`);

  try {
    const requestBody: Record<string, unknown> = {
      model: options.model || config.model,
      messages: options.messages,
    };

    if (options.max_tokens) {
      requestBody.max_tokens = options.max_tokens;
    }

    // Add tools if provided (Perplexity supports OpenAI-compatible tool calling)
    if (options.tools) {
      requestBody.tools = options.tools;
    }
    if (options.tool_choice) {
      requestBody.tool_choice = options.tool_choice;
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API error (${response.status}):`, errorText);

      if (response.status === 429 || response.status === 402) {
        return {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          rateLimited: true,
        };
      }

      return {
        success: false,
        error: `AI request failed: ${response.status}`,
      };
    }

    const data = await response.json();

    // Extract content or tool call
    const choice = data.choices?.[0];
    if (!choice) {
      return {
        success: false,
        error: "No response from AI",
      };
    }

    // Check for tool calls
    const toolCall = choice.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        return {
          success: true,
          toolCallArguments: args,
        };
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
        return {
          success: false,
          error: "Failed to parse AI response",
        };
      }
    }

    // Regular content response
    const content = choice.message?.content;
    if (content) {
      return {
        success: true,
        content,
      };
    }

    return {
      success: false,
      error: "Empty response from AI",
    };
  } catch (e) {
    console.error("AI request error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "AI request failed",
    };
  }
}
