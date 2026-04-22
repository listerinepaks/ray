import { fonts } from '@/constants/theme';
import { Text, TextProps } from './Themed';

export function MonoText(props: TextProps) {
  return <Text {...props} style={[props.style, { fontFamily: fonts.sansRegular }]} />;
}
