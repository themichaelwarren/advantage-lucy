/**
 * /api/admin/:tab — CRUD operations on sheet tabs.
 * GET  /api/admin/:tab?headers=1 → column headers
 * POST /api/admin/:tab           → create row
 * PUT  /api/admin/:tab           → update row
 * DELETE /api/admin/:tab?id=xxx  → delete row
 */
import {
  type Env, getCredentials,
  fetchHeaders, appendRow, updateRow, deleteRow,
} from '../../lib/sheets';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const tab = params.tab as string;
    const headers = await fetchHeaders(sheetId, tab, email, privateKey);
    return Response.json({ headers });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const tab = params.tab as string;
    const body: any = await request.json();
    const range = await appendRow(sheetId, tab, body.fields, email, privateKey);
    return Response.json({ ok: true, range });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const tab = params.tab as string;
    const body: any = await request.json();
    await updateRow(sheetId, tab, body.id, body.fields, email, privateKey);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const tab = params.tab as string;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id parameter' }, { status: 400 });
    await deleteRow(sheetId, tab, id, email, privateKey);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
