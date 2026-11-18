/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  userId?: string;
  amount: number;
  category: string;
  date: string;
  icon: string;
  type: 'expense' | 'income';
  description?: string;
  paymentMethod?: string;
  observations?: string;
  createdAtMs?: number;
}

export interface DailyExpense {
  day: number;
  amount: number;
}

export function buildCurrentMonthDailyExpenses(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): { data: DailyExpense[]; monthName: string; year: number; dailyAverage: number } {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const totalsByDay = new Map<number, number>();
  for (let d = 1; d <= daysInMonth; d++) {
    totalsByDay.set(d, 0);
  }

  let totalMonthExpense = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (!tx.date.startsWith(monthPrefix)) continue;
    const dayNum = parseInt(tx.date.slice(8, 10), 10);
    if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= daysInMonth) {
      totalsByDay.set(dayNum, (totalsByDay.get(dayNum) || 0) + tx.amount);
      totalMonthExpense += tx.amount;
    }
  }

  const data: DailyExpense[] = Array.from(totalsByDay.entries()).map(([day, amount]) => ({
    day,
    amount,
  }));

  const monthName = referenceDate.toLocaleDateString('es-CO', { month: 'long' });
  const daysElapsed = Math.max(referenceDate.getDate(), 1);
  const dailyAverage = Math.round(totalMonthExpense / daysElapsed);

  return {
    data,
    monthName,
    year,
    dailyAverage,
  };
}
