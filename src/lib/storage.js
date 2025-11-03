// src/lib/storage.js
// Helpers related to external storage providers (Google Drive uploads).

const uploadEndpoint = import.meta.env.VITE_DRIVE_UPLOAD_ENDPOINT;
const defaultFolderId = import.meta.env.VITE_DRIVE_AVATAR_FOLDER_ID || '';

/**
 * Upload an avatar image to Google Drive through a backend endpoint.
 * The backend is expected to accept multipart/form-data and return a JSON payload
 * with at least an accessible `url` (or `webViewLink`) and the Drive file `id`.
 *
 * @param {File} file - Image file to upload.
 * @param {{ folderId?: string, fileName?: string }} [options]
 * @returns {Promise<{ url: string, driveId: string }>}
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

  const formData = new FormData();
  formData.append('file', file);

  const folderId = options.folderId ?? defaultFolderId;
  if (folderId) {
    formData.append('folderId', folderId);
  }
  if (options.fileName) {
    formData.append('fileName', options.fileName);
  }

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    const error = new Error('upload_failed');
    error.status = response.status;
    error.payload = message;
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error('invalid_upload_response');
  }

  const url = payload.url || payload.webViewLink || payload.webContentLink;
  if (!url) {
    throw new Error('invalid_upload_response');
  }

  return {
    url,
    driveId: payload.driveId || payload.id || ''
  };
}
