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
 * Drop-in avatar: renders a real headshot photo for known people (by name),
 * falling back to the existing emoji for anyone else (e.g. Wei Ling, who has
 * no provided photo). Pass the same size/background/text-size classes you'd
 * have put on the old wrapper div - rounding and centering are handled here.
 */
export default function PersonAvatar({ name, emoji, className = '', imgClassName = '' }) {
  const photo = getAvatarPhoto(name);
  return (
    <div className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {photo ? <img src={photo} alt={name} className={`w-full h-full object-cover ${imgClassName}`} /> : emoji}
    </div>
  );
}
