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
    if (!actorId) return new Response('Unauthorized', { status: 401 });

    const { data: actorProfile } = await admin.from('profiles').select('role').eq('id', actorId).single();
    if (actorProfile?.role !== 'admin') return new Response('Forbidden', { status: 403 });

    const { email, password, full_name, role = 'viewer' } = await req.json();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });
    if (error) throw error;

    await admin.from('profiles').upsert({
      id: data.user.id,
      full_name,
      role,
      is_active: true
    });

    return Response.json({ id: data.user.id, email, role });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
});
