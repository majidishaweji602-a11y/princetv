export const BRAND = 'STARR FLIX';
export const DEV = 'SANCHO TECH';
export const SOCIALS = {
  youtube: 'https://www.youtube.com/@SanchoTech',
  tiktok: 'https://www.tiktok.com/@sancho.tech.zw',
  facebook: 'https://www.facebook.com/sancho.tech.zw',
  instagram: 'https://www.instagram.com/sancho_tech_zw',
  whatsapp: 'https://wa.me/263780325289',
};
export const CONTACT_EMAIL = 'sanchotech7@gmail.com';

export const CATEGORY_ICONS: Record<string, { icon: string; label: string }> = {
  movies: { icon: '🎬', label: 'Movies' },
  sports: { icon: '⚽', label: 'Sports' },
  news: { icon: '📰', label: 'News' },
  music: { icon: '🎵', label: 'Music' },
  entertainment: { icon: '🎉', label: 'Entertainment' },
  documentary: { icon: '📚', label: 'Documentary' },
  comedy: { icon: '😂', label: 'Comedy' },
  kids: { icon: '🧸', label: 'Kids' },
  education: { icon: '📖', label: 'Education' },
  business: { icon: '💼', label: 'Business' },
  travel: { icon: '✈️', label: 'Travel' },
  science: { icon: '🔬', label: 'Science' },
  lifestyle: { icon: '✨', label: 'Lifestyle' },
};
export const MAIN_CATEGORY_IDS = Object.keys(CATEGORY_ICONS);
export const catIcon = (id: string) => CATEGORY_ICONS[id]?.icon ?? '📺';
