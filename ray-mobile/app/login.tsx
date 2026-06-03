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
type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { user, login, register } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const inviteCodeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  if (user) return null;

  async function onSubmit() {
    setError(null);
    if (authMode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (authMode === 'login') {
        await login(username.trim(), password);
      } else {
        await register({
          username: username.trim(),
          password,
          display_name: displayName.trim(),
          email: email.trim() || undefined,
          invite_code: inviteCode.trim() || undefined,
        });
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : authMode === 'login' ? 'Sign in failed.' : 'Account creation failed.');
    } finally {
      setBusy(false);
    }
  }

  function switchAuthMode(next: AuthMode) {
    setAuthMode(next);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }

  const canSubmit =
    !busy &&
    Boolean(
      username.trim() &&
        password &&
        (authMode === 'login' || (displayName.trim() && confirmPassword)),
    );

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
          <View style={styles.switcher} accessibilityRole="tablist">
            <Pressable
              onPress={() => switchAuthMode('login')}
              accessibilityRole="tab"
              accessibilityState={{ selected: authMode === 'login' }}
              style={[styles.switcherBtn, authMode === 'login' && styles.switcherBtnOn]}>
              <Text style={[styles.switcherText, authMode === 'login' && styles.switcherTextOn]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchAuthMode('register')}
              accessibilityRole="tab"
              accessibilityState={{ selected: authMode === 'register' }}
              style={[styles.switcherBtn, authMode === 'register' && styles.switcherBtnOn]}>
              <Text style={[styles.switcherText, authMode === 'register' && styles.switcherTextOn]}>
                Create account
              </Text>
            </Pressable>
          </View>

          {authMode === 'register' ? (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => usernameRef.current?.focus()}
              accessibilityLabel="Display name"
              style={styles.input}
              placeholderTextColor={theme.textMuted}
              placeholder="Display name"
            />
          ) : null}
          <TextInput
            ref={usernameRef}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (authMode === 'register') emailRef.current?.focus();
              else passwordRef.current?.focus();
            }}
            accessibilityLabel="Username"
            style={styles.input}
            placeholderTextColor={theme.textMuted}
            placeholder="Username"
          />
          {authMode === 'register' ? (
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
              style={styles.input}
              placeholderTextColor={theme.textMuted}
              placeholder="Email"
            />
          ) : null}
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={authMode === 'register' ? 'newPassword' : 'password'}
            returnKeyType={authMode === 'register' ? 'next' : 'go'}
            onSubmitEditing={() => {
              if (authMode === 'register') confirmPasswordRef.current?.focus();
              else if (canSubmit) void onSubmit();
            }}
            accessibilityLabel="Password"
            style={styles.input}
            placeholderTextColor={theme.textMuted}
            placeholder="Password"
          />
          {authMode === 'register' ? (
            <>
              <TextInput
                ref={confirmPasswordRef}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => inviteCodeRef.current?.focus()}
                accessibilityLabel="Confirm password"
                style={styles.input}
                placeholderTextColor={theme.textMuted}
                placeholder="Confirm password"
              />
              <TextInput
                ref={inviteCodeRef}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) void onSubmit();
                }}
                accessibilityLabel="Invite code"
                style={styles.input}
                placeholderTextColor={theme.textMuted}
                placeholder="Invite code"
              />
            </>
          ) : null}
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
              <Text style={styles.primaryBtnText}>
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const primaryBtnShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)' },
  default: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});

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
  switcher: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.bgSecondary,
  },
  switcherBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  switcherBtnOn: {
    backgroundColor: theme.cardBg,
    ...primaryBtnShadow,
  },
  switcherText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: theme.textSecondary,
  },
  switcherTextOn: {
    color: theme.textPrimary,
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
    ...primaryBtnShadow,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: theme.textPrimary,
  },
});
