import React from 'react';

export default function CategoryRow({ category, planned, actual, type = 'expense', onClick }) {
  const diff = actual - planned;
  const isOverBudget = type === 'expense' ? diff > 0 : diff < 0;
  const isUnderBudget = type === 'expense' ? diff < 0 : diff > 0;

  const diffColor = isOverBudget ? 'text-red-500' : isUnderBudget ? 'text-green-600' : 'text-gray-400';

  // A category with no budget (planned 0) but actual spending has no meaningful
  // percentage — show a full bar in the accent navy rather than an empty track.
  const noBudget = planned <= 0 && actual > 0;
  const percentage = planned > 0 ? (actual / planned) * 100 : 0;
  const barWidth = noBudget ? 100 : Math.min(percentage, 100);
  const barColor = noBudget ? 'bg-[#334960]' : isOverBudget ? 'bg-red-500' : 'bg-[#334960]';

  const clickable = typeof onClick === 'function';

  return (
    <div
      className={`py-4 border-b border-gray-50 last:border-0 group ${
        clickable ? 'cursor-pointer hover:bg-gray-50/70 -mx-2 px-2 rounded-md transition-colors' : ''
      }`}
      onClick={clickable ? () => onClick(category) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(category); } } : undefined}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-gray-700">{category}</span>
        <div className="text-sm font-semibold">
          <span className="text-gray-400 font-normal">Actual: </span>
          <span>${actual.toLocaleString()}</span>
          <span className="mx-2 text-gray-200">|</span>
          <span className="text-gray-400 font-normal">Goal: </span>
          <span>${planned.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ease-out ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-16 text-right ${diffColor}`}>
          {diff > 0 ? '+' : ''}{diff.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
