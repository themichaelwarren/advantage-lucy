/** Create a Google Doc in the specified folder using the user's OAuth token. */
export async function createDriveDoc(
  title: string,
  folderId: string,
  accessToken: string
): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API error: ${res.status} ${err}`);
  }

  const file = await res.json();
  return file.id;
}
