import { useEffect, useState } from 'react';
import api from '../api/client';

const PHOTO_BY_NAME = {
  'alex tan': '/avatars/alex.png',
  'mary lim': '/avatars/mary.png',
  'daniel wong': '/avatars/daniel.png',
  'priya nair': '/avatars/priya.png',
  'jamie lee': '/avatars/jamie.png',
};

export function getAvatarPhoto(name) {
  if (!name) return null;
  return PHOTO_BY_NAME[name.trim().toLowerCase()] || null;
}

/**
 * Avatar: uploaded photo (DB) → demo static headshot → emoji fallback.
 * Uploaded photos are fetched with auth via /customers/:id/photo.
 */
export default function PersonAvatar({ name, emoji, photoUrl, photoScopeAgentId, className = '', imgClassName = '' }) {
  const staticPhoto = !photoUrl ? getAvatarPhoto(name) : null;
  const [uploadedSrc, setUploadedSrc] = useState(null);

  useEffect(() => {
    if (!photoUrl) {
      setUploadedSrc(null);
      return undefined;
    }
    let objectUrl;
    let cancelled = false;
    const params = photoScopeAgentId ? { agentId: photoScopeAgentId } : undefined;
    api
      .get(photoUrl, { responseType: 'blob', params })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUploadedSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUploadedSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl, photoScopeAgentId]);

  const photo = uploadedSrc || staticPhoto;

  return (
    <div className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {photo ? <img src={photo} alt={name} className={`w-full h-full object-cover ${imgClassName}`} /> : emoji}
    </div>
  );
}
