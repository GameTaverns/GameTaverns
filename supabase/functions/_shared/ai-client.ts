// Shared AI client for edge functions - Perplexity is the PRIMARY AI provider
// Priority: Perplexity (recommended) > Lovable AI (cloud fallback)
// Note: OpenAI, Anthropic, Google are legacy options - Perplexity is preferred

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

async function safeReadJson(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw || raw.trim().length === 0) {
    throw new Error(`Empty JSON response (status ${response.status})`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid JSON response (status ${response.status}): ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * Get AI provider configuration
 * Priority: PERPLEXITY (recommended) > LOVABLE (cloud fallback) > OpenAI/Anthropic/Google (legacy)
 */
function getAIConfig(): { endpoint: string; apiKey: string; model: string; provider: string } | null {
  // Check for Perplexity (PREFERRED - includes web search, best for game data)
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (perplexityKey) {
    return {
      endpoint: "https://api.perplexity.ai/chat/completions",
      apiKey: perplexityKey,
      model: "sonar",
      provider: "perplexity",
    };
  }

  // Fall back to Lovable AI gateway (for cloud deployments only)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return {
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
      apiKey: lovableKey,
      model: "google/gemini-2.5-flash",
      provider: "lovable",
    };
  }

  // Legacy: OpenAI (if configured)
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: "gpt-4o-mini",
      provider: "openai",
    };
  }

  // Legacy: Anthropic Claude
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    return {
      endpoint: "https://api.anthropic.com/v1/messages",
      apiKey: anthropicKey,
      model: "claude-3-haiku-20240307",
      provider: "anthropic",
    };
  }

  // Legacy: Google AI (Gemini)
  const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (googleKey) {
    return {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      apiKey: googleKey,
      model: "gemini-1.5-flash",
      provider: "google",
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
  if (Deno.env.get("PERPLEXITY_API_KEY")) return "Perplexity (recommended)";
  if (Deno.env.get("LOVABLE_API_KEY")) return "Lovable AI";
  if (Deno.env.get("OPENAI_API_KEY")) return "OpenAI (legacy)";
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "Anthropic Claude (legacy)";
  if (Deno.env.get("GOOGLE_AI_API_KEY")) return "Google Gemini (legacy)";
  return "None";
}

/**
 * Make an AI completion request - handles different provider APIs
 */
export async function aiComplete(options: AIRequestOptions): Promise<AIResponse> {
  const config = getAIConfig();
  
  if (!config) {
    return {
      success: false,
      error: "AI service not configured. Set PERPLEXITY_API_KEY (recommended) or LOVABLE_API_KEY.",
    };
  }

  console.log(`Using AI provider: ${getAIProviderName()}`);

  try {
    // Handle Anthropic's different API format
    if (config.provider === "anthropic") {
      return await anthropicComplete(config, options);
    }

    // Handle Google AI's different API format
    if (config.provider === "google") {
      return await googleComplete(config, options);
    }

    // OpenAI-compatible APIs (OpenAI, Perplexity, Lovable)
    return await openaiCompatibleComplete(config, options);
  } catch (e) {
    console.error("AI request error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "AI request failed",
    };
  }
}

/**
 * OpenAI-compatible completion (OpenAI, Perplexity, Lovable gateway)
 * 
 * IMPORTANT: Perplexity's sonar models do NOT support tool calling.
 * When tools are requested with Perplexity, we convert to response_format with json_schema.
 */
async function openaiCompatibleComplete(
  config: { endpoint: string; apiKey: string; model: string; provider: string },
  options: AIRequestOptions
): Promise<AIResponse> {
  const isPerplexity = config.provider === "perplexity";
  
  const requestBody: Record<string, unknown> = {
    model: options.model || config.model,
    messages: [...options.messages],
  };

  if (options.max_tokens) {
    requestBody.max_tokens = options.max_tokens;
  }

  // Perplexity doesn't support tool calling - convert to response_format with json_schema
  if (isPerplexity && options.tools && options.tools.length > 0) {
    const tool = options.tools[0];
    const schema = tool.function.parameters;
    
    // Modify the system message to explicitly request JSON output
    const messages = requestBody.messages as AIMessage[];
    const systemIdx = messages.findIndex(m => m.role === "system");
    const jsonInstruction = `\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object matching the schema.`;
    
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
    
    // Use Perplexity's response_format with json_schema
    requestBody.response_format = {
      type: "json_schema",
      json_schema: {
        name: tool.function.name,
        schema: schema,
      },
    };
    
    console.log("Perplexity: Using response_format instead of tools for structured output");
  } else {
    // Standard tool calling for other providers
    if (options.tools) {
      requestBody.tools = options.tools;
    }

    if (options.tool_choice) {
      requestBody.tool_choice = options.tool_choice;
    }
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
    return handleErrorResponse(response);
  }

  let data: any;
  try {
    data = await safeReadJson(response);
  } catch (e) {
    console.error("AI JSON parse error:", e);
    return {
      success: false,
      error: "AI service returned an invalid response. Please retry.",
      rateLimited: response.status === 429 || response.status === 402,
    };
  }
  
  // For Perplexity with response_format, parse content as JSON and return as toolCallArguments
  if (isPerplexity && options.tools && options.tools.length > 0) {
    return parsePerplexityJsonResponse(data);
  }
  
  return parseOpenAIResponse(data);
}

/**
 * Anthropic Claude completion
 */
async function anthropicComplete(
  config: { endpoint: string; apiKey: string; model: string },
  options: AIRequestOptions
): Promise<AIResponse> {
  // Convert messages format - Anthropic uses different structure
  const systemMessage = options.messages.find(m => m.role === "system");
  const otherMessages = options.messages.filter(m => m.role !== "system");

  const requestBody: Record<string, unknown> = {
    model: options.model || config.model,
    max_tokens: options.max_tokens || 4096,
    messages: otherMessages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  };

  if (systemMessage) {
    requestBody.system = systemMessage.content;
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return handleErrorResponse(response);
  }

  let data: any;
  try {
    data = await safeReadJson(response);
  } catch (e) {
    console.error("Anthropic JSON parse error:", e);
    return { success: false, error: "AI service returned an invalid response. Please retry." };
  }
  
  // Anthropic returns content as an array
  const content = data.content?.[0]?.text;
  if (content) {
    return { success: true, content };
  }

  return { success: false, error: "Empty response from Anthropic" };
}

/**
 * Google AI (Gemini) completion
 */
async function googleComplete(
  config: { endpoint: string; apiKey: string; model: string },
  options: AIRequestOptions
): Promise<AIResponse> {
  // Google uses a different endpoint format with API key in URL
  const endpoint = `${config.endpoint}?key=${config.apiKey}`;

  // Convert messages to Google's format
  const contents = options.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemMessage = options.messages.find(m => m.role === "system");
  
  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options.max_tokens || 4096,
    },
  };

  if (systemMessage) {
    requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return handleErrorResponse(response);
  }

  let data: any;
  try {
    data = await safeReadJson(response);
  } catch (e) {
    console.error("Google AI JSON parse error:", e);
    return { success: false, error: "AI service returned an invalid response. Please retry." };
  }
  
  // Google returns candidates array
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (content) {
    return { success: true, content };
  }

  return { success: false, error: "Empty response from Google AI" };
}

