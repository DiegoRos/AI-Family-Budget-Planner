import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import MonthSelector from '../components/MonthSelector';
import { 
  Trash2, 
  Save, 
  Plus, 
  X,
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Table as TableIcon,
  Target,
  Edit2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { 
  ALL_CATEGORIES, 
  EXPENSE_CATEGORIES, 
  INCOME_CATEGORIES, 
  PERSONS 
} from '../api/constants';

export default function DataEditor() {
  const [selectedMonthId, setSelectedMonthId] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'budget'
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [bulkColumn, setBulkColumn] = useState('person');
  const [bulkValue, setBulkValue] = useState('');
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Miscellaneous',
    person: 'Ana/Diego',
    amount: 0,
    type: 'expense'
  });
  const queryClient = useQueryClient();

  const { data: months, isLoading: loadingMonths } = useQuery({
    queryKey: ['months'],
    queryFn: async () => {
      const res = await client.get('/api/months/');
      return res.data;
    },
  });

  useEffect(() => {
    if (months && months.length > 0 && !selectedMonthId) {
      const sorted = [...months].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      setSelectedMonthId(sorted[0].id);
    }
  }, [months, selectedMonthId]);

  // Clear bulk selection when switching month or tab
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [selectedMonthId, activeTab]);

  // Reset the bulk value whenever the target column changes
  useEffect(() => {
    setBulkValue('');
  }, [bulkColumn]);

  const { data: monthDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['month', selectedMonthId],
    queryFn: async () => {
      const res = await client.get(`/api/months/${selectedMonthId}`);
      return res.data;
    },
    enabled: !!selectedMonthId,
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, type, data, originalType }) => {
      if (type === originalType) {
        const endpoint = type === 'expense' ? `/api/transactions/expenses/${id}` : `/api/transactions/income/${id}`;
        const res = await client.put(endpoint, data);
        return res.data;
      } else {
        // Switch type: Delete from original, Create in new
        const deleteEndpoint = originalType === 'expense' ? `/api/transactions/expenses/${id}` : `/api/transactions/income/${id}`;
        await client.delete(deleteEndpoint);
        
        const createEndpoint = type === 'expense' ? '/api/transactions/expenses/' : '/api/transactions/income/';
        const res = await client.post(createEndpoint, data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['month', selectedMonthId]);
      setEditingId(null);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ items, column, value }) => {
      await Promise.all(
        items.map((item) => {
          const endpoint = item.type === 'income'
            ? `/api/transactions/income/${item.id}`
            : `/api/transactions/expenses/${item.id}`;
          const data = {
            date: item.date,
            amount: item.amount,
            description: item.description,
            category: item.category,
            person: item.person,
            month_id: selectedMonthId,
            [column]: value,
          };
          return client.put(endpoint, data);
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['month', selectedMonthId]);
      setSelectedKeys(new Set());
      setBulkValue('');
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async ({ id, type }) => {
      const endpoint = type === 'expense' ? `/api/transactions/expenses/${id}` : `/api/transactions/income/${id}`;
      await client.delete(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['month', selectedMonthId]);
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data) => {
      const endpoint = data.type === 'expense' ? '/api/transactions/expenses/' : '/api/transactions/income/';
      const res = await client.post(endpoint, { ...data, month_id: selectedMonthId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['month', selectedMonthId]);
      setIsAdding(false);
      setNewTransaction({
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'Miscellaneous',
        person: 'Ana/Diego',
        amount: 0,
        type: 'expense'
      });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (data) => {
      const res = await client.post('/api/budgets/', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['month', selectedMonthId]);
    },
  });

  const handleStartEdit = (item, type) => {
    if (monthDetails.is_frozen) return;
    setEditingId(item.id);
    setEditValues({ ...item, type, originalType: type });
  };

  const handleSaveEdit = () => {
    updateTransactionMutation.mutate({
      id: editingId,
      type: editValues.type,
      originalType: editValues.originalType,
      data: {
        date: editValues.date,
        amount: parseFloat(editValues.amount),
        description: editValues.description,
        category: editValues.category,
        person: editValues.person,
        month_id: selectedMonthId
      }
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const rowKey = (t) => `${t.type}-${t.id}`;

  const toggleRow = (t) => {
    const key = rowKey(t);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApplyBulk = () => {
    const items = allTransactions.filter((t) => selectedKeys.has(rowKey(t)));
    if (items.length === 0 || !bulkValue) return;
    bulkUpdateMutation.mutate({ items, column: bulkColumn, value: bulkValue });
  };

  if (loadingMonths) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  const allTransactions = [
    ...(monthDetails?.expenses?.map(e => ({ ...e, type: 'expense' })) || []),
    ...(monthDetails?.incomes?.map(i => ({ ...i, type: 'income' })) || [])
  ].sort((a, b) => {
    const { key, direction } = sortConfig;
    let valA = a[key];
    let valB = b[key];

    if (key === 'date') {
      valA = new Date(valA);
      valB = new Date(valB);
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const budgets = monthDetails?.budgets || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">Data Editor</h1>
        <p className="text-gray-500 mt-1">Manage transactions and set budget targets.</p>
      </header>

      <MonthSelector 
        months={months} 
        selectedMonthId={selectedMonthId} 
        onSelect={(id) => setSelectedMonthId(id)} 
      />

      <div className="flex border-b border-gray-200 justify-between items-center pr-4">
        <div className="flex">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-all border-b-2 
              ${activeTab === 'transactions' 
                ? 'border-[#334960] text-[#334960]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <TableIcon className="w-4 h-4" /> Transactions
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-all border-b-2 
              ${activeTab === 'budget' 
                ? 'border-[#334960] text-[#334960]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Target className="w-4 h-4" /> Budget Targets
          </button>
        </div>
        
        {activeTab === 'transactions' && !monthDetails?.is_frozen && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-white border border-gray-200 text-[#334960] px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1 shadow-sm"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAdding ? 'Cancel' : 'Add Transaction'}
          </button>
        )}
      </div>

      {monthDetails?.is_frozen && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex items-center gap-3 text-amber-700">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">This month is frozen. Unfreeze it in History to make changes.</p>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {selectedKeys.size > 0 && !monthDetails?.is_frozen && (
            <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-[#334960]/5 border-b border-gray-100 text-sm">
              <span className="font-medium text-[#334960]">{selectedKeys.size} selected</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">Set</span>
              <select
                value={bulkColumn}
                onChange={(e) => setBulkColumn(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 outline-none font-medium"
              >
                <option value="person">Person</option>
                <option value="category">Category</option>
              </select>
              <span className="text-gray-500">to</span>
              <select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 outline-none"
              >
                <option value="" disabled>Choose…</option>
                {(bulkColumn === 'person' ? PERSONS : ALL_CATEGORIES).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <button
                onClick={handleApplyBulk}
                disabled={!bulkValue || bulkUpdateMutation.isPending}
                className="bg-[#334960] text-white px-3 py-1 rounded font-medium hover:bg-[#2a3c50] transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                {bulkUpdateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Apply
              </button>
              <button
                onClick={() => setSelectedKeys(new Set())}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  {!monthDetails?.is_frozen && (
                    <th className="px-6 py-3 w-12">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#334960] cursor-pointer align-middle"
                        ref={(el) => {
                          if (el) el.indeterminate = selectedKeys.size > 0 && selectedKeys.size < allTransactions.length;
                        }}
                        checked={allTransactions.length > 0 && selectedKeys.size === allTransactions.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedKeys(new Set(allTransactions.map(rowKey)));
                          else setSelectedKeys(new Set());
                        }}
                      />
                    </th>
                  )}
                  {[
                    { label: 'Date', key: 'date' },
                    { label: 'Description', key: 'description' },
                    { label: 'Type', key: 'type' },
                    { label: 'Category', key: 'category' },
                    { label: 'Person', key: 'person' },
                    { label: 'Amount', key: 'amount', align: 'right' }
                  ].map((col) => (
                    <th 
                      key={col.key}
                      className={`px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : ''}`}>
                        {col.label}
                        {sortConfig.key === col.key && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isAdding && (
                  <tr className="bg-blue-50/20">
                    {!monthDetails?.is_frozen && <td className="px-6 py-3 w-12"></td>}
                    <td className="px-6 py-3">
                      <input
                        type="date"
                        value={newTransaction.date}
                        onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                        className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input 
                        type="text" 
                        placeholder="Description..."
                        value={newTransaction.description} 
                        onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                        className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={newTransaction.type} 
                        onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                        className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full font-medium"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={newTransaction.category} 
                        onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                        className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                      >
                        {(newTransaction.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={newTransaction.person} 
                        onChange={(e) => setNewTransaction({...newTransaction, person: e.target.value})}
                        className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                      >
                        {PERSONS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        $
                        <input 
                          type="number" 
                          step="0.01"
                          value={newTransaction.amount} 
                          onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-24 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => createTransactionMutation.mutate(newTransaction)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setIsAdding(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {allTransactions.map((t) => (
                  <tr key={`${t.type}-${t.id}`} className={`hover:bg-gray-50/50 transition-colors ${editingId === t.id ? 'bg-blue-50/30' : selectedKeys.has(rowKey(t)) ? 'bg-blue-50/40' : ''}`}>
                    {!monthDetails?.is_frozen && (
                      <td
                        className="px-6 py-3 w-12 cursor-pointer"
                        onClick={() => toggleRow(t)}
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-[#334960] cursor-pointer align-middle pointer-events-none"
                          checked={selectedKeys.has(rowKey(t))}
                          readOnly
                        />
                      </td>
                    )}
                    <td className="px-6 py-3">
                      {editingId === t.id ? (
                        <input
                          type="date"
                          value={editValues.date} 
                          onChange={(e) => setEditValues({...editValues, date: e.target.value})}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                        />
                      ) : t.date}
                    </td>
                    <td className="px-6 py-3">
                      {editingId === t.id ? (
                        <input 
                          type="text" 
                          value={editValues.description} 
                          onChange={(e) => setEditValues({...editValues, description: e.target.value})}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                        />
                      ) : t.description}
                    </td>
                    <td className="px-6 py-3">
                      {editingId === t.id ? (
                        <select 
                          value={editValues.type} 
                          onChange={(e) => setEditValues({...editValues, type: e.target.value})}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full font-medium"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                          ${t.type === 'expense' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                          {t.type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {editingId === t.id ? (
                        <select 
                          value={editValues.category} 
                          onChange={(e) => setEditValues({...editValues, category: e.target.value})}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                        >
                          {(editValues.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.type === 'expense' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {t.category}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {editingId === t.id ? (
                        <select 
                          value={editValues.person} 
                          onChange={(e) => setEditValues({...editValues, person: e.target.value})}
                          className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-full"
                        >
                          {PERSONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : t.person}
                    </td>
                    <td className={`px-6 py-3 text-right font-medium ${t.type === 'expense' ? 'text-gray-800' : 'text-green-600'}`}>
                      {editingId === t.id ? (
                        <div className="flex items-center justify-end gap-1">
                          $
                          <input 
                            type="number" 
                            step="0.01"
                            value={editValues.amount} 
                            onChange={(e) => setEditValues({...editValues, amount: e.target.value})}
                            className="bg-white border border-gray-200 rounded px-2 py-1 outline-none w-24 text-right"
                          />
                        </div>
                      ) : `${t.type === 'income' ? '+' : ''}$${t.amount.toLocaleString()}`}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {editingId === t.id ? (
                          <>
                            <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {!monthDetails?.is_frozen && (
                              <button 
                                onClick={() => handleStartEdit(t, t.type)}
                                className="text-gray-400 hover:text-[#334960] transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => deleteTransactionMutation.mutate({ id: t.id, type: t.type })}
                              disabled={monthDetails?.is_frozen}
                              className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {allTransactions.length === 0 && (
                  <tr>
                    <td colSpan={monthDetails?.is_frozen ? 7 : 8} className="px-6 py-12 text-center text-gray-400">
                      No transactions found for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-right">Planned Amount</th>
                  <th className="px-6 py-3 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ALL_CATEGORIES.map((cat) => {
                  const budget = budgets.find(b => b.category === cat);
                  const isExpense = EXPENSE_CATEGORIES.includes(cat);
                  
                  return (
                    <tr key={cat} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-700">{cat}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${isExpense ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {isExpense ? 'Expense' : 'Income'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          $
                          <input 
                            type="number" 
                            defaultValue={budget?.planned_amount || 0}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (val !== (budget?.planned_amount || 0)) {
                                updateBudgetMutation.mutate({
                                  month_id: selectedMonthId,
                                  category: cat,
                                  type: isExpense ? 'expense' : 'income',
                                  planned_amount: val
                                });
                              }
                            }}
                            disabled={monthDetails?.is_frozen}
                            className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-24 text-right disabled:opacity-50"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {updateBudgetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin inline text-gray-400" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
