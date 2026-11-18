/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Transaction } from '../data';
import { 
  Utensils, 
  Bus, 
  Zap, 
  Film,
  Shirt,
  Banknote,
  Coins,
  LucideIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { cn } from '../lib/utils';

const iconMap: Record<string, LucideIcon> = {
  Utensils,
  Bus,
  Zap,
  Film,
  Shirt,
  Banknote,
  Coins,
};

const iconColors: Record<string, string> = {
  Utensils: 'bg-indigo-500/10 text-indigo-400',
  Bus: 'bg-blue-500/10 text-blue-400',
  Zap: 'bg-purple-500/10 text-purple-400',
  Film: 'bg-pink-500/10 text-pink-400',
  Shirt: 'bg-emerald-500/10 text-emerald-400',
  Banknote: 'bg-emerald-500/10 text-emerald-400',
  Coins: 'bg-emerald-500/10 text-emerald-400',
};

interface MovementListProps {
  expenses: Transaction[];
  onSelectTransaction?: (transaction: Transaction) => void;
}

export function MovementList({
  expenses: transactions,
  onSelectTransaction,
}: MovementListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card p-8 sm:p-10 rounded-[2.5rem] flex flex-col h-full overflow-hidden"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="font-display font-bold text-white text-xl">Últimos Movimientos</h3>
      </div>

      <div className="flex-1 space-y-0 overflow-y-auto pr-2 custom-scrollbar">
        {transactions.map((item, index) => {
          const IconComponent = iconMap[item.icon] || (item.type === 'income' ? Banknote : Zap);
          const colorClass = item.type === 'income' 
            ? 'bg-emerald-500/10 text-emerald-400' 
            : (iconColors[item.icon] || 'bg-slate-500/10 text-slate-400');
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectTransaction?.(item)}
              className={cn(
                "flex items-center gap-4 sm:gap-6 py-5 group transition-all cursor-pointer hover:bg-white/[0.02] rounded-2xl px-2 -mx-2",
                index !== transactions.length - 1 ? 'border-b border-white/[0.03]' : ''
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105 shadow-lg relative shrink-0",
                colorClass
              )}>
                <IconComponent size={20} />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#121220] border border-white/10 flex items-center justify-center">
                  {item.type === 'income' 
                    ? <ArrowUpRight size={10} className="text-emerald-400" />
                    : <ArrowDownLeft size={10} className="text-rose-400" />
                  }
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white truncate mb-0.5">
                  {item.category}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    {new Date(`${item.date}T12:00:00`).toLocaleDateString('es-CO', { 
                      day: '2-digit', 
                      month: 'long' 
                    }).toUpperCase()}
                  </p>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    {item.type === 'income' ? 'Ingreso' : 'Gasto'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className={cn(
                  "text-base font-display font-bold tabular-nums",
                  item.type === 'income' ? "text-emerald-400" : "text-white"
                )}>
                  {item.type === 'income' ? '+' : '-'} $ {item.amount.toLocaleString('es-CO')}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

