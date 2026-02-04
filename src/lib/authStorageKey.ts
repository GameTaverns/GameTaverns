export function computeAuthStorageKey(apiUrl: string): string {
  try {
    const baseUrl = new URL(apiUrl);

    // Hosted projects use: sb-<projectRef>-auth-token
    const hostedMatch = baseUrl.host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    if (hostedMatch?.[1]) {
      return `sb-${hostedMatch[1]}-auth-token`;
    }

    // Custom domains / same-origin gateways: namespace by host
    const ns = baseUrl.host.replace(/[^a-z0-9]/gi, "_");
    return `sb-${ns}-auth-token`;
  } catch {
    return "sb-local-auth-token";
  }
}
