// src/lib/storage.js
// Helpers related to external storage providers (Google Drive uploads).

const uploadEndpoint = import.meta.env.VITE_DRIVE_UPLOAD_ENDPOINT;
const defaultFolderId = import.meta.env.VITE_DRIVE_AVATAR_FOLDER_ID || '';

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Upload an avatar image to Google Drive through an Apps Script Web App.
 * The endpoint must accept a POST body with `payload=<json>` (URL-encoded)
 * where the JSON includes a Base64-encoded file and respond with `{ id, url }`.
 *
 * @param {File} file - Image file to upload.
 * @param {{ folderId?: string, fileName?: string }} [options]
 * @returns {Promise<{ url: string, driveId: string, direct?: string }>}
 */
export async function uploadAvatarToDrive(file, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('upload_not_supported');
  }
  if (!(file instanceof File)) {
    throw new Error('invalid_file');
  }
  if (!uploadEndpoint) {
    const error = new Error('missing_upload_endpoint');
    error.exposed = true;
    throw error;
  }

  const folderId = options.folderId ?? defaultFolderId;
  const base64 = await fileToBase64(file);
  const payload = {
    base64,
    mimeType: file.type || 'application/octet-stream',
    fileName: options.fileName || file.name || `avatar-${Date.now()}`,
    folderId
  };

  const params = new URLSearchParams();
  params.set('payload', JSON.stringify(payload));
  if (window?.location?.origin) {
    params.set('origin', window.location.origin);
  }

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    const error = new Error('upload_failed');
    error.status = response.status;
    error.payload = message;
    throw error;
  }

  const result = await response.json().catch(() => null);
  if (!result) {
    throw new Error('invalid_upload_response');
  }

  const url = result.direct || result.url || result.webViewLink || result.webContentLink;
  if (!url) {
    throw new Error('invalid_upload_response');
  }

  return {
    url,
    driveId: result.id || result.driveId || '',
    direct: result.direct || result.url || ''
  };
}
