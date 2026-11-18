import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Wallet,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  getAuthErrorMessage,
  sanitizeDisplayName,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { cn } from '../lib/utils';

type AuthMode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    needsEmailProviderSetup?: boolean;
  } | null>(null);

  const handleModeSwitch = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (mode === 'register' && trimmedName.length < 2) {
      setError({ message: 'Por favor ingresa tu nombre (mínimo 2 caracteres).' });
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError({ message: 'Por favor ingresa un correo electrónico válido.' });
      return;
    }
    if (password.length < 6) {
      setError({ message: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        const safeName = sanitizeDisplayName(trimmedName, trimmedEmail);
        await updateProfile(cred.user, { displayName: safeName });

        const profilePath = `users/${cred.user.uid}`;
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cred.user.email || trimmedEmail,
            displayName: safeName,
            monthlyBudget: 0,
            hasSetInitialBudget: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, profilePath);
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', cred.user.uid);
      const profilePath = `users/${cred.user.uid}`;

      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.GET, profilePath);
      }

      if (!snap.exists()) {
        const safeName = sanitizeDisplayName(
          cred.user.displayName,
          cred.user.email
        );
        try {
          await setDoc(userRef, {
            uid: cred.user.uid,
            email: cred.user.email || '',
            displayName: safeName,
            monthlyBudget: 0,
            hasSetInitialBudget: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, profilePath);
        }
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const busy = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen bg-[#0b0b14] text-slate-100 flex items-center justify-center p-6 sm:p-10">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left editorial / value column */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-6 space-y-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
              <Wallet size={22} />
            </div>
            <span className="text-xl font-display font-bold tracking-tight text-white">
              Mi Presupuesto Mensual
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-white tracking-tight leading-[1.1] text-balance">
              Tu dinero en orden, privado y desde cualquier lugar.
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-md">
              Lleva el control de tu presupuesto mensual, registra gastos e ingresos al instante y guarda tus movimientos de forma segura en tu propia cuenta.
            </p>
          </div>

          <div className="space-y-4 pt-2 border-t border-white/[0.06]">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Datos aislados por cuenta
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Solo tú puedes ver y editar tus presupuestos y movimientos financieros.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Inicio limpio en segundos
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Si es tu primera vez, define tu presupuesto base y empieza desde cero.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right authentication card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-6"
        >
          <div className="glass-card rounded-[2rem] p-8 sm:p-10 border border-white/[0.07] shadow-2xl space-y-6">
            {/* Segmented Mode Switch */}
            <div
              role="tablist"
              aria-label="Modo de acceso"
              className="grid grid-cols-2 gap-1.5 p-1.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                disabled={busy}
                onClick={() => handleModeSwitch('login')}
                className={cn(
                  'py-2.5 px-4 rounded-xl text-sm font-display font-semibold transition-all whitespace-nowrap',
                  mode === 'login'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                disabled={busy}
                onClick={() => handleModeSwitch('register')}
                className={cn(
                  'py-2.5 px-4 rounded-xl text-sm font-display font-semibold transition-all whitespace-nowrap',
                  mode === 'register'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Crear cuenta
              </button>
            </div>

            <div>
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {mode === 'login'
                  ? 'Ingresa con tu correo o entra rápido con Google.'
                  : 'Empieza desde cero y guarda tus finanzas en tu cuenta.'}
              </p>
            </div>

            {/* Quick Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full py-3.5 px-5 bg-white hover:bg-slate-100 text-[#0b0b14] rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isGoogleLoading ? (
                <Loader2 size={18} className="animate-spin text-[#0b0b14]" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>Entrar rápido con Google</span>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/[0.07]" />
              <span className="shrink-0 mx-4 text-xs font-medium text-slate-500">
                o con tu correo
              </span>
              <div className="flex-grow border-t border-white/[0.07]" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-semibold text-slate-300 mb-2"
                  >
                    Tu nombre
                  </label>
                  <div className="relative">
                    <User
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Ej. Camila Rojas"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError(null);
                      }}
                      disabled={busy}
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/60 focus:bg-white/[0.05] rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-300 mb-2"
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    disabled={busy}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/60 focus:bg-white/[0.05] rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-slate-300 mb-2"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      mode === 'register' ? 'new-password' : 'current-password'
                    }
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    disabled={busy}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/60 focus:bg-white/[0.05] rounded-2xl py-3.5 pl-11 pr-12 text-sm text-white outline-none transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword
                        ? 'Ocultar contraseña'
                        : 'Mostrar contraseña'
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
                  <AlertCircle
                    size={18}
                    className="text-rose-400 shrink-0 mt-0.5"
                  />
                  <div className="text-xs text-rose-200 leading-relaxed space-y-1">
                    <p>{error.message}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-900/25 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>
                      {mode === 'login' ? 'Ingresando...' : 'Creando cuenta...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta'}
                    </span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
