import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Verify the Authorization header contains a valid user JWT.
 * Returns the authenticated user or null.
 */
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (authHeader === `Bearer ${anonKey}`) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Return a 401 JSON response.
 */
export function unauthorizedResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Authentication required" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
