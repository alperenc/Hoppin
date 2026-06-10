import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { isAuthAvailable, getAuthState, signInWithEmail, signUpWithEmail } from '@/src/lib/auth';

export default function AuthRoute() {
  const router = useRouter();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      try {
        if (!isAuthAvailable) {
          router.replace('/(tabs)');
          return;
        }

        const auth = await getAuthState();
        if (!mounted) return;
        if (auth.user) {
          router.replace('/');
          return;
        }
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    resolve();

    return () => {
      mounted = false;
    };
  }, [router]);

  const submit = async () => {
    setStatus('');
    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password.trim()) {
        setStatus('Email and password are required.');
        setIsSubmitting(false);
        return;
      }

      if (mode === 'signIn') {
        const result = await signInWithEmail(normalizedEmail, password);
        if (result.data.session) {
          router.replace('/');
          return;
        }
        setStatus('Sign in failed. Check your credentials.');
      } else {
        const result = await signUpWithEmail(normalizedEmail, password);
        if (result.data.session) {
          router.replace('/');
          return;
        }
        setStatus('Account created. Check your email to confirm your signup.');
        setMode('signIn');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.wrapper}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === 'signIn' ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.subtitle}>Sign in to sync your feed across devices.</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#64748b"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          autoCapitalize="none"
          placeholder="Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {!!status ? <Text style={styles.status}>{status}</Text> : null}

        <TouchableOpacity style={styles.primary} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.primaryText}>
            {isSubmitting ? 'Working...' : mode === 'signIn' ? 'Sign in' : 'Sign up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => {
            setStatus('');
            setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
          }}
        >
          <Text style={styles.secondaryText}>
            {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have one? Sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#071022',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#071022',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    color: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  status: {
    color: '#f8fafc',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
    textAlign: 'center',
  },
  primary: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: {
    color: '#111827',
    fontWeight: '700',
  },
  secondary: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#38bdf8',
  },
});
