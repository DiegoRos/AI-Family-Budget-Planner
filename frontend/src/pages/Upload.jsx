import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2, Save, X, Trash2, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import client from '../api/client';
import { PERSONS } from '../api/constants';
import { useConfig } from '../api/useConfig';

// Collision-proof local id (parallel results can resolve in the same ms).
const newLocalId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function UploadPage() {
  const { data: config } = useConfig();
  const EXPENSE_CATEGORIES = config?.expense_categories ?? [];
  const INCOME_CATEGORIES = config?.income_categories ?? [];
  const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  const [extractedTransactions, setExtractedTransactions] = useState([]);
  // Per-file progress: { id, name, status: 'queued'|'extracting'|'done'|'error', note, count, error }
  const [fileStatuses, setFileStatuses] = useState([]);
  const [saveStatus, setSaveStatus] = useState({ loading: false, success: false, error: null });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkColumn, setBulkColumn] = useState('person');
  const [bulkValue, setBulkValue] = useState('');
  const queryClient = useQueryClient();

  const isExtracting = fileStatuses.some(
    (f) => f.status === 'queued' || f.status === 'extracting'
  );

  // Fetch months to map year/month to month_id
  const { data: months } = useQuery({
    queryKey: ['months'],
    queryFn: async () => {
      const res = await client.get('/api/months/');
      return res.data;
    },
  });

  const extractOne = useCallback(async (file, id) => {
    setFileStatuses(prev =>
      prev.map(f => f.id === id ? { ...f, status: 'extracting' } : f)
    );

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await client.post('/api/extract/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transactionsWithId = (res.data.transactions || []).map((t) => ({
        ...t,
        localId: newLocalId(),
      }));

      // Append so multiple files accumulate into one combined review table.
      setExtractedTransactions(prev => [...prev, ...transactionsWithId]);
      setFileStatuses(prev =>
        prev.map(f => f.id === id
          ? { ...f, status: 'done', note: res.data.filter_note, count: transactionsWithId.length }
          : f
        )
      );
    } catch (err) {
      console.error(`Extraction failed for ${file.name}`, err);
      setFileStatuses(prev =>
        prev.map(f => f.id === id
          ? { ...f, status: 'error', error: err.response?.data?.detail || 'Extraction failed. Is Ollama running?' }
          : f
        )
      );
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setSaveStatus({ loading: false, success: false, error: null });

    const queued = acceptedFiles.map((file) => ({
      id: newLocalId(),
      file,
      name: file.name,
      status: 'queued',
    }));

    setFileStatuses(prev => [
      ...prev,
      ...queued.map(({ file, ...rest }) => rest),
    ]);

    // Fire all files at once; the backend (Ollama at NUM_PARALLEL=1) drains
    // them serially. allSettled keeps successful files even if one fails.
    await Promise.allSettled(queued.map(({ file, id }) => extractOne(file, id)));
  }, [extractOne]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: true
  });

  const handleUpdateTransaction = (localId, field, value) => {
    setExtractedTransactions(prev => 
      prev.map(t => t.localId === localId ? { ...t, [field]: value } : t)
    );
  };

  const handleRemoveTransaction = (localId) => {
    setExtractedTransactions(prev => prev.filter(t => t.localId !== localId));
    setSelectedIds(prev => {
      if (!prev.has(localId)) return prev;
      const next = new Set(prev);
      next.delete(localId);
      return next;
    });
  };

  // Reset the bulk value whenever the target column changes
  useEffect(() => {
    setBulkValue('');
  }, [bulkColumn]);

  const toggleRow = (localId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  };

  const handleApplyBulk = () => {
    if (selectedIds.size === 0 || !bulkValue) return;
    setExtractedTransactions(prev =>
      prev.map(t => selectedIds.has(t.localId) ? { ...t, [bulkColumn]: bulkValue } : t)
    );
    setSelectedIds(new Set());
    setBulkValue('');
  };

  const handleSaveAll = async () => {
    if (extractedTransactions.length === 0) return;

    setSaveStatus({ loading: true, success: false, error: null });
    
    try {
      const currentMonths = [...(months || [])];
      
      for (const t of extractedTransactions) {
        const dateObj = new Date(t.date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1; // 1-12

        // Find or create month
        let monthData = currentMonths.find(m => m.year === year && m.month === month);
        
        if (!monthData) {
          const res = await client.post('/api/months/', {
            year,
            month,
            is_frozen: false,
            start_balance: 0,
            end_balance: 0
          });
          monthData = res.data;
          currentMonths.push(monthData);
        }

        if (monthData.is_frozen) {
          throw new Error(`Month ${year}-${month} is frozen. Please unfreeze it first.`);
        }

        const isExpense = EXPENSE_CATEGORIES.includes(t.category);
        const endpoint = isExpense ? '/api/transactions/expenses/' : '/api/transactions/income/';
        
        await client.post(endpoint, {
          date: t.date,
          amount: parseFloat(t.amount),
          description: t.description,
          category: t.category,
          person: t.person,
          month_id: monthData.id
        });
      }

      setSaveStatus({ loading: false, success: true, error: null });
      setExtractedTransactions([]);
      setSelectedIds(new Set());
      setFileStatuses([]);
      queryClient.invalidateQueries(['months']);
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus({ loading: false, success: false, error: err.response?.data?.detail || err.message });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">Upload & Extract</h1>
        <p className="text-gray-500 mt-1">Upload receipts, invoices or bank statements to automatically extract expenses.</p>
      </header>

      {/* Dropzone */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-[#334960] bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Drop the files here' : 'Drag & drop one or more files here, or click to select'}
          </p>
          <p className="text-sm text-gray-400 mt-1">Supports PDF, PNG, JPG, CSV, Excel, and TXT · upload several at once</p>
        </div>
      </div>

      {!isExtracting && extractedTransactions.length === 0 && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="flex-1 h-px bg-gray-100"></div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest px-2">or</span>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>
          <button 
            onClick={() => setExtractedTransactions([{
              localId: newLocalId(),
              date: new Date().toISOString().split('T')[0],
              description: '', 
              category: 'Miscellaneous', 
              person: 'Ana/Diego', 
              amount: 0, 
              type: 'expense' 
            }])}
            className="bg-white border border-gray-200 text-[#334960] px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 group"
          >
            <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#334960] transition-colors" />
            Enter Transactions Manually
          </button>
        </div>
      )}

      {fileStatuses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          <div className="px-6 py-3 flex justify-between items-center bg-gray-50/50">
            <h2 className="font-semibold text-gray-800 text-sm">
              Documents ({fileStatuses.filter(f => f.status === 'done').length}/{fileStatuses.length} done)
            </h2>
            {!isExtracting && (
              <button
                onClick={() => setFileStatuses([])}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Dismiss
              </button>
            )}
          </div>
          {fileStatuses.map((f) => (
            <div key={f.id} className="px-6 py-3 flex items-center gap-3 text-sm">
              <span className="shrink-0">
                {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {f.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                {f.status === 'extracting' && <Loader2 className="w-4 h-4 text-[#334960] animate-spin" />}
                {f.status === 'queued' && <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />}
              </span>
              <span className="font-medium text-gray-700 truncate flex-1">{f.name}</span>
              <span className="text-gray-400 text-xs text-right shrink-0">
                {f.status === 'queued' && 'Queued'}
                {f.status === 'extracting' && 'DeepSeek-R1 analyzing…'}
                {f.status === 'done' && (
                  <>
                    {f.count} found{f.note ? ` · ${f.note}` : ''}
                  </>
                )}
                {f.status === 'error' && <span className="text-red-500">{f.error}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {extractedTransactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="font-semibold text-gray-800">Extracted Transactions ({extractedTransactions.length})</h2>
            <div className="flex gap-3">
              <button 
                onClick={() => setExtractedTransactions(prev => [
                  ...prev,
                  {
                    localId: newLocalId(),
                    date: new Date().toISOString().split('T')[0],
                    description: '', 
                    category: 'Miscellaneous', 
                    person: 'Ana/Diego', 
                    amount: 0, 
                    type: 'expense' 
                  }
                ])}
                className="bg-white border border-gray-200 text-[#334960] px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
              <button
                onClick={() => { setExtractedTransactions([]); setSelectedIds(new Set()); }}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Clear All
              </button>
              <button 
                onClick={handleSaveAll}
                disabled={saveStatus.loading}
                className="bg-[#334960] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2a3c4f] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saveStatus.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to Database
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-[#334960]/5 border-b border-gray-100 text-sm">
              <span className="font-medium text-[#334960]">{selectedIds.size} selected</span>
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
                disabled={!bulkValue}
                className="bg-[#334960] text-white px-3 py-1 rounded font-medium hover:bg-[#2a3c4f] transition-colors disabled:opacity-40"
              >
                Apply
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
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
                  <th className="px-6 py-3 w-12">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-[#334960] cursor-pointer align-middle"
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < extractedTransactions.length;
                      }}
                      checked={extractedTransactions.length > 0 && selectedIds.size === extractedTransactions.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(extractedTransactions.map(t => t.localId)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Person</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {extractedTransactions.map((t) => (
                  <tr key={t.localId} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.has(t.localId) ? 'bg-blue-50/40' : ''}`}>
                    <td
                      className="px-6 py-3 w-12 cursor-pointer"
                      onClick={() => toggleRow(t.localId)}
                    >
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#334960] cursor-pointer align-middle pointer-events-none"
                        checked={selectedIds.has(t.localId)}
                        readOnly
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="date"
                        value={t.date}
                        onChange={(e) => handleUpdateTransaction(t.localId, 'date', e.target.value)}
                        className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input 
                        type="text" 
                        value={t.description} 
                        onChange={(e) => handleUpdateTransaction(t.localId, 'description', e.target.value)}
                        className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={t.type || (EXPENSE_CATEGORIES.includes(t.category) ? 'expense' : 'income')} 
                        onChange={(e) => handleUpdateTransaction(t.localId, 'type', e.target.value)}
                        className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full appearance-none cursor-pointer font-medium"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={t.category} 
                        onChange={(e) => handleUpdateTransaction(t.localId, 'category', e.target.value)}
                        className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full appearance-none cursor-pointer"
                      >
                        {(t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        {/* Fallback for mixed lists */}
                        {! (t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).includes(t.category) && (
                          <option value={t.category}>{t.category}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={t.person} 
                        onChange={(e) => handleUpdateTransaction(t.localId, 'person', e.target.value)}
                        className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full appearance-none cursor-pointer"
                      >
                        {PERSONS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        $
                        <input 
                          type="number" 
                          step="0.01"
                          value={t.amount} 
                          onChange={(e) => handleUpdateTransaction(t.localId, 'amount', e.target.value)}
                          className="bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-20 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <button 
                        onClick={() => handleRemoveTransaction(t.localId)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {saveStatus.success && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center gap-3 text-green-700 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">All transactions saved successfully!</p>
        </div>
      )}

      {saveStatus.error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{saveStatus.error}</p>
        </div>
      )}
    </div>
  );
}
