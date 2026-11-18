/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Transaction,
  buildCurrentMonthDailyExpenses,
} from './data';
import { SummaryCard, ProgressIndicator } from './components/Summary';
import { ExpensesChart } from './components/ExpensesChart';
import { MovementList } from './components/MovementList';
import { AuthScreen } from './components/AuthScreen';
import { BudgetOnboarding } from './components/BudgetOnboarding';
import { AssistantDrawer } from './components/AssistantDrawer';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeDisplayName,
  sanitizeTransactionPayload,
  UserProfile,
} from './lib/firebase';
import {
  Plus,
  History as HistoryIcon,
  LayoutDashboard,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Calendar,
  CreditCard,
  MessageSquare,
  Sparkles,
  LogOut,
  Trash2,
  Loader2,
  Wallet,
} from 'lucide-react';
import { cn } from './lib/utils';

type View =
  | 'dashboard'
  | 'history'
  | 'detail'
  | 'register_expense'
  | 'register_income';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setUserProfile(null);
        setProfileExists(false);
        setProfileLoaded(false);
        setTransactions([]);
        setTransactionsLoaded(false);
        setSelectedTransaction(null);
        setCurrentView('dashboard');
        setIsAssistantOpen(false);
      } else {
        setProfileLoaded(false);
        setTransactionsLoaded(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to authenticated user's profile document
  useEffect(() => {
    if (!authReady || !user) return;

    const profilePath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
          setProfileExists(true);
        } else {
          setUserProfile(null);
          setProfileExists(false);
        }
        setProfileLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, profilePath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  // Listen to authenticated user's private transactions
  useEffect(() => {
    if (!authReady || !user) return;

    const txPath = `users/${user.uid}/transactions`;
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Transaction[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt as Timestamp | undefined;
          return {
            id: docSnap.id,
            userId: data.userId,
            amount: Number(data.amount) || 0,
            category: String(data.category || 'Otros'),
            date: String(data.date || ''),
            icon: String(data.icon || 'Zap'),
            type: data.type === 'income' ? 'income' : 'expense',
            description: data.description,
            paymentMethod: data.paymentMethod,
            observations: data.observations,
            createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : 0,
          };
        });

        items.sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.createdAtMs || 0) - (a.createdAtMs || 0);
        });

        setTransactions(items);
        setTransactionsLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, txPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSaveInitialBudget = async (budget: number) => {
    if (!user) return;
    const safeBudget = Math.min(Math.max(Math.round(budget), 0), 1000000000000);
    const profilePath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    try {
      if (profileExists) {
        await updateDoc(userRef, {
          monthlyBudget: safeBudget,
          hasSetInitialBudget: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: sanitizeDisplayName(user.displayName, user.email),
          monthlyBudget: safeBudget,
          hasSetInitialBudget: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast('Presupuesto mensual configurado.');
    } catch (error) {
      handleFirestoreError(
        error,
        profileExists ? OperationType.UPDATE : OperationType.CREATE,
        profilePath
      );
    }
  };

  const handleBudgetChange = async (newBudget: number) => {
    if (!user) return;
    const safeBudget = Math.min(Math.max(Math.round(newBudget), 0), 1000000000000);
    const profilePath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        monthlyBudget: safeBudget,
        updatedAt: serverTimestamp(),
      });
      showToast('Presupuesto mensual actualizado.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
    }
  };

  const handleAddTransaction = async (
    newTransaction: Omit<Transaction, 'id'>
  ) => {
    if (!user) return;
    const txPath = `users/${user.uid}/transactions`;
    try {
      const payload = sanitizeTransactionPayload(user.uid, newTransaction);
      await addDoc(collection(db, 'users', user.uid, 'transactions'), payload);

      showToast(
        `${
          newTransaction.type === 'income' ? 'Ingreso' : 'Gasto'
        } registrado correctamente.`
      );

      if (
        currentView === 'register_expense' ||
        currentView === 'register_income'
      ) {
        setCurrentView('dashboard');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, txPath);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!user) return;
    const txPath = `users/${user.uid}/transactions/${txId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', txId));
      setSelectedTransaction(null);
      setCurrentView('history');
      showToast('Movimiento eliminado.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, txPath);
    }
  };

  const handleViewDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setCurrentView('detail');
  };

  const monthlyBudget = userProfile?.monthlyBudget ?? 0;
  const displayName = sanitizeDisplayName(
    userProfile?.displayName || user?.displayName,
    user?.email
  );

  // Calculate stats
  const totalSpent = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncomes = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const currentTotalBudget = monthlyBudget + totalIncomes;
  const availableBalance = currentTotalBudget - totalSpent;
  const spentPercent =
    currentTotalBudget > 0 ? (totalSpent / currentTotalBudget) * 100 : 0;
  const freePercent =
    currentTotalBudget > 0 ? (availableBalance / currentTotalBudget) * 100 : 0;

  const chartData = useMemo(
    () => buildCurrentMonthDailyExpenses(transactions),
    [transactions]
  );

  // Auth or initial profile loading gate
  if (!authReady || (user && !profileLoaded)) {
    return (
      <div className="min-h-screen bg-[#0b0b14] text-slate-100 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-2xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-400">
          Cargando tu cuenta...
        </p>
      </div>
    );
  }

  // Unauthenticated view
  if (!user) {
    return <AuthScreen />;
  }

  // First-time onboarding: ask for monthly budget
  if (!profileExists || !userProfile?.hasSetInitialBudget) {
    return (
      <BudgetOnboarding
        displayName={displayName}
        email={user.email || ''}
        onSaveBudget={handleSaveInitialBudget}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-16 bg-[#0b0b14] text-slate-100 font-sans selection:bg-purple-500/30">
      {/* Success Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 32 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-2 whitespace-nowrap"
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div key={user.uid} className="contents">
        <AssistantDrawer
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userName={displayName}
          availableBalance={availableBalance}
          onRegisterExpense={(data) => {
            handleAddTransaction({
              ...data,
              type: 'expense',
              icon: 'Zap',
            });
          }}
        />
      </div>

      {/* Floating Assistant Button */}
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsAssistantOpen(true)}
        aria-label="Abrir asistente financiero"
        className="fixed bottom-24 right-6 sm:bottom-10 sm:right-10 z-[60] w-14 h-14 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-[0_15px_40px_rgba(147,51,234,0.4)] border border-white/10 cursor-pointer"
      >
        <Sparkles size={24} />
      </motion.button>

      {/* Top Desktop Header & Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#121220]/90 backdrop-blur-xl border-t border-white/[0.06] sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 sm:h-20 flex items-center justify-between gap-8">
          {/* Brand Zone (desktop) */}
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="hidden sm:flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
              <Wallet size={18} />
            </div>
            <span className="text-base font-display font-bold text-white tracking-tight">
              Mi Presupuesto
            </span>
          </button>

          {/* Navigation Center */}
          <div className="flex items-center gap-6 sm:gap-10 w-full sm:w-auto justify-between sm:justify-center">
            <NavItem
              active={currentView === 'dashboard'}
              onClick={() => setCurrentView('dashboard')}
              icon={<LayoutDashboard size={20} />}
              label="Inicio"
            />

            {/* Primary quick expense trigger */}
            <div className="relative -top-6 sm:static sm:top-0">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setCurrentView('register_expense')}
                aria-label="Registrar gasto"
                className="w-16 h-16 sm:w-12 sm:h-12 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-[0_10px_40px_rgba(168,85,247,0.4)] sm:hover:bg-purple-500 transition-all border-4 border-[#0b0b14] sm:border-0 cursor-pointer"
              >
                <Plus size={26} />
              </motion.button>
              <p className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-purple-400 uppercase tracking-widest sm:hidden">
                Gasto
              </p>
            </div>

            <NavItem
              active={currentView === 'history'}
              onClick={() => setCurrentView('history')}
              icon={<HistoryIcon size={20} />}
              label="Historial"
            />
          </div>

          {/* Account Zone (desktop) */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="text-right max-w-[180px]">
              <p className="text-xs font-semibold text-white truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut size={14} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Top Account Bar */}
      <div className="sm:hidden max-w-7xl mx-auto px-6 pt-5 pb-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-display font-bold text-white truncate">
            {displayName}
          </p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-semibold text-slate-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <LogOut size={14} />
          <span>Salir</span>
        </button>
      </div>

      <div className="pt-4 sm:pt-28">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <DashboardView
              key="dashboard"
              displayName={displayName}
              budget={monthlyBudget}
              onBudgetChange={handleBudgetChange}
              spent={totalSpent}
              available={availableBalance}
              totalBudgetWithIncomes={currentTotalBudget}
              spentPercent={spentPercent}
              freePercent={freePercent}
              transactions={transactions}
              transactionsLoaded={transactionsLoaded}
              chartData={chartData}
              onRegisterExpense={() => setCurrentView('register_expense')}
              onRegisterIncome={() => setCurrentView('register_income')}
              onViewDetail={handleViewDetail}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              key="history"
              transactions={transactions}
              onBack={() => setCurrentView('dashboard')}
              onRegisterExpense={() => setCurrentView('register_expense')}
              onViewDetail={handleViewDetail}
            />
          )}

          {currentView === 'register_expense' && (
            <RegisterExpenseView
              key="register_expense"
              onBack={() => setCurrentView('dashboard')}
              onSave={handleAddTransaction}
            />
          )}

          {currentView === 'register_income' && (
            <RegisterIncomeView
              key="register_income"
              onBack={() => setCurrentView('dashboard')}
              onSave={handleAddTransaction}
            />
          )}

          {currentView === 'detail' && selectedTransaction && (
            <DetailView
              key="detail"
              transaction={selectedTransaction}
              onBack={() => setCurrentView('history')}
              onDelete={handleDeleteTransaction}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col sm:flex-row items-center gap-1 sm:gap-2.5 px-4 py-2 rounded-2xl transition-all whitespace-nowrap shrink-0 cursor-pointer',
        active
          ? 'text-purple-400 bg-purple-500/10'
          : 'text-slate-500 hover:text-slate-300'
      )}
    >
      {icon}
      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">
        {label}
      </span>
    </button>
  );
}

// Sub-Views Components

function DashboardView({
  displayName,
  budget,
  onBudgetChange,
  spent,
  available,
  totalBudgetWithIncomes,
  spentPercent,
  freePercent,
  transactions,
  transactionsLoaded,
  chartData,
  onRegisterExpense,
  onRegisterIncome,
  onViewDetail,
}: {
  key?: string;
  displayName: string;
  budget: number;
  onBudgetChange: (val: number) => void;
  spent: number;
  available: number;
  totalBudgetWithIncomes: number;
  spentPercent: number;
  freePercent: number;
  transactions: Transaction[];
  transactionsLoaded: boolean;
  chartData: {
    data: { day: number; amount: number }[];
    monthName: string;
    year: number;
    dailyAverage: number;
  };
  onRegisterExpense: () => void;
  onRegisterIncome: () => void;
  onViewDetail: (tx: Transaction) => void;
}) {
  const hasTransactions = transactions.length > 0;

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-7xl mx-auto px-6"
    >
      <div className="flex items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2 tracking-tight">
            {hasTransactions ? 'Reporte Actual' : `Hola, ${displayName}`}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Resumen financiero del mes</span>
            {hasTransactions && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold">
                  Sincronizado en tu cuenta
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRegisterIncome}
            className="hidden sm:flex px-5 py-3 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl items-center justify-center gap-2.5 text-emerald-400 text-xs font-bold hover:bg-emerald-600/20 transition-all whitespace-nowrap cursor-pointer"
          >
            <Banknote size={17} />
            <span>Nuevo Ingreso</span>
          </motion.button>

          <button
            onClick={onRegisterIncome}
            aria-label="Nuevo ingreso"
            className="sm:hidden w-11 h-11 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400"
          >
            <Banknote size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-8">
        <SummaryCard
          label="PRESUPUESTO MENSUAL"
          amount={budget}
          type="budget"
          onAmountChange={onBudgetChange}
          subtext="Click para editar presupuesto base"
        />
        <SummaryCard
          label="TOTAL GASTADO"
          amount={spent}
          type="spent"
          subtext={`${spentPercent.toFixed(1)}% consumido`}
        />
        <SummaryCard
          label="SALDO DISPONIBLE"
          amount={available}
          type="available"
          availableBalance={available}
          subtext={`${freePercent.toFixed(1)}% de presupuesto libre`}
        />
      </div>

      <div className="mb-8">
        <ProgressIndicator spent={spent} total={totalBudgetWithIncomes} />
      </div>

      {!transactionsLoaded ? (
        <div className="h-64 glass-card rounded-[2.5rem] flex items-center justify-center text-slate-400 text-sm gap-3">
          <Loader2 size={18} className="animate-spin text-purple-400" />
          <span>Cargando tus movimientos...</span>
        </div>
      ) : hasTransactions ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <ExpensesChart
              data={chartData.data}
              monthName={chartData.monthName}
              year={chartData.year}
              dailyAverage={chartData.dailyAverage}
            />
          </div>
          <div className="lg:col-span-4">
            <MovementList
              expenses={transactions.slice(0, 5)}
              onSelectTransaction={onViewDetail}
            />
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-10 p-10 sm:p-16 glass-card rounded-[2.5rem] border-white/[0.06] text-center border-dashed border-2"
        >
          <div className="w-20 h-20 bg-purple-500/10 rounded-[1.75rem] flex items-center justify-center text-purple-400 mx-auto mb-8">
            <Plus size={34} />
          </div>
          <h3 className="text-3xl font-display font-bold text-white mb-4 tracking-tight">
            Aún no hay movimientos este mes
          </h3>
          <p className="text-slate-400 text-base sm:text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Tu cuenta empieza desde cero. Registra tu primer gasto o ingreso y todo quedará guardado en tu cuenta.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onRegisterExpense}
              className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-display font-bold text-base shadow-[0_20px_50px_rgba(147,51,234,0.3)] hover:bg-purple-500 transition-all cursor-pointer whitespace-nowrap"
            >
              Registrar tu primer gasto
            </motion.button>
            <button
              onClick={onRegisterIncome}
              className="px-8 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 rounded-2xl font-display font-bold text-base transition-all cursor-pointer whitespace-nowrap"
            >
              Registrar ingreso
            </button>
          </div>
        </motion.div>
      )}
    </motion.main>
  );
}

function HistoryView({
  transactions,
  onBack,
  onRegisterExpense,
  onViewDetail,
}: {
  transactions: Transaction[];
  onBack: () => void;
  onRegisterExpense: () => void;
  onViewDetail: (t: Transaction) => void;
  key?: string;
}) {
  return (
    <motion.main
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl mx-auto px-6"
    >
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={onBack}
          className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-3xl font-display font-bold text-white tracking-tight">
          Movimientos
        </h2>
      </div>

      <div className="space-y-4">
        {transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center glass-card rounded-[2.5rem] border-white/[0.05]"
          >
            <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center text-slate-500 mx-auto mb-6">
              <HistoryIcon size={24} />
            </div>
            <h3 className="text-2xl font-display font-bold text-white mb-2">
              Tus movimientos vivirán aquí
            </h3>
            <p className="text-slate-500 text-sm mb-8 px-10">
              Cada vez que registres un gasto o ingreso en tu cuenta, aparecerá en esta lista.
            </p>
            <button
              onClick={onRegisterExpense}
              className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20 cursor-pointer"
            >
              Registrar gasto
            </button>
          </motion.div>
        ) : (
          transactions.map((item) => (
            <div
              key={item.id}
              onClick={() => onViewDetail(item)}
              className="p-6 glass-card rounded-3xl border-white/[0.03] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform',
                    item.type === 'income'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-purple-500/10 text-purple-400'
                  )}
                >
                  {item.type === 'income' ? (
                    <Banknote size={20} />
                  ) : (
                    <Plus size={20} className="rotate-45" />
                  )}
                </div>
                <div>
                  <p className="text-base font-bold text-white mb-0.5">
                    {item.category}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {item.date}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {item.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </p>
                  </div>
                </div>
              </div>
              <p
                className={cn(
                  'text-lg font-display font-bold tabular-nums',
                  item.type === 'income' ? 'text-emerald-400' : 'text-white'
                )}
              >
                {item.type === 'income' ? '+' : '-'} ${' '}
                {item.amount.toLocaleString('es-CO')}
              </p>
            </div>
          ))
        )}
      </div>
    </motion.main>
  );
}

function DetailView({
  transaction,
  onBack,
  onDelete,
}: {
  transaction: Transaction | null;
  onBack: () => void;
  onDelete: (id: string) => Promise<void>;
  key?: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!transaction || transaction.id === 'new') {
    return (
      <motion.main
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="max-w-xl mx-auto px-6"
      >
        <div className="flex items-center mb-10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-all"
          >
            <ChevronLeft size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">
              Volver
            </span>
          </button>
        </div>
        <div className="py-32 text-center">
          <p className="text-slate-500 font-medium">
            Selecciona un movimiento para ver el detalle
          </p>
        </div>
      </motion.main>
    );
  }

  const handleRemove = async () => {
    setIsDeleting(true);
    try {
      await onDelete(transaction.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-xl mx-auto px-6"
    >
      <div className="flex items-center justify-between mb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <ChevronLeft size={20} />
          <span className="text-xs font-bold uppercase tracking-widest">
            Volver
          </span>
        </button>
        <button
          onClick={handleRemove}
          disabled={isDeleting}
          className="flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Trash2 size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </span>
        </button>
      </div>

      <div className="glass-card rounded-[2.5rem] p-10 border-white/[0.05] text-center">
        <div
          className={cn(
            'w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl transition-all',
            transaction.type === 'income'
              ? 'bg-emerald-500/10 text-emerald-400 shadow-emerald-500/5'
              : 'bg-purple-500/10 text-purple-400 shadow-purple-500/5'
          )}
        >
          {transaction.type === 'income' ? (
            <Banknote size={32} />
          ) : (
            <LayoutDashboard size={32} />
          )}
        </div>

        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-2">
          {transaction.category}
        </p>
        <h3
          className={cn(
            'text-4xl font-display font-bold tabular-nums mb-8 tracking-tight',
            transaction.type === 'income' ? 'text-emerald-400' : 'text-white'
          )}
        >
          {transaction.type === 'income' ? '+' : '-'} ${' '}
          {transaction.amount.toLocaleString('es-CO')}{' '}
          <span className="text-lg opacity-60">COP</span>
        </h3>

        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              FECHA
            </p>
            <p className="text-sm font-semibold tabular-nums text-white">
              {transaction.date}
            </p>
          </div>
          <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              ESTADO
            </p>
            <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Guardado
            </p>
          </div>
        </div>

        <div className="mt-4 p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-left">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            NOTAS
          </p>
          <p className="text-sm text-slate-400 italic">
            {transaction.description ||
              transaction.observations ||
              'Sin descripción adicional.'}
          </p>
        </div>

        {transaction.paymentMethod && (
          <div className="mt-4 p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-left">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              MEDIO DE PAGO
            </p>
            <p className="text-sm font-semibold text-white">
              {transaction.paymentMethod}
            </p>
          </div>
        )}
      </div>
    </motion.main>
  );
}

function RegisterExpenseView({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: (e: Omit<Transaction, 'id'>) => Promise<void> | void;
  key?: string;
}) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentación');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'Alimentación',
    'Transporte',
    'Servicios públicos',
    'Ropa',
    'Entretenimiento',
    'Otros',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(/\./g, ''));
    if (isNaN(val) || val <= 0) {
      setError('Por favor ingresa un monto válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        amount: val,
        category,
        date,
        description: description.trim() || undefined,
        icon:
          category === 'Alimentación'
            ? 'Utensils'
            : category === 'Transporte'
              ? 'Bus'
              : category === 'Entretenimiento'
                ? 'Film'
                : category === 'Ropa'
                  ? 'Shirt'
                  : 'Zap',
        type: 'expense',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-xl mx-auto px-6"
    >
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={onBack}
          className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-3xl font-display font-bold text-white tracking-tight">
          Nuevo Gasto
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass-card rounded-[2.5rem] p-8 sm:p-10 border-white/[0.05] space-y-8"
      >
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
            MONTO EN COP
          </label>
          <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-display font-bold text-purple-500 group-focus-within:scale-110 transition-transform">
              $
            </span>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setAmount(val ? parseInt(val, 10).toLocaleString('es-CO') : '');
                setError('');
              }}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-purple-500/50 focus:bg-white/[0.05] rounded-3xl py-8 pl-14 pr-8 text-4xl font-display font-bold tabular-nums text-white outline-none transition-all placeholder:text-slate-800"
            />
          </div>
          {error && (
            <p className="mt-3 text-rose-500 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
            CATEGORÍA
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  'py-4 px-3 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer',
                  category === cat
                    ? 'bg-purple-600 border-purple-500 text-white shadow-xl shadow-purple-900/20'
                    : 'bg-white/[0.02] border-white/[0.05] text-slate-500 hover:border-white/10 hover:text-slate-300'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3">
              FECHA
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-purple-500/50 rounded-2xl py-3.5 px-5 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3">
              NOTA (OPCIONAL)
            </label>
            <input
              type="text"
              placeholder="Ej. Almuerzo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-purple-500/50 rounded-2xl py-3.5 px-5 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-6 bg-white text-[#0b0b14] rounded-3xl font-display font-bold text-lg shadow-2xl hover:bg-slate-100 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
        </button>
      </form>
    </motion.main>
  );
}

function RegisterIncomeView({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: (e: Omit<Transaction, 'id'>) => Promise<void> | void;
  key?: string;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Salario');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cuenta bancaria');
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'Salario',
    'Trabajo independiente',
    'Negocio',
    'Inversiones',
    'Regalo',
    'Bonificación',
    'Reembolso',
    'Otro',
  ];
  const paymentMethods = [
    'Efectivo',
    'Cuenta bancaria',
    'Nequi',
    'Daviplata',
    'Tarjeta',
    'Otro',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(/\./g, ''));
    if (isNaN(val) || val <= 0) {
      setError('Por favor ingresa un monto válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        amount: val,
        category,
        description,
        date,
        paymentMethod,
        observations,
        icon: category === 'Salario' ? 'Banknote' : 'Coins',
        type: 'income',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-xl mx-auto px-6 pb-20"
    >
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={onBack}
          className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-3xl font-display font-bold text-white tracking-tight">
          Registrar Nuevo Ingreso
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass-card rounded-[2.5rem] p-8 sm:p-10 border-white/[0.05] space-y-8"
      >
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
            VALOR DEL INGRESO
          </label>
          <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-display font-bold text-emerald-500 transition-transform group-focus-within:scale-110">
              $
            </span>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setAmount(val ? parseInt(val, 10).toLocaleString('es-CO') : '');
                setError('');
              }}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-emerald-500/50 focus:bg-white/[0.05] rounded-3xl py-8 pl-14 pr-8 text-4xl font-display font-bold tabular-nums text-white outline-none transition-all placeholder:text-slate-800"
            />
          </div>
          {error && (
            <p className="mt-3 text-rose-500 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
            DESCRIPCIÓN
          </label>
          <input
            type="text"
            placeholder="Ej: Salario Julio"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-emerald-500/50 focus:bg-white/[0.05] rounded-2xl py-4 px-6 text-white outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
              CATEGORÍA
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-emerald-500/50 rounded-2xl py-4 px-6 text-white outline-none appearance-none cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#121220]">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
              FECHA
            </label>
            <div className="relative">
              <Calendar
                size={18}
                className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-emerald-500/50 rounded-2xl py-4 pl-14 pr-6 text-white outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
            MEDIO DE PAGO
          </label>
          <div className="relative">
            <CreditCard
              size={18}
              className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-emerald-500/50 rounded-2xl py-4 pl-14 pr-6 text-white outline-none appearance-none cursor-pointer"
            >
              {paymentMethods.map((m) => (
                <option key={m} value={m} className="bg-[#121220]">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-4">
            OBSERVACIONES
          </label>
          <div className="relative">
            <MessageSquare
              size={18}
              className="absolute left-6 top-6 text-slate-500"
            />
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Información adicional (opcional)"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-emerald-500/50 rounded-2xl py-4 pl-14 pr-6 text-white outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-6 bg-slate-800 text-slate-300 rounded-3xl font-display font-bold text-lg hover:bg-slate-700 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-6 bg-[#5B3DF5] text-white rounded-3xl font-display font-bold text-lg shadow-2xl hover:bg-purple-500 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar ingreso'}
          </button>
        </div>
      </form>
    </motion.main>
  );
}
