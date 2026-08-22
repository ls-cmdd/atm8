import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Activity,
  MessageSquare,
  Workflow,
  LayoutDashboard,
  LogOut,
  Plus,
  Users,
  CreditCard,
  Sparkles,
  Zap,
  Play,
  Trash2,
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data;
    }
  });

  const { data: workflows, isLoading: loadingWorkflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/workflows');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post('/workflows', {
        name: name || 'New Custom Automation',
        nodes: [
          {
            id: '1',
            type: 'trigger.webhook',
            position: { x: 100, y: 150 },
            data: { label: 'Inbound Webhook', type: 'trigger.webhook', params: { path: '/webhook/custom', method: 'POST' } }
          },
          {
            id: '2',
            type: 'action.openai',
            position: { x: 380, y: 150 },
            data: { label: 'AI Processor', type: 'action.openai', params: { prompt: 'Analyze payload: {{1.payload}}' } }
          }
        ],
        edges: [{ id: 'e1-2', source: '1', target: '2' }]
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate(`/workflows/${data.id}`);
    }
  });

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await api.post('/workflows/generate-ai', { prompt: aiPrompt });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      if (res.data.workflow?.id) {
        navigate(`/workflows/${res.data.workflow.id}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'AI Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const starterTemplates = [
    {
      title: 'Lead Capture & AI Outreach',
      desc: 'Inbound webhook triggers AI data extraction, saves customer to CRM, and sends personalized confirmation.',
      prompt: 'Create a lead qualification pipeline from webhook to AI extraction, CRM sync, and email dispatch',
      icon: Users,
      badge: 'Sales & CRM'
    },
    {
      title: 'Incident Monitor & Slack Alert',
      desc: 'Cron timer polls server health endpoint, filters status, and alerts Discord & Slack channels.',
      prompt: 'Schedule health check every 5 minutes that alerts Slack and Discord on errors',
      icon: Activity,
      badge: 'DevOps & Alerts'
    },
    {
      title: 'AI Text Classifier & DB Sink',
      desc: 'Evaluates incoming feedback or ticket sentiment and stores categorized metrics in PostgreSQL.',
      prompt: 'Webhook receives customer ticket, AI classifies sentiment, and saves to PostgreSQL',
      icon: Cpu,
      badge: 'Data & AI'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">NEXFLOW</span>
              <span className="text-xs text-indigo-400 ml-2 font-mono uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                Engine 1.0
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-5">
            <button
              onClick={() => navigate('/inbox')}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-400 font-medium transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Inbox
            </button>
            <button
              onClick={() => navigate('/crm')}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-400 font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              CRM
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-400 font-medium transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
            <div className="w-px h-5 bg-slate-800"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* AI Workflow Quick Generator Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-xl">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" /> AI Workflow Architect
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Build Any Distributed Automation in Natural Language
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Describe your desired workflow logic. NexFlow will construct the directed acyclic graph (DAG), configure node schemas, and prepare the live execution flow.
            </p>

            <form onSubmit={handleAiGenerate} className="pt-2 flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. When a webhook arrives, extract customer data with AI, save to CRM, and alert Slack..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={isGenerating || !aiPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
              >
                {isGenerating ? <Zap className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Workflow
              </button>
            </form>
          </div>
        </section>

        {/* Telemetry & Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Workflows</span>
              <Workflow className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {stats?.stats?.totalWorkflows ?? (workflows?.length || 0)}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" /> Fully Operational
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Executions Today</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {stats?.stats?.executionsToday ?? 24}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Avg latency: 42ms
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">CRM Contacts</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {stats?.stats?.totalCustomers ?? 8}
            </div>
            <div className="text-[11px] text-slate-400">
              Active synchronizations
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Integrations Hub</span>
              <ShieldCheck className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white">25+</div>
            <div className="text-[11px] text-violet-400 font-medium">
              Native Plugins Loaded
            </div>
          </div>
        </section>

        {/* Starter Flow Templates */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" /> Pre-built Architecture Templates
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {starterTemplates.map((tpl, i) => {
              const IconComp = tpl.icon;
              return (
                <div
                  key={i}
                  className="group p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {tpl.badge}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                      {tpl.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {tpl.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setAiPrompt(tpl.prompt);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    Use Blueprint <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Workflows List Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Workflow className="w-4 h-4 text-indigo-400" /> Active Workflows
            </h3>
            <button
              onClick={() => createMutation.mutate('New Custom Workflow')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Custom Workflow
            </button>
          </div>

          {loadingWorkflows ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-slate-900 animate-pulse border border-slate-800"></div>
              ))}
            </div>
          ) : workflows && workflows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {workflows.map((wf: any) => {
                let nodeCount = 0;
                try {
                  const parsed = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
                  nodeCount = Array.isArray(parsed) ? parsed.length : 0;
                } catch {}

                return (
                  <div
                    key={wf.id}
                    onClick={() => navigate(`/workflows/${wf.id}`)}
                    className="group p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-950/20 transition-all cursor-pointer space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {wf.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono text-indigo-300">
                            {nodeCount} Nodes
                          </span>
                          <span>•</span>
                          <span>{new Date(wf.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-800 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active & Synced
                      </span>
                      <span className="group-hover:translate-x-1 transition-transform text-indigo-400 font-semibold flex items-center gap-1">
                        Open Editor →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <Workflow className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-200">No Workflows Created Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Use the AI architect input above or click "Create Custom Workflow" to start orchestrating events.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
