/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Wallet, TrendingUp, MoreVertical, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface SummaryCardProps {
  label: string;
  amount: number;
  type: 'budget' | 'spent' | 'available';
  subtext?: string;
  onAmountChange?: (newAmount: number) => void;
  availableBalance?: number;
}

export function SummaryCard({ label, amount, type, subtext, onAmountChange, availableBalance }: SummaryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(amount.toString());

  useEffect(() => {
    setEditValue(amount.toString());
  }, [amount]);

  const getIcon = () => {
    switch (type) {
      case 'budget': return <Wallet size={18} className="text-purple-400" />;
      case 'spent': return <TrendingUp size={18} className="text-purple-400" />;
      case 'available': return <Activity size={18} className="text-purple-400" />;
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const val = parseFloat(editValue.replace(/\D/g, ''));
    if (!isNaN(val) && val > 0 && onAmountChange) {
      onAmountChange(val);
    }
  };

  const status = availableBalance !== undefined ? (availableBalance >= 0 ? 'positive' : 'negative') : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 rounded-[2rem] glass-card relative group transition-all hover:bg-white/[0.03] overflow-hidden"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shadow-inner">
          {getIcon()}
        </div>
        <MoreVertical size={18} className="text-slate-600 cursor-pointer hover:text-slate-400 transition-colors" />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
        {label}
      </p>
      
      <div className="flex items-baseline gap-2 mb-4">
        {isEditing && type === 'budget' ? (
          <input 
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value.replace(/\D/g, ''))}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            className="w-full bg-white/[0.03] border-b border-purple-500 text-3xl font-display font-bold text-white outline-none py-1"
          />
        ) : (
          <p 
            onClick={() => type === 'budget' && setIsEditing(true)}
            className={cn(
              "text-3xl font-display font-bold tabular-nums text-white tracking-tight",
              type === 'budget' && "cursor-pointer hover:text-purple-400 transition-colors"
            )}
          >
            $ {amount.toLocaleString('es-CO')}
          </p>
        )}
        <span className="text-xl font-display font-medium text-purple-500/80 tracking-tight">
          COP
        </span>
      </div>

      <div className="flex items-center justify-between">
        {subtext && (
          <p className="text-sm font-medium text-slate-500 opacity-80">
            {subtext}
          </p>
        )}
        
        {type === 'available' && status && (
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            status === 'positive' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
          )}>
            {status === 'positive' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {status === 'positive' ? "Balance positivo" : "Balance negativo"}
          </div>
        )}
      </div>

      {type === 'budget' && !isEditing && (
        <div className="absolute top-8 right-14 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[8px] font-bold text-purple-500/50 uppercase tracking-widest">Click para editar</p>
        </div>
      )}
    </motion.div>
  );
}

interface ProgressIndicatorProps {
  spent: number;
  total: number;
}

export function ProgressIndicator({ spent, total }: ProgressIndicatorProps) {
  const percent = total > 0 ? spent / total : 0;
  const remainingPercent = total > 0 ? Math.max((1 - percent) * 100, 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 rounded-[2rem] glass-card flex flex-col justify-center"
    >
      <div className="flex justify-between items-baseline mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">PROGRESO DEL PRESUPUESTO</p>
          <h3 className="text-xl font-display font-bold text-white">Estado de Consumo</h3>
        </div>
        <p className="text-sm font-semibold tabular-nums text-purple-400 opacity-80">
          Queda el {remainingPercent.toFixed(1)}%
        </p>
      </div>
      
      <div className="h-4 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/[0.02]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(percent * 100, 0), 100)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
        />
      </div>
    </motion.div>
  );
}

