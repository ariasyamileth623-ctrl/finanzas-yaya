import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, ArrowRight, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

interface BudgetOnboardingProps {
  displayName: string;
  email: string;
  onSaveBudget: (budget: number) => Promise<void>;
  onSignOut: () => Promise<void>;
}

const PRESET_BUDGETS = [1500000, 3000000, 4500000];

export function BudgetOnboarding({
  displayName,
  email,
  onSaveBudget,
  onSignOut,
}: BudgetOnboardingProps) {
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const parsedValue = parseFloat(amount.replace(/\./g, '')) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedValue) || parsedValue <= 0) {
      setError('Por favor ingresa un presupuesto mensual mayor a $0.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await onSaveBudget(parsedValue);
    } catch {
      setError('No pudimos guardar tu presupuesto. Intenta de nuevo.');
      setIsSaving(false);
    }
  };

  const handlePresetClick = (preset: number) => {
    setAmount(preset.toLocaleString('es-CO'));
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#0b0b14] text-slate-100 flex flex-col justify-between p-6 sm:p-10">
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-display font-bold text-white truncate">
              Mi Presupuesto Mensual
            </p>
            {email && (
              <p className="text-xs text-slate-400 truncate">{email}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs font-semibold text-slate-300 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LogOut size={14} />
          <span>Cerrar sesión</span>
        </button>
      </header>

      <main className="max-w-xl w-full mx-auto my-auto py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[2.25rem] p-8 sm:p-10 border border-white/[0.07] shadow-2xl space-y-8"
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold text-purple-400">
              Primer paso · Tu cuenta empieza desde cero
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight text-balance">
              Hola, {displayName}. ¿Cuál es tu presupuesto mensual?
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Este valor será tu base del mes para calcular cuánto llevas gastado y tu saldo disponible. Podrás ajustarlo cuando quieras desde el panel principal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="initial-budget"
                className="text-xs font-semibold text-slate-300 block mb-3"
              >
                Presupuesto mensual base (COP)
              </label>
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-display font-bold text-purple-400">
                  $
                </span>
                <input
                  id="initial-budget"
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setAmount(
                      digits ? parseInt(digits, 10).toLocaleString('es-CO') : ''
                    );
                    setError('');
                  }}
                  disabled={isSaving}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-purple-500/60 focus:bg-white/[0.05] rounded-2xl py-6 pl-14 pr-20 text-3xl sm:text-4xl font-display font-bold tabular-nums text-white outline-none transition-all placeholder:text-slate-700"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-display font-semibold text-slate-500">
                  COP
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-400">Sugerencias rápidas:</p>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_BUDGETS.map((preset) => {
                  const active = parsedValue === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isSaving}
                      onClick={() => handlePresetClick(preset)}
                      className={cn(
                        'px-4 py-2 rounded-xl border text-xs font-semibold tabular-nums transition-all cursor-pointer whitespace-nowrap',
                        active
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-white/[0.03] border-white/[0.07] text-slate-300 hover:border-white/20 hover:text-white'
                      )}
                    >
                      $ {preset.toLocaleString('es-CO')}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-2.5 text-xs text-rose-200">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-display font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-900/30 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Guardando presupuesto...</span>
                </>
              ) : (
                <>
                  <span>Guardar y empezar</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>

      <div className="h-4" />
    </div>
  );
}
