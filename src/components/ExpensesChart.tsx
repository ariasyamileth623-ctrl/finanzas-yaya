/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { DailyExpense } from '../data';
import { motion } from 'motion/react';

interface ExpensesChartProps {
  data: DailyExpense[];
  monthName: string;
  year: number;
  dailyAverage: number;
}

const CustomTooltip = ({ active, payload, label, monthName, year }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121220]/95 backdrop-blur-xl p-4 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
          {label} DE {monthName.toUpperCase()}, {year}
        </p>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          <p className="text-xl font-display font-bold tabular-nums text-white">
            $ {Number(payload[0].value).toLocaleString('es-CO')}
          </p>
        </div>
      </motion.div>
    );
  }
  return null;
};

export function ExpensesChart({
  data,
  monthName,
  year,
  dailyAverage,
}: ExpensesChartProps) {
  const lastPoint = data[data.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-8 sm:p-10 rounded-[2.5rem] h-[450px] w-full"
    >
      <div className="flex items-center justify-between mb-10 gap-4">
        <div>
          <h3 className="font-display font-bold text-white text-xl mb-1">
            Gastos Diarios
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            REPORTE DE {monthName.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            PROMEDIO DIARIO
          </p>
          <p className="text-lg font-display font-bold tabular-nums text-purple-400">
            $ {dailyAverage.toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="70%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="0"
            vertical={false}
            stroke="rgba(255,255,255,0.03)"
          />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
            dy={20}
            interval={1}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(value) =>
              value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
            }
          />
          <Tooltip
            content={<CustomTooltip monthName={monthName} year={year} />}
            cursor={{ stroke: 'rgba(168,85,247,0.2)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#a855f7"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorAmount)"
            animationDuration={1200}
            activeDot={{ r: 6, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }}
          />
          {lastPoint && (
            <ReferenceDot
              x={lastPoint.day}
              y={lastPoint.amount}
              r={5}
              fill="#a855f7"
              stroke="#fff"
              strokeWidth={2}
              className="drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
