import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RayLogo } from '@/components/RayLogo';
import { useAuth } from '@/contexts/AuthContext';
import { fonts, theme } from '@/constants/theme';

/** Matches `RayLogo` default base height × scale */
const LOGIN_LOGO_SCALE = 1.1;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  if (user) return null;

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && Boolean(username.trim() && password);

  const scrollPadTop = Math.max(insets.top, 16);
  /** Push the wordmark clearly below the status bar; scales on taller phones */
  const brandMarginTop = Math.round(
    Math.min(140, Math.max(72, windowHeight * 0.11 + 36)),
  );
  const brandMarginBottom = 28;
  /** Fixed breathing room under the logo (avoid half-screen math that stranded the form). */
  const formMarginTop = 36;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bgPrimary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            flexGrow: 1,
            minHeight: windowHeight,
            paddingTop: scrollPadTop,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.brand,
            { marginTop: brandMarginTop, marginBottom: brandMarginBottom },
          ]}>
          <RayLogo scale={LOGIN_LOGO_SCALE} />
        </View>

        <View style={[styles.form, { marginTop: formMarginTop }]}>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel="Username"
            style={styles.input}
            placeholderTextColor={theme.textMuted}
            placeholder="Username"
          />
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (canSubmit) void onSubmit();
            }}
            accessibilityLabel="Password"
            style={styles.input}
            placeholderTextColor={theme.textMuted}
            placeholder="Password"
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canSubmit && styles.primaryBtnDisabled,
              pressed && canSubmit && { opacity: 0.92 },
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.textPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  brand: {
    alignItems: 'center',
  },
  form: { gap: 16, marginBottom: 20 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(47, 47, 47, 0.12)',
    backgroundColor: theme.cardBg,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    color: theme.textPrimary,
  },
  error: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: theme.error,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: theme.accentGolden,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: theme.textPrimary,
  },
});
