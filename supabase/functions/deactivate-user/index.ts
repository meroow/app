import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRole);

    const token = authHeader.replace('Bearer ', '');
    const { data: claim } = await admin.auth.getUser(token);
    const actorId = claim.user?.id;
    const { data: actorProfile } = await admin.from('profiles').select('role').eq('id', actorId).single();
    if (actorProfile?.role !== 'admin') return new Response('Forbidden', { status: 403 });

    const { user_id, is_active = false } = await req.json();
    const { error } = await admin.from('profiles').update({ is_active }).eq('id', user_id);
    if (error) throw error;

    return Response.json({ user_id, is_active });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
});
