import { handleOAuthCallback } from "../oauth/oauth-callback";

// Supabase's OAuth redirect (and its account-link redirect) lands here.
export const GET = handleOAuthCallback;
