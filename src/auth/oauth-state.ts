export type OAuthState = {
  subIndustryId?: string;
};

export function encodeOAuthState(state: OAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeOAuthState(value?: string): OAuthState {
  if (!value) return {};
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return {};
  }
}
