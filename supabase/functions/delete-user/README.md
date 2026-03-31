# Delete User Edge Function

Deletes a user and all their related data (messages, conversations, action_completions, subscriptions, clients row, and auth user).

## Deploy

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref cfnibfxzltxiriqxvvru`
4. Deploy: `supabase functions deploy delete-user`
5. The function URL will be: `https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user`

## Usage

```bash
curl -X POST https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user-jwt>" \
  -d '{"userId": "<user-id>"}'
```
