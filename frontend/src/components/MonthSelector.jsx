import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export default function MonthSelector({ months, selectedMonthId, onSelect }) {
  const selectedMonth = months?.find(m => m.id === selectedMonthId);
  const [currentYear, setCurrentYear] = React.useState(selectedMonth?.year || new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState(selectedMonth?.month || new Date().getMonth() + 1);

  React.useEffect(() => {
    if (selectedMonth) {
      setCurrentYear(selectedMonth.year);
      setCurrentMonth(selectedMonth.month);
    }
  }, [selectedMonth]);

  const years = Array.from(new Set(months?.map(m => m.year) || [])).sort((a, b) => b - a);

  const availableMonths = React.useMemo(() => {
    return months
      ?.filter(m => m.year === currentYear)
      .map(m => m.month)
      .sort((a, b) => a - b) || [];
  }, [months, currentYear]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleYearChange = (year) => {
    const val = parseInt(year);
    setCurrentYear(val);
    const monthsForNewYear = months?.filter(m => m.year === val).map(m => m.month) || [];
    let nextMonth = currentMonth;
    if (!monthsForNewYear.includes(currentMonth) && monthsForNewYear.length > 0) {
      nextMonth = monthsForNewYear[0];
      setCurrentMonth(nextMonth);
    }
    triggerSelect(val, nextMonth);
  };

  const handleMonthChange = (month) => {
    const val = parseInt(month);
    setCurrentMonth(val);
    triggerSelect(currentYear, val);
  };

  const triggerSelect = (y, m) => {
    const found = months?.find(item => item.year === y && item.month === m);
    onSelect(found ? found.id : null, { year: y, month: m });
  };

  return (
    <div className="flex items-center gap-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 text-[#334960]">
        <Calendar className="w-5 h-5" />
        <span className="font-bold">Select Period:</span>
      </div>
      
      <div className="flex gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Year</label>
          <select 
            value={currentYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#334960]/20 transition-all cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Month</label>
          <select 
            value={currentMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#334960]/20 transition-all cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthNames[m - 1]}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedMonth?.is_frozen && (
        <div className="ml-auto flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border border-amber-100">
          <span className="text-sm">🔒</span> Frozen
        </div>
      )}
    </div>
  );
}
