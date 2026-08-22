import OpenAI from 'openai';
import { NODE_REGISTRY } from './integrations/registry';

export async function generateWorkflowFromPrompt(prompt: string): Promise<{
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const availableNodeTypes = NODE_REGISTRY.map(n => ({ type: n.type, label: n.label, category: n.category }));

      const systemPrompt = `You are a world-class Workflow Automation Architect for NexFlow.
Given a user prompt, create a valid React Flow DAG of nodes and edges.
Available node types: ${JSON.stringify(availableNodeTypes)}

Output strictly valid JSON with this format:
{
  "name": "Brief Title",
  "description": "Short description",
  "nodes": [
    {
      "id": "1",
      "type": "<node_type>",
      "position": { "x": 100, "y": 150 },
      "data": {
        "label": "<Node Label>",
        "type": "<node_type>",
        "params": { ... }
      }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2" }
  ]
}
Spacing: position x should increase by 280-320 for sequential nodes.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      if (parsed.nodes && parsed.edges) {
        return parsed;
      }
    } catch (e) {
      console.warn('OpenAI generation failed, falling back to rule-based template generation:', e);
    }
  }

  // Rule-based high quality workflow generation fallback
  const lower = prompt.toLowerCase();

  if (lower.includes('lead') || lower.includes('email') || lower.includes('crm')) {
    return {
      name: 'Lead Capture & AI Outreach Flow',
      description: 'Webhook triggers AI qualification, saves to CRM, and dispatches customized email confirmation.',
      nodes: [
        {
          id: '1',
          type: 'trigger.webhook',
          position: { x: 50, y: 150 },
          data: { label: 'Inbound Webhook', type: 'trigger.webhook', params: { path: '/webhook/leads', method: 'POST' } }
        },
        {
          id: '2',
          type: 'action.aiExtract',
          position: { x: 340, y: 150 },
          data: { label: 'AI Lead Data Extraction', type: 'action.aiExtract', params: { text: '{{1.payload}}' } }
        },
        {
          id: '3',
          type: 'action.dbQuery',
          position: { x: 630, y: 150 },
          data: { label: 'Save Customer to CRM', type: 'action.dbQuery', params: { operation: 'createCustomer', email: '{{2.extracted.email}}', name: '{{2.extracted.name}}' } }
        },
        {
          id: '4',
          type: 'action.sendEmail',
          position: { x: 920, y: 150 },
          data: { label: 'Send Welcome Email', type: 'action.sendEmail', params: { to: '{{2.extracted.email}}', subject: 'Welcome to NexFlow!', text: 'Hello {{2.extracted.name}}, we received your inquiry and are excited to assist you.' } }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' }
      ]
    };
  }

  if (lower.includes('slack') || lower.includes('alert') || lower.includes('discord') || lower.includes('monitor')) {
    return {
      name: 'Automated Incident & Alert Dispatcher',
      description: 'Recurring schedule checks system health, evaluates criteria, and broadcasts to Slack and Discord.',
      nodes: [
        {
          id: '1',
          type: 'trigger.schedule',
          position: { x: 50, y: 150 },
          data: { label: '5-Min Health Cron', type: 'trigger.schedule', params: { cron: '*/5 * * * *' } }
        },
        {
          id: '2',
          type: 'action.httpRequest',
          position: { x: 340, y: 150 },
          data: { label: 'Check API Endpoint', type: 'action.httpRequest', params: { url: 'https://api.github.com', method: 'GET' } }
        },
        {
          id: '3',
          type: 'action.slack',
          position: { x: 630, y: 100 },
          data: { label: 'Slack Alert', type: 'action.slack', params: { webhookUrl: 'https://hooks.slack.com/services/...', text: 'Health Check Status: {{2.status}}' } }
        },
        {
          id: '4',
          type: 'action.discord',
          position: { x: 630, y: 240 },
          data: { label: 'Discord Notification', type: 'action.discord', params: { webhookUrl: 'https://discord.com/api/webhooks/...', content: 'Status Verified: {{2.statusText}}' } }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e2-4', source: '2', target: '4' }
      ]
    };
  }

  // Default smart AI pipeline
  return {
    name: 'Intelligent AI Data Processing Pipeline',
    description: 'Receives event payload, applies AI classification, executes custom logic code, and syncs to storage.',
    nodes: [
      {
        id: '1',
        type: 'trigger.webhook',
        position: { x: 50, y: 150 },
        data: { label: 'Webhook Inbound', type: 'trigger.webhook', params: { path: '/webhook/events', method: 'POST' } }
      },
      {
        id: '2',
        type: 'action.aiClassify',
        position: { x: 340, y: 150 },
        data: { label: 'AI Sentiment & Category', type: 'action.aiClassify', params: { text: '{{1.payload}}', categories: 'High Priority, Support, Sales, Inquiry' } }
      },
      {
        id: '3',
        type: 'action.code',
        position: { x: 630, y: 150 },
        data: { label: 'Custom Transformation', type: 'action.code', params: { code: 'const category = input.classifiedCategory || "General";\nreturn {\n  routedCategory: category,\n  processedAt: new Date().toISOString(),\n  isPriority: category.includes("Priority")\n};' } }
      },
      {
        id: '4',
        type: 'action.postgres',
        position: { x: 920, y: 150 },
        data: { label: 'Persist to PostgreSQL', type: 'action.postgres', params: { query: 'INSERT INTO audit_events (category, timestamp) VALUES ($1, $2);', params: '["{{3.routedCategory}}", "{{3.processedAt}}"]' } }
      }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' }
    ]
  };
}
