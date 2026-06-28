import React from 'react';

export default function StatCard({ title, amount, trend, type = 'neutral' }) {
  const colorClasses = {
    positive: 'text-green-600',
    negative: 'text-red-500',
    neutral: 'text-gray-600',
    accent: 'text-[#334960]'
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-100 transition-all duration-150 hover:border-gray-200">
      <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-semibold", colorClasses[type])}>
          ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {trend !== undefined && (
          <span className={cn("text-xs font-medium", trend >= 0 ? 'text-green-600' : 'text-red-500')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
