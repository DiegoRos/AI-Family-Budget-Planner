import React from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import StatCard from '../components/StatCard';
import CategoryRow from '../components/CategoryRow';
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

const PERSON_OPTIONS = ['Combined', 'Ana', 'Diego', 'Ana/Diego'];

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  // null = "Combined" (no filtering)
  const [personFilter, setPersonFilter] = React.useState(null);
  const { data: months, isLoading: loadingMonths } = useQuery({
    queryKey: ['months'],
    queryFn: async () => {
      const res = await client.get('/api/months/');
      return res.data;
    },
  });

  const sortedMonths = React.useMemo(() => {
    if (!months) return [];
    return [...months].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [months]);

  const currentMonthData = sortedMonths.length > 0 ? sortedMonths[0] : null;
  
  const { data: monthDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['month', currentMonthData?.id],
    queryFn: async () => {
      const res = await client.get(`/api/months/${currentMonthData.id}`);
      return res.data;
    },
    enabled: !!currentMonthData?.id,
  });

  if (loadingMonths || loadingDetails) {
    return <div className="flex justify-center py-20">Loading dashboard...</div>;
  }

  if (!currentMonthData) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-medium text-gray-600">No data found</h2>
        <p className="text-gray-400 mt-2">Go to Upload or Data Editor to get started.</p>
      </div>
    );
  }

  const expenses = monthDetails?.expenses || [];
  const incomes = monthDetails?.incomes || [];
  const budgets = monthDetails?.budgets || [];

  const totalActualExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalActualIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const savings = totalActualIncome - totalActualExpenses;

  // Apply the person filter before deriving the category table & charts.
  // "Combined" (personFilter === null) shows everything.
  const personExpenses = personFilter
    ? expenses.filter(e => e.person === personFilter)
    : expenses;

  // Group expenses by category
  const expensesByCategory = personExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));

  const filteredExpenses = selectedCategory
    ? personExpenses.filter(e => e.category === selectedCategory).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">
            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(monthDetails.year, monthDetails.month - 1))}
          </h1>
          <p className="text-gray-500 mt-1">Monthly Financial Overview</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="bg-white border border-gray-100 rounded-md px-3 py-1 text-sm font-medium text-gray-500">
            {monthDetails.is_frozen ? '🔒 Frozen' : '🔓 Active'}
          </div>
          {/* Person filter (affects category table & charts only) */}
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            {PERSON_OPTIONS.map((opt) => {
              const value = opt === 'Combined' ? null : opt;
              const active = personFilter === value;
              return (
                <button
                  key={opt}
                  onClick={() => setPersonFilter(value)}
                  className={`px-3 py-1 text-sm font-medium rounded transition-all duration-150 ${
                    active
                      ? 'bg-[#334960] text-white'
                      : 'text-gray-500 hover:text-[#1a1a2e]'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Income" amount={totalActualIncome} type="positive" />
        <StatCard title="Expenses" amount={totalActualExpenses} type="negative" />
        <StatCard title="Savings" amount={savings} type={savings >= 0 ? 'positive' : 'negative'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Breakdown */}
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

        {/* Charts */}
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
    </div>
  );
}
