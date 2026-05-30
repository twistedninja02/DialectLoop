import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ShieldAlert, CheckCircle, Brain, RefreshCw } from 'lucide-react';

interface AgentBadgeProps {
  name: 'Auditor' | 'Verifier' | 'Critic' | 'Summariser';
  status: 'idle' | 'working' | 'done' | 'mismatch';
  description: string;
}

export default function AgentBadge({ name, status, description }: AgentBadgeProps) {
  const agentIcons = {
    Auditor: <Search className="w-5 h-5 text-indigo-600" />,
    Verifier: <Brain className="w-5 h-5 text-emerald-600" />,
    Critic: <ShieldAlert className="w-5 h-5 text-amber-600" />,
    Summariser: <CheckCircle className="w-5 h-5 text-purple-600" />,
  };

  const statusColors = {
    idle: 'bg-slate-100 border-slate-200 text-slate-500',
    working: 'bg-indigo-50 border-indigo-250 text-indigo-700 animate-pulse border-dashed',
    done: 'bg-emerald-50 border-emerald-250 text-emerald-800',
    mismatch: 'bg-rose-50 border-rose-250 text-rose-800',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden p-4 rounded-xl border border-solid transition-all duration-300 shadow-sm ${statusColors[status]} bg-white`}
    >
      {/* Animated progress overlay when working */}
      {status === 'working' && (
        <motion.div
          className="absolute inset-0 bg-indigo-500/5 mix-blend-overlay"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        />
      )}

      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center`}>
          {agentIcons[name]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-display font-semibold text-slate-900 text-sm leading-tight">
              {name === 'Auditor' ? 'Transcription Auditor' :
               name === 'Verifier' ? 'Dialect Verifier' :
               name === 'Critic' ? 'Critic Agent' : 'Summariser Agent'}
            </h4>
            <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full uppercase border
              ${status === 'idle' ? 'bg-slate-100 border-slate-200 text-slate-600' :
                status === 'working' ? 'bg-indigo-150 border-indigo-200 text-indigo-700' :
                status === 'done' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                'bg-rose-100 border-rose-200 text-rose-700'}`}
            >
              {status === 'working' ? (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> RUNNING
                </span>
              ) : status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
