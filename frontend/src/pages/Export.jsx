import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import MonthSelector from '../components/MonthSelector';
import { FileSpreadsheet, FileText, Download, Loader2, Info } from 'lucide-react';

export default function ExportPage() {
  const [selectedMonthId, setSelectedMonthId] = useState(null);

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

  const handleExport = (format) => {
    if (!selectedMonthId) return;
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const url = `${API_URL}/api/export/${format}/${selectedMonthId}`;
    
    // Create a temporary link and click it to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export.${format === 'excel' ? 'xlsx' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingMonths) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">Export Data</h1>
        <p className="text-gray-500 mt-1">Download your financial data for external use or backups.</p>
      </header>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 text-blue-600 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <Info className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Exporting as Excel will include a summary of planned vs actual, expenses, and incomes in separate sheets.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Step 1: Select Month</h2>
          <MonthSelector 
            months={months} 
            selectedMonthId={selectedMonthId} 
            onSelect={setSelectedMonthId} 
          />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Step 2: Choose Format</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleExport('excel')}
              disabled={!selectedMonthId}
              className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-gray-100 hover:border-[#334960] hover:bg-gray-50 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Microsoft Excel (.xlsx)</h3>
                <p className="text-sm text-gray-500 mt-1">Full report with summary and charts compatibility.</p>
              </div>
              <div className="flex items-center gap-2 text-[#334960] font-semibold text-sm">
                <Download className="w-4 h-4" /> Download Excel
              </div>
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={!selectedMonthId}
              className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-gray-100 hover:border-[#334960] hover:bg-gray-50 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Comma Separated (.csv)</h3>
                <p className="text-sm text-gray-500 mt-1">Raw expense data for generic data processing.</p>
              </div>
              <div className="flex items-center gap-2 text-[#334960] font-semibold text-sm">
                <Download className="w-4 h-4" /> Download CSV
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h2 className="font-semibold text-gray-700 mb-2">Why Export?</h2>
        <ul className="text-sm text-gray-500 space-y-2 list-disc pl-5">
          <li>Keep personal backups of your data.</li>
          <li>Import into other spreadsheet tools for advanced analysis.</li>
          <li>Share specific monthly reports with family members.</li>
          <li>Tax season preparation.</li>
        </ul>
      </div>
    </div>
  );
}
