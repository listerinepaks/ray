import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RayLogo } from '@/components/RayLogo';
import { useAuth } from '@/contexts/AuthContext';
import { fonts, theme } from '@/constants/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bgPrimary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <RayLogo scale={1.1} />
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              style={styles.input}
              placeholderTextColor={theme.textMuted}
              placeholder="Username"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              style={styles.input}
              placeholderTextColor={theme.textMuted}
              placeholder="Password"
            />
          </View>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void onSubmit()}
            disabled={busy || !username.trim() || !password}
            style={({ pressed }) => [
              styles.primaryBtn,
              (busy || !username.trim() || !password) && styles.primaryBtnDisabled,
              pressed && !(busy || !username.trim() || !password) && { opacity: 0.92 },
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
    marginTop: 28,
    marginBottom: 28,
  },
  form: { gap: 16, marginBottom: 20 },
  field: { gap: 6 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: theme.textSecondary,
  },
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
