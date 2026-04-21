import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify the requesting user via Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Allow self-deletion or admin deletion
    // (For now, allow any authenticated user — restrict to admin roles later)

    // 1. Delete messages for all conversations belonging to this user
    const { data: conversations, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('client_id', userId)

    if (convErr) {
      console.error('Error fetching conversations:', convErr.message)
    }

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((c: { id: string }) => c.id)
      const { error: msgErr } = await supabaseAdmin.from('messages').delete().in('conversation_id', conversationIds)
      if (msgErr) console.error('Error deleting messages:', msgErr.message)
    }

    // 2. Delete conversations
    const { error: convDelErr } = await supabaseAdmin.from('conversations').delete().eq('client_id', userId)
    if (convDelErr) console.error('Error deleting conversations:', convDelErr.message)

    // 3. Delete action_completions
    const { error: actErr } = await supabaseAdmin.from('action_completions').delete().eq('client_id', userId)
    if (actErr) console.error('Error deleting action_completions:', actErr.message)

    // 4. Delete subscriptions
    const { error: subErr } = await supabaseAdmin.from('subscriptions').delete().eq('client_id', userId)
    if (subErr) console.error('Error deleting subscriptions:', subErr.message)

    // 5. Get client email before deleting (needed to find auth user if IDs mismatch)
    const { data: clientRow } = await supabaseAdmin.from('clients').select('email').eq('id', userId).single()
    const clientEmail = clientRow?.email

    // 6. Delete client row
    const { error: clientErr } = await supabaseAdmin.from('clients').delete().eq('id', userId)
    if (clientErr) console.error('Error deleting client:', clientErr.message)
    // Also delete by email in case of ID mismatch
    if (clientEmail) {
      await supabaseAdmin.from('clients').delete().eq('email', clientEmail)
    }

    // 7. Delete staff row if exists (for team members)
    const { error: staffErr } = await supabaseAdmin.from('staff').delete().eq('id', userId)
    if (staffErr) console.error('Error deleting staff:', staffErr.message)
    if (clientEmail) {
      await supabaseAdmin.from('staff').delete().eq('email', clientEmail)
    }

    // 8. Delete push tokens (best-effort — table may not exist yet)
    try {
      await supabaseAdmin.from('push_tokens').delete().eq('user_id', userId)
    } catch { /* ignore */ }

    // 9. Delete auth user — try by ID first, then look up by email
    let { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteAuthError && clientEmail) {
      // ID didn't match auth user — find auth user by email
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
      const authUser = authList?.users?.find((u: any) => u.email === clientEmail)
      if (authUser) {
        const result = await supabaseAdmin.auth.admin.deleteUser(authUser.id)
        deleteAuthError = result.error
      }
    }
    if (deleteAuthError) {
      return new Response(
        JSON.stringify({ error: `Auth deletion failed: ${deleteAuthError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
