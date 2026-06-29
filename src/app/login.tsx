import { useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, BASE_URL } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import { Palette, Radius, Shadow } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useState(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  });

  const submit = async () => {
    setErrorMsg('');
    if (!email || !password) { setErrorMsg('Fill in all fields'); return; }
    if (password.length < 4) { setErrorMsg('Password must be at least 4 characters'); return; }
    setLoading(true);
    const timeout = setTimeout(() => { setLoading(false); setErrorMsg(`Connection timed out at ${BASE_URL}`); }, 8000);
    try {
      const data = await (isRegister ? api.register : api.login)(email, password);
      clearTimeout(timeout);
      await setToken(data.token);
      setUser(data.user);
      router.replace('/home');
    } catch (e: any) {
      clearTimeout(timeout);
      setErrorMsg(e?.message || 'Something went wrong');
    } finally { clearTimeout(timeout); setLoading(false); }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setErrorMsg('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Animated.View style={[styles.brand, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.brandIconWrap}>
            <Text style={styles.brandIcon}>🎨</Text>
          </View>
          <Text style={styles.title}>DrawTogether</Text>
          <Text style={styles.subtitle}>{isRegister ? 'Create your account' : 'Welcome back'}</Text>
        </Animated.View>

        {errorMsg ? (
          <Animated.View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Palette.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={Palette.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Pressable style={[styles.submitBtn, loading && styles.disabled]} onPress={submit} disabled={loading}>
            <Text style={styles.submitText}>
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Log In'}
            </Text>
          </Pressable>

          <Pressable onPress={switchMode} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <Text style={styles.switchAction}>{isRegister ? 'Log in' : 'Register'}</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.serverInfo}>{BASE_URL}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.cardWhite },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },

  brand: { alignItems: 'center', marginBottom: 40 },
  brandIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.purple + '12',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  brandIcon: { fontSize: 32 },
  title: { fontSize: 28, fontWeight: '800', color: Palette.purple, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Palette.textSecondary, marginTop: 8, fontWeight: '500' },

  errorBox: {
    backgroundColor: '#FFF0F0', borderRadius: Radius.md, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#FFD0D0',
  },
  errorText: { color: Palette.error, fontSize: 13, textAlign: 'center', fontWeight: '500' },

  form: { gap: 18 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Palette.textSecondary, marginLeft: 2, letterSpacing: 0.3 },
  input: {
    backgroundColor: Palette.offWhite, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: Palette.border, color: Palette.textPrimary,
  },
  submitBtn: {
    backgroundColor: Palette.purple, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center',
    marginTop: 4, ...Shadow.md,
  },
  disabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  switchBtn: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 6 },
  switchText: { color: Palette.textSecondary, fontSize: 14 },
  switchAction: { color: Palette.purple, fontSize: 14, fontWeight: '700' },

  serverInfo: { textAlign: 'center', fontSize: 9, color: Palette.textMuted, marginTop: 24, letterSpacing: 0.3 },
});
