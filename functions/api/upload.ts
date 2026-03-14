/**
 * POST /api/upload — upload a file to R2.
 * Returns { url: "/api/images/<key>" } for the uploaded file.
 */

interface Env {
  POSTERS: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.POSTERS) {
    return Response.json({ error: 'R2 bucket not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'No file found in upload' }, { status: 400 });
    }

    // Generate a unique key: timestamp-originalname
    const ext = file.name.split('.').pop() || 'jpg';
    const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    await env.POSTERS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    return Response.json({
      url: `/api/images/${key}`,
      key,
    });
  } catch (err) {
    console.error('[upload]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
