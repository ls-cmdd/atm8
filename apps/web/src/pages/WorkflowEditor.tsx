import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant
} from '@xyflow/react';
import type { Connection, Edge, NodeChange, EdgeChange, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import debounce from 'lodash/debounce';
import { io, Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import YAML from 'yaml';
import {
  Play,
  Save,
  Settings,
  ChevronLeft,
  Search,
  Sparkles,
  Code2,
  Terminal,
  Layers,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Globe,
  Sliders,
  Sun,
  Moon,
  Languages,
  Plus,
  PlayCircle,
  Eye
} from 'lucide-react';
import { CustomNode } from '../components/CustomNode';

interface RegistryParam {
  name: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'json' | 'code';
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: string }[];
  placeholder?: string;
  description?: string;
}

interface RegistryNode {
  type: string;
  label: string;
  category: 'triggers' | 'actions' | 'logic' | 'ai' | 'communication' | 'storage';
  icon: string;
  description: string;
  paramsSchema: RegistryParam[];
}

interface ExecutionLog {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeType?: string;
  status: 'started' | 'success' | 'failed';
  result?: any;
  error?: string;
}

export function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [registry, setRegistry] = useState<RegistryNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'code' | 'logs'>('canvas');
  const [codeFormat, setCodeFormat] = useState<'json' | 'yaml'>('json');
  const [rawCode, setRawCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [isTestingNode, setIsTestingNode] = useState(false);
  const [singleNodeTestResult, setSingleNodeTestResult] = useState<any>(null);
  const [isRTL, setIsRTL] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Fetch Nodes Registry
  useEffect(() => {
    api.get('/nodes/registry').then((res) => {
      setRegistry(res.data || []);
    });
  }, []);

  // Fetch Workflow Data
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await api.get(`/workflows/${id}`);
      return res.data;
    }
  });

  // Sync Workflow Nodes & Edges
  useEffect(() => {
    if (workflow) {
      try {
        const parsedNodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes || [];
        const parsedEdges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges || [];

        // Format into custom ReactFlow nodes
        const formattedNodes = parsedNodes.map((n: any) => ({
          ...n,
          type: 'custom',
          data: {
            ...n.data,
            type: n.data?.type || n.type,
            label: n.data?.label || n.label,
            params: n.data?.params || n.params || {}
          }
        }));

        setNodes(formattedNodes);
        setEdges(parsedEdges);
        updateRawCodeString(formattedNodes, parsedEdges, codeFormat);
      } catch (e) {
        console.error('Error parsing workflow data:', e);
      }
    }
  }, [workflow]);

  // Socket.IO Real-time Execution Tracking
  useEffect(() => {
    socketRef.current = io('/', { path: '/socket.io' });

    socketRef.current.on('execution.step.started', (data: any) => {
      if (data.workflowId === id) {
        setNodes((nds) =>
          nds.map((n) => (n.id === data.nodeId ? { ...n, data: { ...n.data, executionStatus: 'running' } } : n))
        );
        setExecutionLogs((prev) => [
          {
            id: `log_${Date.now()}_${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            nodeId: data.nodeId,
            status: 'started'
          },
          ...prev
        ]);
      }
    });

    socketRef.current.on('execution.step.completed', (data: any) => {
      if (data.workflowId === id) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === data.nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    executionStatus: data.status,
                    lastResult: data.result,
                    lastError: data.error
                  }
                }
              : n
          )
        );

        setExecutionLogs((prev) => [
          {
            id: `log_${Date.now()}_${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            nodeId: data.nodeId,
            nodeType: data.nodeType,
            status: data.status,
            result: data.result,
            error: data.error
          },
          ...prev
        ]);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [id]);

  const updateRawCodeString = (nds: Node[], edgs: Edge[], format: 'json' | 'yaml') => {
    const payload = {
      name: workflow?.name || 'NexFlow Automation',
      nodes: nds.map((n) => ({ id: n.id, type: n.data.type, label: n.data.label, params: n.data.params, position: n.position })),
      edges: edgs
    };
    if (format === 'yaml') {
      setRawCode(YAML.stringify(payload));
    } else {
      setRawCode(JSON.stringify(payload, null, 2));
    }
  };

  // Debounced Auto-Save
  const saveChanges = useCallback(
    debounce(async (newNodes: Node[], newEdges: Edge[]) => {
      setIsSaving(true);
      try {
        const cleanNodes = newNodes.map((n) => ({
          id: n.id,
          type: n.data?.type || n.type,
          position: n.position,
          data: {
            label: n.data?.label,
            type: n.data?.type,
            params: n.data?.params || {}
          }
        }));
        await api.put(`/workflows/${id}`, { nodes: cleanNodes, edges: newEdges });
      } catch (e) {
        console.error('Save failed:', e);
      } finally {
        setIsSaving(false);
      }
    }, 800),
    [id]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const newNodes = applyNodeChanges(changes, nodes);
      setNodes(newNodes);
      saveChanges(newNodes, edges);
      updateRawCodeString(newNodes, edges, codeFormat);
    },
    [nodes, edges, saveChanges, codeFormat]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const newEdges = applyEdgeChanges(changes, edges);
      setEdges(newEdges);
      saveChanges(nodes, newEdges);
      updateRawCodeString(nodes, newEdges, codeFormat);
    },
    [nodes, edges, saveChanges, codeFormat]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, animated: true, style: { stroke: '#6366F1', strokeWidth: 2 } }, edges);
      setEdges(newEdges);
      saveChanges(nodes, newEdges);
      updateRawCodeString(nodes, newEdges, codeFormat);
    },
    [nodes, edges, saveChanges, codeFormat]
  );

  const addNodeFromRegistry = (regNode: RegistryNode) => {
    const defaultParams: Record<string, any> = {};
    regNode.paramsSchema.forEach((p) => {
      if (p.defaultValue !== undefined) defaultParams[p.name] = p.defaultValue;
    });

    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'custom',
      position: {
        x: (nodes.length * 50) % 400 + 100,
        y: (nodes.length * 60) % 350 + 100
      },
      data: {
        label: regNode.label,
        type: regNode.type,
        icon: regNode.icon,
        params: defaultParams
      }
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setSelectedNode(newNode);
    saveChanges(newNodes, edges);
    updateRawCodeString(newNodes, edges, codeFormat);
  };

  const updateNodeParam = (paramName: string, value: any) => {
    if (!selectedNode) return;
    const newNodes = nodes.map((n) => {
      if (n.id === selectedNode.id) {
        return {
          ...n,
          data: {
            ...n.data,
            params: {
              ...n.data.params,
              [paramName]: value
            }
          }
        };
      }
      return n;
    });
    setNodes(newNodes);
    const updatedSelected = newNodes.find((n) => n.id === selectedNode.id) || null;
    setSelectedNode(updatedSelected);
    saveChanges(newNodes, edges);
    updateRawCodeString(newNodes, edges, codeFormat);
  };

  const handleTestRun = async () => {
    // Reset execution statuses
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, executionStatus: undefined } })));
    setExecutionLogs([]);
    try {
      await api.post(`/workflows/${id}/test-run`, { payload: { source: 'manual_ui_test', timestamp: Date.now() } });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Test Run execution failed');
    }
  };

  const handleSingleNodeTest = async () => {
    if (!selectedNode) return;
    setIsTestingNode(true);
    setSingleNodeTestResult(null);
    try {
      const res = await api.post(`/workflows/${id}/test-node`, {
        node: {
          id: selectedNode.id,
          type: selectedNode.data.type,
          params: selectedNode.data.params
        },
        context: {
          sample: 'test_payload',
          timestamp: new Date().toISOString()
        }
      });
      setSingleNodeTestResult(res.data.result);
    } catch (err: any) {
      setSingleNodeTestResult({ error: err.response?.data?.error || err.message });
    } finally {
      setIsTestingNode(false);
    }
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const res = await api.post('/workflows/generate-ai', { prompt: aiPrompt });
      const generated = res.data.generated;
      if (generated && generated.nodes) {
        const formatted = generated.nodes.map((n: any) => ({
          ...n,
          type: 'custom',
          data: {
            ...n.data,
            type: n.data?.type || n.type,
            label: n.data?.label || n.label,
            params: n.data?.params || {}
          }
        }));
        setNodes(formatted);
        setEdges(generated.edges || []);
        saveChanges(formatted, generated.edges || []);
        updateRawCodeString(formatted, generated.edges || [], codeFormat);
        setAiPrompt('');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'AI generation failed');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyCodeSync = () => {
    try {
      let parsed: any;
      if (codeFormat === 'yaml') {
        parsed = YAML.parse(rawCode);
      } else {
        parsed = JSON.parse(rawCode);
      }

      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        const formatted = parsed.nodes.map((n: any) => ({
          id: n.id,
          type: 'custom',
          position: n.position || { x: 100, y: 100 },
          data: {
            label: n.label || n.data?.label || n.type,
            type: n.type || n.data?.type,
            params: n.params || n.data?.params || {}
          }
        }));
        setNodes(formatted);
        setEdges(parsed.edges || []);
        saveChanges(formatted, parsed.edges || []);
        setActiveTab('canvas');
      }
    } catch (err: any) {
      alert(`Invalid ${codeFormat.toUpperCase()} syntax: ` + err.message);
    }
  };

  const filteredRegistry = useMemo(() => {
    return registry.filter((node) => {
      const matchesSearch =
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [registry, searchQuery, selectedCategory]);

  const categories = [
    { id: 'all', label: isRTL ? 'الكل' : 'All' },
    { id: 'triggers', label: isRTL ? 'المشغلات' : 'Triggers' },
    { id: 'ai', label: isRTL ? 'الذكاء الاصطناعي' : 'AI & LLMs' },
    { id: 'actions', label: isRTL ? 'الإجراءات' : 'APIs & HTTP' },
    { id: 'logic', label: isRTL ? 'المنطق والفلترة' : 'Logic & Code' },
    { id: 'communication', label: isRTL ? 'التواصل' : 'Communication' },
    { id: 'storage', label: isRTL ? 'قواعد البيانات' : 'Databases' }
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-medium text-slate-400">Loading NexFlow Workflow...</p>
        </div>
      </div>
    );
  }

  const selectedRegistryDef = registry.find((r) => r.type === selectedNode?.data?.type);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`flex flex-col h-screen w-full select-none overflow-hidden ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* TOP HEADER */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-30">
        {/* Left branding and back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Workspaces"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100 tracking-tight">NEXFLOW</span>
                <span className="text-slate-500">/</span>
                <span className="text-sm font-medium text-slate-300 truncate max-w-xs">{workflow?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>{nodes.length} nodes</span>
                <span>•</span>
                <span>{edges.length} connections</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: AI Assistant Quick Generator */}
        <form onSubmit={handleAiGenerate} className="hidden md:flex items-center max-w-lg w-full mx-4">
          <div className="relative w-full">
            <Sparkles className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={isRTL ? 'اكتب وصف السير الذكي (مثال: استقبل Webhook واستخرج البيانات بالـ AI ثم أرسل إيميل)...' : 'Describe workflow (e.g. Webhook -> AI Extract -> Save CRM -> Slack Alert)...'}
              className="w-full pl-9 pr-24 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isGeneratingAi || !aiPrompt.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[11px] font-semibold text-white transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isGeneratingAi ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isRTL ? 'توليد ذكي' : 'Generate'}
            </button>
          </div>
        </form>

        {/* Right Actions & View Modes */}
        <div className="flex items-center gap-2.5">
          {/* View Mode Tabs (Level 1, Level 3) */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setActiveTab('canvas')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'canvas' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {isRTL ? 'الرسم المرئي' : 'Canvas'}
            </button>
            <button
              onClick={() => {
                updateRawCodeString(nodes, edges, codeFormat);
                setActiveTab('code');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              {isRTL ? 'الكود' : 'Code'}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              {isRTL ? 'السجلات' : 'Logs'}
              {executionLogs.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          {/* Test Run Button */}
          <button
            onClick={handleTestRun}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRTL ? 'تشغيل واختبار' : 'Test Run'}
          </button>

          {/* RTL / Theme Toggles */}
          <button
            onClick={() => setIsRTL(!isRTL)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs font-bold"
            title="Toggle RTL Arabic / LTR English"
          >
            {isRTL ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEVEL 1: VISUAL CANVAS TAB */}
        {activeTab === 'canvas' && (
          <>
            {/* LEFT SIDEBAR: 25+ INTEGRATIONS HUB */}
            <aside className="w-72 border-r border-slate-800 bg-slate-900/95 flex flex-col z-20">
              <div className="p-3.5 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {isRTL ? 'مكتبة العقد والتكاملات' : 'Integrations & Nodes'}
                  </h3>
                  <span className="text-[10px] bg-slate-800 text-indigo-400 font-mono px-2 py-0.5 rounded-full border border-slate-700">
                    {registry.length} Available
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isRTL ? 'بحث في العقد...' : 'Search nodes...'}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === c.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Node Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredRegistry.map((reg) => (
                  <div
                    key={reg.type}
                    onClick={() => addNodeFromRegistry(reg)}
                    className="group p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-850 hover:border-indigo-500/60 transition-all cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                          {reg.category}
                        </span>
                        <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors mt-1">
                          {reg.label}
                        </h4>
                      </div>
                      <div className="p-1 rounded-md bg-slate-800 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {reg.description}
                    </p>
                  </div>
                ))}
              </div>
            </aside>

            {/* REACT FLOW CANVAS */}
            <main className="flex-1 relative bg-slate-950">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => setSelectedNode(node)}
                fitView
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
                <Controls className="!bg-slate-900 !border-slate-850 !shadow-xl !text-slate-300" />
                <MiniMap
                  className="!bg-slate-900 !border-slate-800 !rounded-xl overflow-hidden"
                  nodeColor="#6366F1"
                  maskColor="rgba(15, 23, 42, 0.7)"
                />
              </ReactFlow>

              {/* Status Pill Overlay */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur flex items-center gap-2 text-xs">
                  {isSaving ? (
                    <span className="flex items-center gap-1.5 text-amber-400 font-medium animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Auto-saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Synced & Ready
                    </span>
                  )}
                </div>
              </div>
            </main>

            {/* LEVEL 2: PROPERTIES PANEL & ISOLATED NODE RUNNER */}
            {selectedNode && (
              <aside className="w-96 border-l border-slate-800 bg-slate-900/98 backdrop-blur flex flex-col z-20 shadow-2xl">
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-semibold text-sm text-slate-100">
                      {isRTL ? 'إعدادات العقدة' : 'Node Inspector'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    &times;
                  </button>
                </div>

                {/* Properties Form */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                      {selectedRegistryDef?.category || 'Action'}
                    </div>
                    <div className="font-semibold text-sm text-slate-100">
                      {selectedNode.data.label}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {selectedNode.data.type}
                    </div>
                  </div>

                  {/* Schema fields */}
                  {selectedRegistryDef ? (
                    selectedRegistryDef.paramsSchema.map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-200">
                            {field.label}
                            {field.required && <span className="text-rose-400 ml-1">*</span>}
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">{`{{${field.name}}}`}</span>
                        </div>

                        {field.type === 'select' ? (
                          <select
                            value={selectedNode.data.params?.[field.name] || field.defaultValue || ''}
                            onChange={(e) => updateNodeParam(field.name, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                          >
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'text' || field.type === 'json' || field.type === 'code' ? (
                          <textarea
                            rows={field.type === 'code' ? 6 : 3}
                            value={selectedNode.data.params?.[field.name] ?? field.defaultValue ?? ''}
                            onChange={(e) => updateNodeParam(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={selectedNode.data.params?.[field.name] ?? field.defaultValue ?? ''}
                            onChange={(e) => updateNodeParam(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                          />
                        )}

                        {field.description && (
                          <p className="text-[11px] text-slate-400">{field.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No schema defined for this custom node.</p>
                  )}

                  {/* Level 2: Isolated Single-Node Test Trigger */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <button
                      onClick={handleSingleNodeTest}
                      disabled={isTestingNode}
                      className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      {isTestingNode ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5" />
                      )}
                      {isRTL ? 'اختبار هذه العقدة فقط' : 'Test This Step Only'}
                    </button>

                    {singleNodeTestResult && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {isRTL ? 'نتيجة الاختبار' : 'Step Test Output'}
                        </span>
                        <pre className="text-[11px] font-mono text-emerald-400 bg-slate-900 p-2 rounded-lg overflow-x-auto max-h-48">
                          {JSON.stringify(singleNodeTestResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </>
        )}

        {/* LEVEL 3: RAW CODE MONACO EDITOR TAB */}
        {activeTab === 'code' && (
          <div className="flex-1 flex flex-col bg-slate-950">
            <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300">Format:</span>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => {
                      setCodeFormat('json');
                      updateRawCodeString(nodes, edges, 'json');
                    }}
                    className={`px-3 py-1 rounded-md font-semibold ${
                      codeFormat === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      setCodeFormat('yaml');
                      updateRawCodeString(nodes, edges, 'yaml');
                    }}
                    className={`px-3 py-1 rounded-md font-semibold ${
                      codeFormat === 'yaml' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    YAML
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyCodeSync}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isRTL ? 'تطبيق المخطط على اللوحة' : 'Apply to Canvas'}
                </button>
              </div>
            </div>

            <div className="flex-1">
              <Editor
                height="100%"
                language={codeFormat === 'yaml' ? 'yaml' : 'json'}
                theme="vs-dark"
                value={rawCode}
                onChange={(val) => setRawCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on'
                }}
              />
            </div>
          </div>
        )}

        {/* LEVEL 3: LIVE EXECUTION CONSOLE TAB */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col bg-slate-950 p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  {isRTL ? 'سجلات التنفيذ في الوقت الفعلي' : 'Real-time Execution Telemetry'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Streamed via distributed WebSocket queue dispatcher.
                </p>
              </div>
              <button
                onClick={() => setExecutionLogs([])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                {isRTL ? 'مسح السجلات' : 'Clear Telemetry'}
              </button>
            </div>

            {executionLogs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Terminal className="w-8 h-8 opacity-40" />
                <p className="text-xs">No execution telemetry recorded yet. Click "Test Run" to trigger workflow.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {executionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-xs shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            log.status === 'success'
                              ? 'bg-emerald-400'
                              : log.status === 'failed'
                              ? 'bg-rose-400'
                              : 'bg-indigo-400 animate-pulse'
                          }`}
                        ></span>
                        <span className="text-slate-300 font-semibold">{log.nodeId}</span>
                        {log.nodeType && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                            {log.nodeType}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[11px]">{log.timestamp}</span>
                    </div>

                    {log.result && (
                      <pre className="text-[11px] text-emerald-400 bg-slate-950 p-2.5 rounded-lg overflow-x-auto max-h-40">
                        {JSON.stringify(log.result, null, 2)}
                      </pre>
                    )}

                    {log.error && (
                      <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg">
                        {log.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
