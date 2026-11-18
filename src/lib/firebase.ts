import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Transaction } from '../data';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  monthlyBudget: number;
  hasSetInitialBudget: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function sanitizeDisplayName(
  name?: string | null,
  email?: string | null
): string {
  const fallback = email?.split('@')[0]?.trim() || 'Usuario';
  const raw = (name || fallback).trim();
  const safe = raw.length > 0 ? raw : 'Usuario';
  return safe.slice(0, 100);
}

export function sanitizeTransactionPayload(
  userId: string,
  tx: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
    ? tx.date
    : new Date().toISOString().split('T')[0];

  const payload: Record<string, unknown> = {
    userId,
    amount: Math.min(Math.max(Number(tx.amount) || 1, 1), 1000000000000),
    category: (tx.category || 'Otros').trim().slice(0, 60) || 'Otros',
    date: safeDate,
    icon: (tx.icon || 'Zap').trim().slice(0, 40) || 'Zap',
    type: tx.type === 'income' ? 'income' : 'expense',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (tx.description && tx.description.trim()) {
    payload.description = tx.description.trim().slice(0, 200);
  }
  if (tx.paymentMethod && tx.paymentMethod.trim()) {
    payload.paymentMethod = tx.paymentMethod.trim().slice(0, 60);
  }
  if (tx.observations && tx.observations.trim()) {
    payload.observations = tx.observations.trim().slice(0, 500);
  }

  return payload;
}

export function getAuthErrorMessage(error: unknown): {
  message: string;
  needsEmailProviderSetup?: boolean;
} {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return {
        message:
          'El inicio de sesión con correo y contraseña aún no está habilitado en Firebase Console. Actívalo en Authentication > Sign-in method > Correo electrónico/contraseña o usa Google.',
        needsEmailProviderSetup: true,
      };
    case 'auth/email-already-in-use':
      return {
        message: 'Ya existe una cuenta registrada con este correo electrónico.',
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        message: 'El correo o la contraseña son incorrectos.',
      };
    case 'auth/weak-password':
      return {
        message: 'La contraseña debe tener al menos 6 caracteres.',
      };
    case 'auth/invalid-email':
      return {
        message: 'Por favor ingresa un correo electrónico válido.',
      };
    case 'auth/popup-closed-by-user':
      return {
        message: 'Se cerró la ventana de Google antes de completar el acceso.',
      };
    case 'auth/popup-blocked':
      return {
        message:
          'Tu navegador bloqueó la ventana emergente de Google. Habilita los pop-ups e intenta de nuevo.',
      };
    case 'auth/too-many-requests':
      return {
        message:
          'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.',
      };
    case 'auth/network-request-failed':
      return {
        message: 'Error de conexión. Verifica tu internet e intenta de nuevo.',
      };
    default:
      return {
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo completar la autenticación. Intenta de nuevo.',
      };
  }
}
