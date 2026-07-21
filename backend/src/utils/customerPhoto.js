const MAX_PHOTO_BYTES = 512 * 1024;

/**
 * Agent-uploaded client photos are stored in Postgres (customers.avatar_photo)
 * as a data URL string — not on disk — so they survive Render redeploys and
 * stay private to the owning agent.
 */
function parsePhotoInput(input) {
  if (input === null) return { clear: true, value: null };
  if (input === undefined || input === '') return { clear: false, value: undefined };
  if (typeof input !== 'string') return { error: 'Invalid photo format' };

  const match = input.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/i);
  if (!match) return { error: 'Photo must be a JPEG, PNG, or WebP image' };

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) {
    return { error: 'Photo is too large — please use an image under 512 KB after compression' };
  }

  const mime = match[1].toLowerCase() === 'png' ? 'image/png' : match[1].toLowerCase() === 'webp' ? 'image/webp' : 'image/jpeg';
  return { clear: false, value: `data:${mime};base64,${match[2]}` };
}

function photoResponseFromRow(row) {
  if (!row?.avatar_photo) return null;
  const match = row.avatar_photo.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

module.exports = { parsePhotoInput, photoResponseFromRow, MAX_PHOTO_BYTES };
