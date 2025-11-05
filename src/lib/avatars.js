// Shared avatar configuration for registration and profile flows.

export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg'];
export const ACCEPTED_AVATAR_STRING = ACCEPTED_AVATAR_TYPES.join(',');

export const AVAILABLE_AVATARS = [
  { value: '/avatars/Avatar_Default.png', labelKey: 'registration.avatar_option.default' },
  { value: '/avatars/Avatar_Andrea.png', labelKey: 'registration.avatar_option.andrea' },
  { value: '/avatars/Avatar_Attila.png', labelKey: 'registration.avatar_option.attila' },
  { value: '/avatars/Avatar_Geri.png', labelKey: 'registration.avatar_option.geri' },
  { value: '/avatars/Avatar_Giuliano.png', labelKey: 'registration.avatar_option.giuliano' },
  { value: '/avatars/Avatar_Laura.png', labelKey: 'registration.avatar_option.laura' },
  { value: '/avatars/Avatar_Martin.png', labelKey: 'registration.avatar_option.martin' },
  { value: '/avatars/Avatar_Matyas.png', labelKey: 'registration.avatar_option.matyas' },
  { value: '/avatars/Avatar_Natalia.png', labelKey: 'registration.avatar_option.natalia' },
  { value: '/avatars/Avatar_Ramon.png', labelKey: 'registration.avatar_option.ramon' },
  { value: '/avatars/Avatar_Sofia.png', labelKey: 'registration.avatar_option.sofia' },
  { value: '/avatars/Avatar_Timea.png', labelKey: 'registration.avatar_option.timea' }
];

export const DEFAULT_AVATAR = AVAILABLE_AVATARS[0].value;
