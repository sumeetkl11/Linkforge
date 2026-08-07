/**
 * Avatar utility — returns a colored-initials SVG data URL for any user name.
 * Used as a consistent fallback when no avatar_url/photo is available.
 * Color is deterministic — same name always gets same color.
 */

// Colors drawn from the existing Syncforge design token palette
const AVATAR_COLORS: [string, string][] = [
  ['#58a6ff', '#00315c'], // primary-container / on-primary
  ['#27a640', '#00320a'], // secondary-container / on-secondary
  ['#c29f38', '#483700'], // tertiary-container / on-tertiary
  ['#7c6ef7', '#1a0050'], // purple accent
  ['#e06c9f', '#4a0020'], // pink accent
  ['#22b8cf', '#003d46'], // cyan accent
  ['#f0833a', '#4a1e00'], // orange accent
  ['#4bcfa0', '#004030'], // teal accent
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns a data URL for a colored circle with the user's initials.
 * The color is deterministic based on the name — same name = same color always.
 */
export function getInitialsAvatar(name: string, size = 40): string {
  const initials = getInitials(name || 'U');
  const [bg, fg] = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  const fontSize = size * 0.38;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size / 2}" fill="${bg}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-weight="700"
      font-size="${fontSize}" fill="${fg}" letter-spacing="0.5">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Resolves the best available avatar URL for a user object.
 * Priority: avatar_url (OAuth photo) > avatar (seed data URL) > initials fallback
 */
export function resolveAvatar(user: { name: string; avatar?: string; avatar_url?: string } | null | undefined): string {
  if (!user) return getInitialsAvatar('?');
  if (user.avatar_url && user.avatar_url.startsWith('http')) return user.avatar_url;
  if (user.avatar && user.avatar.startsWith('http')) return user.avatar;
  return getInitialsAvatar(user.name || 'U');
}
