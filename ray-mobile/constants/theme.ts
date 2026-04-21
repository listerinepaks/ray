/** Ray visual identity v1 — aligned with ray-web `index.css` / `visual/identity` */

export const theme = {
  bgPrimary: '#faf7f2',
  bgSecondary: '#f3efe7',
  accentGolden: '#f4c95d',
  accentPeach: '#f2a97b',
  accentDusk: '#a7b7c9',
  textPrimary: '#2f2f2f',
  textSecondary: '#6b6b6b',
  textMuted: '#9a9a9a',
  cardBg: '#ffffff',
  cardBorder: 'rgba(47, 47, 47, 0.08)',
  bannerBg: '#f3efe7',
  bannerBorder: 'rgba(47, 47, 47, 0.1)',
  pillBg: 'rgba(167, 183, 201, 0.35)',
  pillFg: '#2f2f2f',
  error: '#8b4a3a',
} as const;

/** Pass to `fontFamily` after loading with `useFonts` */
export const fonts = {
  sansRegular: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  serifSemi: 'PlayfairDisplay_600SemiBold',
  serifItalic: 'PlayfairDisplay_400Regular_Italic',
} as const;
