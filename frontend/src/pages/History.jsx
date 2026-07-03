import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import StatCard from '../components/StatCard';
import CategoryRow from '../components/CategoryRow';
import MonthSelector from '../components/MonthSelector';
import { Lock, Unlock, Loader2, Calendar } from 'lucide-react';
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

const NAVY_STROKE = '-1px -1px 0 #1a1a2e, 1px -1px 0 #1a1a2e, -1px 1px 0 #1a1a2e, 1px 1px 0 #1a1a2e';

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
      stroke="#1a1a2e"
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

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const color = CATEGORY_COLORS[name] || COLORS[0];
  return (
    <div style={{ background: color, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontWeight: 600, color: '#fff', textShadow: NAVY_STROKE, margin: 0 }}>{name}</p>
      <p style={{ color: '#fff', textShadow: NAVY_STROKE, margin: '2px 0 0' }}>${value.toLocaleString()}</p>
    </div>
  );
};

const PERSON_OPTIONS = ['Combined', 'Ana', 'Diego', 'Ana/Diego'];

export default function HistoryPage() {
  const navigate = useNavigate();
  const [selectedMonthId, setSelectedMonthId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  // null = "Combined" (no filtering)
  const [personFilter, setPersonFilter] = useState(null);
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

  // Apply the person filter before deriving the category table & charts.
  // "Combined" (personFilter === null) shows everything.
  const personExpenses = personFilter
    ? expenses.filter(e => e.person === personFilter)
    : expenses;

  const expensesByCategory = personExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));

  // Jump to the Data Editor for this month, pre-filtered to the clicked category
  // (and the active person filter, if any).
  const goToEditor = (category) => {
    const params = new URLSearchParams({ month: selectedMonthId, type: 'expense', category });
    if (personFilter) params.set('person', personFilter);
    navigate(`/editor?${params}`);
  };

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
            <div className="flex flex-col items-end gap-3">
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
                    onClick={goToEditor}
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
                        onClick={(data) => goToEditor(data.name)}
                        className="cursor-pointer outline-none"
                        label={renderSliceLabel}
                        labelLine={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[entry.name] || COLORS[index % COLORS.length]}
                            stroke="none"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        onClick={(e) => goToEditor(e.value)}
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
