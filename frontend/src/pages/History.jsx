import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import StatCard from '../components/StatCard';
import CategoryRow from '../components/CategoryRow';
import MonthSelector from '../components/MonthSelector';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip 
} from 'recharts';
import { CATEGORY_COLORS } from '../api/constants';

const COLORS = ['#334960', '#4a6b8c', '#628db8', '#7bb0e4', '#93d2ff', '#aadaff'];

// Render slice percentage with a dark paint-order outline so light text
// stays readable on light slices.
const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      stroke="#000"
      strokeWidth={2.5}
      style={{ paintOrder: 'stroke' }}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
};

export default function HistoryPage() {
  const [selectedMonthId, setSelectedMonthId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const queryClient = useQueryClient();

  const { data: months, isLoading: loadingMonths } = useQuery({
    queryKey: ['months'],
    queryFn: async () => {
      const res = await client.get('/api/months/');
      return res.data;
    },
  });

  useEffect(() => {
    if (months && months.length > 0 && !selectedMonthId && !selectedPeriod) {
      // Default to the most recent month
      const sorted = [...months].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      setSelectedMonthId(sorted[0].id);
      setSelectedPeriod({ year: sorted[0].year, month: sorted[0].month });
    }
  }, [months, selectedMonthId, selectedPeriod]);

  const { data: monthDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['month', selectedMonthId],
    queryFn: async () => {
      const res = await client.get(`/api/months/${selectedMonthId}`);
      return res.data;
    },
    enabled: !!selectedMonthId,
  });

  const handleSelect = (id, period) => {
    setSelectedMonthId(id);
    setSelectedPeriod(period);
    setSelectedCategory(null);
  };

  const toggleFreezeMutation = useMutation({
    mutationFn: async ({ id, freeze }) => {
      const res = await client.patch(`/api/months/${id}/freeze?freeze=${freeze}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['months']);
      queryClient.invalidateQueries(['month', selectedMonthId]);
    },
  });

  if (loadingMonths) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  if (!months || months.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-medium text-gray-600">No history available</h2>
        <p className="text-gray-400 mt-2">Upload data to create monthly records.</p>
      </div>
    );
  }

  const expenses = monthDetails?.expenses || [];
  const incomes = monthDetails?.incomes || [];
  const budgets = monthDetails?.budgets || [];

  const totalActualExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalActualIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const savings = totalActualIncome - totalActualExpenses;

  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));
  
  const filteredExpenses = selectedCategory 
    ? expenses.filter(e => e.category === selectedCategory).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">Budget History</h1>
          <p className="text-gray-500 mt-1">Review past months and manage their status.</p>
        </div>
      </header>

      <MonthSelector 
        months={months} 
        selectedMonthId={selectedMonthId} 
        onSelect={handleSelect} 
      />

      {loadingDetails ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#334960]" /></div>
      ) : monthDetails ? (
        <>
          <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(monthDetails.year, monthDetails.month - 1))}
              </h2>
              <p className="text-sm text-gray-500">
                Status: <span className={monthDetails.is_frozen ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                  {monthDetails.is_frozen ? 'Frozen (Read-only)' : 'Active (Editable)'}
                </span>
              </p>
            </div>
            <button
              onClick={() => toggleFreezeMutation.mutate({ id: monthDetails.id, freeze: !monthDetails.is_frozen })}
              disabled={toggleFreezeMutation.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                ${monthDetails.is_frozen 
                  ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                  : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
            >
              {toggleFreezeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : monthDetails.is_frozen ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {monthDetails.is_frozen ? 'Unfreeze Month' : 'Freeze Month'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Income" amount={totalActualIncome} type="positive" />
            <StatCard title="Expenses" amount={totalActualExpenses} type="negative" />
            <StatCard title="Savings" amount={savings} type={savings >= 0 ? 'positive' : 'negative'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg border border-gray-100">
              <h2 className="text-lg font-semibold mb-6">Planned vs Actual</h2>
              <div className="space-y-1">
                {budgets.filter(b => b.type === 'expense').map(budget => (
                  <CategoryRow
                    key={budget.id}
                    category={budget.category}
                    planned={budget.planned_amount}
                    actual={expensesByCategory[budget.category] || 0}
                    type="expense"
                  />
                ))}
                {budgets.length === 0 && (
                  <p className="text-gray-400 text-sm py-4">No budget targets set for this month.</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Expense Breakdown</h2>
                {selectedCategory && (
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="h-80 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={(data) => setSelectedCategory(data.name)}
                        className="cursor-pointer outline-none"
                        label={renderSliceLabel}
                        labelLine={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CATEGORY_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                            stroke={selectedCategory === entry.name ? '#1a1a2e' : 'none'}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => `$${value.toLocaleString()}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        onClick={(e) => setSelectedCategory(prev => prev === e.value ? null : e.value)}
                        wrapperStyle={{ cursor: 'pointer' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No expense data to visualize
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Category View */}
          {selectedCategory && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-[#1a1a2e]">Details: {selectedCategory}</h3>
                <span className="text-sm font-medium text-gray-500">${expensesByCategory[selectedCategory]?.toLocaleString()} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Person</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-gray-600">{e.date}</td>
                        <td className="px-6 py-3 font-medium text-gray-800">{e.description}</td>
                        <td className="px-6 py-3 text-gray-600">{e.person}</td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">${e.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : selectedPeriod ? (
        <div className="bg-white rounded-xl border border-gray-100 p-20 text-center shadow-sm">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">No data for {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedPeriod.year, selectedPeriod.month - 1))}</h2>
          <p className="text-gray-400 mt-2 max-w-sm mx-auto">We couldn't find any financial records for this period. Try uploading a statement or adding transactions manually in the Data Editor.</p>
        </div>
      ) : null}
    </div>
  );
}
