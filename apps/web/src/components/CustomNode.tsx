import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Webhook,
  Clock,
  FileInput,
  Sparkles,
  Cpu,
  Tags,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Headphones,
  Globe,
  Filter,
  Code2,
  Binary,
  Table,
  Rss,
  Timer,
  ShieldAlert,
  Workflow,
  Database,
  HardDrive,
  Cloud,
  Sheet,
  GitBranch,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Webhook,
  Clock,
  FileInput,
  Sparkles,
  Cpu,
  Tags,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Headphones,
  Globe,
  Filter,
  Code2,
  Binary,
  Table,
  Rss,
  Timer,
  ShieldAlert,
  Workflow,
  Database,
  HardDrive,
  Cloud,
  Sheet,
  GitBranch,
  Users
};

export const CustomNode = memo(({ data, selected }: any) => {
  const nodeType = data.type || '';
  let category = 'actions';
  if (nodeType.startsWith('trigger.')) category = 'triggers';
  else if (nodeType.startsWith('action.ai') || nodeType === 'action.openai' || nodeType === 'action.ollama') category = 'ai';
  else if (nodeType === 'action.filter' || nodeType === 'action.code' || nodeType === 'action.jsonTransform' || nodeType === 'action.delay' || nodeType === 'action.errorHandler') category = 'logic';
  else if (nodeType === 'action.postgres' || nodeType === 'action.redis' || nodeType === 'action.awsS3' || nodeType === 'action.googleSheets' || nodeType === 'action.dbQuery') category = 'storage';
  else if (nodeType === 'action.sendEmail' || nodeType === 'action.slack' || nodeType === 'action.discord' || nodeType === 'action.telegram' || nodeType === 'action.chatwootReply') category = 'communication';

  const categoryColors: Record<string, { bg: string; border: string; badge: string; text: string; headerBg: string }> = {
    triggers: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', text: 'text-amber-500', headerBg: 'bg-amber-500/10' },
    ai: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', badge: 'bg-indigo-500/20 text-indigo-400', text: 'text-indigo-500', headerBg: 'bg-indigo-500/10' },
    logic: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', text: 'text-emerald-500', headerBg: 'bg-emerald-500/10' },
    communication: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', badge: 'bg-sky-500/20 text-sky-400', text: 'text-sky-500', headerBg: 'bg-sky-500/10' },
    storage: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', badge: 'bg-violet-500/20 text-violet-400', text: 'text-violet-500', headerBg: 'bg-violet-500/10' },
    actions: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400', text: 'text-blue-500', headerBg: 'bg-blue-500/10' }
  };

  const colors = categoryColors[category] || categoryColors.actions;
  const IconComponent = ICON_MAP[data.icon || ''] || Globe;

  const status = data.executionStatus; // 'running' | 'success' | 'failed'

  return (
    <div
      className={`relative min-w-[240px] max-w-[280px] rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'ring-2 ring-indigo-500 border-indigo-400' : 'border-slate-700/80 hover:border-slate-600'
      } ${status === 'success' ? 'border-emerald-500 shadow-emerald-500/10 ring-1 ring-emerald-500/50' : ''} ${
        status === 'failed' ? 'border-rose-500 shadow-rose-500/10 ring-1 ring-rose-500/50' : ''
      } ${status === 'running' ? 'border-indigo-400 ring-2 ring-indigo-400/50 shadow-indigo-500/20' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 hover:!bg-indigo-400 transition-colors"
      />

      {/* Header */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-t-xl border-b border-slate-800 ${colors.headerBg}`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${colors.bg} ${colors.text}`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <span className={`text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded ${colors.badge}`}>
              {category}
            </span>
          </div>
        </div>

        {/* Execution Status Badge */}
        <div>
          {status === 'running' && (
            <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </span>
          )}
          {status === 'success' && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          )}
          {status === 'failed' && (
            <span className="flex items-center gap-1 text-[11px] text-rose-400 font-medium">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-1.5">
        <h4 className="text-sm font-semibold text-slate-100 tracking-tight leading-snug">
          {data.label || 'Node'}
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed font-mono truncate">
          {data.type}
        </p>

        {data.params && Object.keys(data.params).length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
            {Object.entries(data.params).slice(0, 2).map(([k, v]) => (
              <span key={k} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded max-w-full truncate font-mono">
                {k}: {String(v).slice(0, 18)}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-900 hover:!bg-indigo-300 transition-colors"
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
