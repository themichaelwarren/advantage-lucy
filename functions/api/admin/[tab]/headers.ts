/**
 * GET /api/admin/:tab/headers → column headers for a sheet tab.
 */
import { type Env, getCredentials, fetchHeaders } from '../../../lib/sheets';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const tab = params.tab as string;
    const headers = await fetchHeaders(sheetId, tab, email, privateKey);
    return Response.json({ headers });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