/**
 * Parse OpenAI-compatible response
 */
function parseOpenAIResponse(data: Record<string, unknown>): AIResponse {
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  if (!choice) {
    return { success: false, error: "No response from AI" };
  }

  const message = choice.message as Record<string, unknown> | undefined;
  
  // Check for tool calls
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

  // Regular content
  const content = message?.content as string | undefined;
  if (content) {
    return { success: true, content };
  }

  return { success: false, error: "Empty response from AI" };
}

/**
 * Parse Perplexity response when using response_format (structured JSON output)
 * Returns the parsed JSON as toolCallArguments for compatibility with existing code
 */
function parsePerplexityJsonResponse(data: Record<string, unknown>): AIResponse {
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  if (!choice) {
    return { success: false, error: "No response from Perplexity" };
  }

  const message = choice.message as Record<string, unknown> | undefined;
  const content = message?.content as string | undefined;
  
  if (!content) {
    return { success: false, error: "Empty response from Perplexity" };
  }

  try {
    // Parse the JSON content - Perplexity returns the JSON directly in content
    const parsed = JSON.parse(content);
    console.log("Perplexity structured output parsed successfully");
    return { success: true, toolCallArguments: parsed };
  } catch (e) {
    console.error("Failed to parse Perplexity JSON response:", e, "Content:", content.slice(0, 500));
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        return { success: true, toolCallArguments: parsed };
      } catch {
        // Fall through to error
      }
    }
    return { success: false, error: "Failed to parse structured response from Perplexity" };
  }
}

/**
 * Handle error responses consistently
 */
async function handleErrorResponse(response: Response): Promise<AIResponse> {
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
