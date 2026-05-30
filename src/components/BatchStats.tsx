import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { IterationReport } from '../types';
import { TrendingDown, Percent, ListCollapse } from 'lucide-react';

interface BatchStatsProps {
  iterations: IterationReport[];
  threshold: number;
}

export default function BatchStats({ iterations, threshold }: BatchStatsProps) {
  // Map iterations to chart-friendly coordinates
  const data = iterations.map((item) => ({
    name: `Iter #${item.iteration_index}`,
    "Error Rate (%)": Number((item.batch_error_rate * 100).toFixed(1)),
    "Target Tau (%)": Number((threshold * 100).toFixed(1)),
  }));

  const currentErrorRate = iterations.length > 0
    ? iterations[iterations.length - 1].batch_error_rate
    : 0.0;

  const initialErrorRate = iterations.length > 0
    ? iterations[0].batch_error_rate
    : 0.0;

  const reduction = initialErrorRate > 0
    ? Math.max(0, Math.round(((initialErrorRate - currentErrorRate) / initialErrorRate) * 100))
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="font-display font-semibold text-slate-800 text-sm mb-4">Error Rate Convergence Trend</h3>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
          <TrendingDown className="w-8 h-8 text-slate-350 mb-2" />
          <p className="text-xs text-slate-500">No active iteration data recorded yet.</p>
          <p className="text-[10px] text-slate-400 mt-1">Run the multi-agent pipeline to begin convergence analysis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val}%`} tickLine={false} />
                <Tooltip formatter={(value: any) => [`${value}%`]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <ReferenceLine y={threshold * 100} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Target τ', fill: '#f43f5e', fontSize: 10, position: 'top' }} />
                <Line
                  type="monotone"
                  dataKey="Error Rate (%)"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  activeDot={{ r: 6 }}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-between border-l border-solid border-slate-100 pl-0 md:pl-5 pt-3 md:pt-0">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-400">Current Status</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-3xl font-bold text-slate-800">
                  {(currentErrorRate * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500 font-mono">error rate</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {currentErrorRate <= threshold
                  ? "✓ Satisfies target convergence threshold."
                  : "✗ Exceeds target convergence threshold. Requires further iteration."}
              </p>
            </div>

            <div className="border-t border-slate-105 pt-3 mt-3">
              <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-400">Time-Saving Metrics</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-2xl font-bold text-indigo-600">
                  {reduction > 0 ? `${reduction}%` : '---'}
                </span>
                <span className="text-xs text-slate-500">Error Reduction</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Based on ICML 2026 Bengali Dialect parameters.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
