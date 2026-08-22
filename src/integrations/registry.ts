import { NodeDefinition } from './types';

export const NODE_REGISTRY: NodeDefinition[] = [
  // TRIGGERS
  {
    type: 'trigger.webhook',
    label: 'Webhook Trigger',
    category: 'triggers',
    icon: 'Webhook',
    description: 'Triggers workflow on incoming HTTP POST/GET webhook payload.',
    paramsSchema: [
      { name: 'path', label: 'Webhook Path', type: 'string', required: true, defaultValue: '/webhook/custom', placeholder: '/webhook/custom' },
      { name: 'method', label: 'HTTP Method', type: 'select', required: true, defaultValue: 'POST', options: [{ label: 'POST', value: 'POST' }, { label: 'GET', value: 'GET' }, { label: 'PUT', value: 'PUT' }] },
      { name: 'authHeader', label: 'Auth Token / Header (Optional)', type: 'string', placeholder: 'Bearer secret_token' }
    ]
  },
  {
    type: 'trigger.schedule',
    label: 'Schedule (Cron)',
    category: 'triggers',
    icon: 'Clock',
    description: 'Executes workflow on a recurring time schedule or cron expression.',
    paramsSchema: [
      { name: 'cron', label: 'Cron Expression', type: 'string', required: true, defaultValue: '0 * * * *', placeholder: '0 * * * * (Every hour)' },
      { name: 'timezone', label: 'Timezone', type: 'string', defaultValue: 'UTC', placeholder: 'UTC' }
    ]
  },
  {
    type: 'trigger.form',
    label: 'Form Trigger',
    category: 'triggers',
    icon: 'FileInput',
    description: 'Accepts structured form data submissions to initiate automated flows.',
    paramsSchema: [
      { name: 'formId', label: 'Form ID / Slug', type: 'string', required: true, defaultValue: 'contact-form', placeholder: 'contact-form' },
      { name: 'fields', label: 'Expected Fields (comma-separated)', type: 'string', defaultValue: 'name, email, message', placeholder: 'name, email, message' }
    ]
  },

  // AI & LLMs
  {
    type: 'action.openai',
    label: 'OpenAI GPT Prompt',
    category: 'ai',
    icon: 'Sparkles',
    description: 'Generate text, reasoning, summaries, or structured completions using OpenAI models.',
    paramsSchema: [
      { name: 'model', label: 'Model', type: 'select', required: true, defaultValue: 'gpt-3.5-turbo', options: [{ label: 'GPT-4o', value: 'gpt-4o' }, { label: 'GPT-4o-mini', value: 'gpt-4o-mini' }, { label: 'GPT-3.5-turbo', value: 'gpt-3.5-turbo' }] },
      { name: 'systemPrompt', label: 'System Instructions', type: 'text', defaultValue: 'You are an intelligent workflow automation assistant.', placeholder: 'System role instructions...' },
      { name: 'prompt', label: 'User Prompt / Input', type: 'text', required: true, placeholder: 'Analyze message: {{trigger.message}}' },
      { name: 'temperature', label: 'Temperature (0.0 - 1.0)', type: 'number', defaultValue: 0.7 }
    ]
  },
  {
    type: 'action.ollama',
    label: 'Ollama (Local LLM)',
    category: 'ai',
    icon: 'Cpu',
    description: 'Execute local private LLM prompts (Llama 3, Mistral, Gemma) via Ollama endpoint.',
    paramsSchema: [
      { name: 'endpoint', label: 'Ollama Base URL', type: 'string', required: true, defaultValue: 'http://localhost:11434', placeholder: 'http://localhost:11434' },
      { name: 'model', label: 'Model Tag', type: 'string', required: true, defaultValue: 'llama3', placeholder: 'llama3, mistral, gemma' },
      { name: 'prompt', label: 'Prompt', type: 'text', required: true, placeholder: 'Summarize text: {{node_1.text}}' }
    ]
  },
  {
    type: 'action.aiClassify',
    label: 'AI Text Classify',
    category: 'ai',
    icon: 'Tags',
    description: 'Classifies input text into one or more specified categorical tags.',
    paramsSchema: [
      { name: 'text', label: 'Input Text', type: 'text', required: true, placeholder: '{{node_1.content}}' },
      { name: 'categories', label: 'Categories (comma-separated)', type: 'string', required: true, defaultValue: 'Support, Billing, Sales, Bug, Feature Request', placeholder: 'Support, Billing, Sales' }
    ]
  },
  {
    type: 'action.aiExtract',
    label: 'AI Structured Extract',
    category: 'ai',
    icon: 'FileSpreadsheet',
    description: 'Extracts structured JSON properties (name, phone, amount, dates) from unstructured text.',
    paramsSchema: [
      { name: 'text', label: 'Input Raw Text', type: 'text', required: true, placeholder: '{{node_1.body}}' },
      { name: 'schema', label: 'JSON Extraction Schema', type: 'json', required: true, defaultValue: '{\n  "name": "string",\n  "email": "string",\n  "urgency": "high|medium|low"\n}' }
    ]
  },

  // COMMUNICATION
  {
    type: 'action.sendEmail',
    label: 'Send Email (SMTP)',
    category: 'communication',
    icon: 'Mail',
    description: 'Dispatches HTML or plain text email via configured SMTP relay.',
    paramsSchema: [
      { name: 'to', label: 'Recipient Email', type: 'string', required: true, placeholder: 'lead@example.com' },
      { name: 'subject', label: 'Subject Line', type: 'string', required: true, defaultValue: 'Automated Update from NexFlow', placeholder: 'Update Notification' },
      { name: 'text', label: 'Message Body (Plain Text or Template)', type: 'text', required: true, placeholder: 'Hello {{node_1.name}}, your request has been processed.' }
    ]
  },
  {
    type: 'action.slack',
    label: 'Slack Notification',
    category: 'communication',
    icon: 'MessageSquare',
    description: 'Posts rich text messages or alerts to Slack channels via incoming Webhook or Bot Token.',
    paramsSchema: [
      { name: 'webhookUrl', label: 'Slack Webhook URL', type: 'string', required: true, placeholder: 'https://hooks.slack.com/services/...' },
      { name: 'text', label: 'Message Content', type: 'text', required: true, placeholder: '🚨 *New Lead Alert*: {{node_1.email}}' },
      { name: 'channel', label: 'Override Channel (Optional)', type: 'string', placeholder: '#general' }
    ]
  },
  {
    type: 'action.discord',
    label: 'Discord Webhook',
    category: 'communication',
    icon: 'MessageCircle',
    description: 'Sends automated embeds and channel messages to Discord servers.',
    paramsSchema: [
      { name: 'webhookUrl', label: 'Discord Webhook URL', type: 'string', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
      { name: 'content', label: 'Message Text', type: 'text', required: true, placeholder: '🔔 **Workflow Notification**: {{node_1.status}}' },
      { name: 'username', label: 'Bot Username (Optional)', type: 'string', defaultValue: 'NexFlow Bot' }
    ]
  },
  {
    type: 'action.telegram',
    label: 'Telegram Bot',
    category: 'communication',
    icon: 'Send',
    description: 'Sends direct messages or channel broadcasts through a Telegram Bot.',
    paramsSchema: [
      { name: 'botToken', label: 'Bot Token', type: 'string', required: true, placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' },
      { name: 'chatId', label: 'Chat ID / Group ID', type: 'string', required: true, placeholder: '987654321 or @my_channel' },
      { name: 'text', label: 'Message Text', type: 'text', required: true, placeholder: '⚡ Alert: {{node_1.alertMessage}}' }
    ]
  },
  {
    type: 'action.chatwootReply',
    label: 'Chatwoot Live Chat Reply',
    category: 'communication',
    icon: 'Headphones',
    description: 'Dispatches automated conversational replies to customer conversations in Chatwoot.',
    paramsSchema: [
      { name: 'accountId', label: 'Account ID', type: 'number', required: true, defaultValue: 1 },
      { name: 'conversationId', label: 'Conversation ID', type: 'number', required: true, placeholder: '{{trigger.conversationId}}' },
      { name: 'content', label: 'Reply Message', type: 'text', required: true, placeholder: 'Thank you for reaching out! Our team has received your ticket.' }
    ]
  },

  // DATA & LOGIC
  {
    type: 'action.httpRequest',
    label: 'HTTP / API Request',
    category: 'actions',
    icon: 'Globe',
    description: 'Perform generic RESTful HTTP requests with headers, query parameters, and JSON payloads.',
    paramsSchema: [
      { name: 'url', label: 'Endpoint URL', type: 'string', required: true, placeholder: 'https://api.example.com/data' },
      { name: 'method', label: 'Method', type: 'select', required: true, defaultValue: 'GET', options: [{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' }, { label: 'PATCH', value: 'PATCH' }] },
      { name: 'headers', label: 'Headers (JSON string)', type: 'json', defaultValue: '{\n  "Content-Type": "application/json"\n}' },
      { name: 'body', label: 'Request Body (JSON string or template)', type: 'json', placeholder: '{\n  "key": "value"\n}' }
    ]
  },
  {
    type: 'action.filter',
    label: 'Condition / Filter',
    category: 'logic',
    icon: 'Filter',
    description: 'Evaluate conditions (equals, contains, greater than, regex) to control execution branch.',
    paramsSchema: [
      { name: 'field', label: 'Field to evaluate', type: 'string', required: true, placeholder: '{{node_1.status}}' },
      { name: 'operator', label: 'Operator', type: 'select', required: true, defaultValue: 'equals', options: [
        { label: 'Equals (==)', value: 'equals' },
        { label: 'Not Equals (!=)', value: 'not_equals' },
        { label: 'Contains', value: 'contains' },
        { label: 'Does Not Contain', value: 'not_contains' },
        { label: 'Greater Than (>)', value: 'gt' },
        { label: 'Less Than (<)', value: 'lt' },
        { label: 'Is Empty / Null', value: 'is_empty' }
      ]},
      { name: 'value', label: 'Target Value', type: 'string', placeholder: 'success' }
    ]
  },
  {
    type: 'action.code',
    label: 'Custom Code (JS / Node)',
    category: 'logic',
    icon: 'Code2',
    description: 'Execute custom JavaScript data transformation logic with input payload.',
    paramsSchema: [
      { name: 'code', label: 'JavaScript Code', type: 'code', required: true, defaultValue: '// Return transformed output object\nconst data = input.data || {};\nreturn {\n  transformed: true,\n  timestamp: Date.now(),\n  summary: `Processed ${Object.keys(data).length} keys`\n};' }
    ]
  },
  {
    type: 'action.jsonTransform',
    label: 'JSON Transform',
    category: 'logic',
    icon: 'Binary',
    description: 'Restructure, extract JSON paths, or project JSON payloads into target schema.',
    paramsSchema: [
      { name: 'inputJson', label: 'Input JSON / Context Key', type: 'text', required: true, placeholder: '{{node_1.data}}' },
      { name: 'path', label: 'JSON Path / Property', type: 'string', defaultValue: 'items[0]', placeholder: 'items[0].id' }
    ]
  },
  {
    type: 'action.csvParser',
    label: 'CSV / Data Parser',
    category: 'logic',
    icon: 'Table',
    description: 'Convert CSV table text into JSON objects or JSON array into CSV format.',
    paramsSchema: [
      { name: 'mode', label: 'Mode', type: 'select', required: true, defaultValue: 'csv_to_json', options: [{ label: 'CSV to JSON Array', value: 'csv_to_json' }, { label: 'JSON Array to CSV', value: 'json_to_csv' }] },
      { name: 'content', label: 'Input String / Object', type: 'text', required: true, placeholder: 'name,email,role\nAlice,alice@work.com,Admin' }
    ]
  },
  {
    type: 'action.rss',
    label: 'RSS Feed Reader',
    category: 'actions',
    icon: 'Rss',
    description: 'Polls RSS/Atom XML feeds and converts the latest articles to JSON records.',
    paramsSchema: [
      { name: 'url', label: 'Feed URL', type: 'string', required: true, placeholder: 'https://news.ycombinator.com/rss' },
      { name: 'limit', label: 'Max Articles', type: 'number', defaultValue: 5 }
    ]
  },
  {
    type: 'action.delay',
    label: 'Delay / Timer',
    category: 'logic',
    icon: 'Timer',
    description: 'Pauses workflow execution for a specified duration in milliseconds before proceeding.',
    paramsSchema: [
      { name: 'ms', label: 'Delay Duration (ms)', type: 'number', required: true, defaultValue: 2000, placeholder: '2000' }
    ]
  },
  {
    type: 'action.errorHandler',
    label: 'Error Handler / Fallback',
    category: 'logic',
    icon: 'ShieldAlert',
    description: 'Catches upstream errors and provides fallback output data to prevent workflow failure.',
    paramsSchema: [
      { name: 'fallbackData', label: 'Fallback JSON Response', type: 'json', defaultValue: '{\n  "recovered": true,\n  "status": "warning"\n}' }
    ]
  },
  {
    type: 'action.subWorkflow',
    label: 'Call Sub-Workflow',
    category: 'logic',
    icon: 'Workflow',
    description: 'Executes another workflow by ID and awaits its completion data.',
    paramsSchema: [
      { name: 'subWorkflowId', label: 'Sub-Workflow ID', type: 'string', required: true, placeholder: 'workflow-uuid-here' },
      { name: 'payload', label: 'Input Payload JSON', type: 'json', defaultValue: '{\n  "param": "value"\n}' }
    ]
  },

  // DATABASE & STORAGE
  {
    type: 'action.postgres',
    label: 'PostgreSQL Query',
    category: 'storage',
    icon: 'Database',
    description: 'Execute parameterized queries against a relational PostgreSQL database.',
    paramsSchema: [
      { name: 'query', label: 'SQL Query', type: 'text', required: true, defaultValue: 'SELECT * FROM users WHERE status = $1 LIMIT 10;', placeholder: 'SELECT * FROM users' },
      { name: 'params', label: 'Query Parameters (JSON array)', type: 'json', defaultValue: '["active"]' }
    ]
  },
  {
    type: 'action.redis',
    label: 'Redis Cache & PubSub',
    category: 'storage',
    icon: 'HardDrive',
    description: 'Interact with Redis: GET, SET with TTL, DEL, or PUBLISH events to channels.',
    paramsSchema: [
      { name: 'command', label: 'Command', type: 'select', required: true, defaultValue: 'GET', options: [{ label: 'GET', value: 'GET' }, { label: 'SET', value: 'SET' }, { label: 'DEL', value: 'DEL' }, { label: 'PUBLISH', value: 'PUBLISH' }] },
      { name: 'key', label: 'Key / Channel', type: 'string', required: true, placeholder: 'session:user_123' },
      { name: 'value', label: 'Value / Payload (for SET/PUBLISH)', type: 'string', placeholder: 'cached_value' },
      { name: 'ttl', label: 'TTL Seconds (for SET)', type: 'number', defaultValue: 3600 }
    ]
  },
  {
    type: 'action.awsS3',
    label: 'AWS S3 File Storage',
    category: 'storage',
    icon: 'Cloud',
    description: 'Upload files, JSON documents, or read objects from Amazon S3 buckets.',
    paramsSchema: [
      { name: 'bucket', label: 'S3 Bucket Name', type: 'string', required: true, placeholder: 'my-company-workflows' },
      { name: 'key', label: 'Object Key / Path', type: 'string', required: true, placeholder: 'reports/daily_2026.json' },
      { name: 'operation', label: 'Operation', type: 'select', required: true, defaultValue: 'putObject', options: [{ label: 'Put Object (Save)', value: 'putObject' }, { label: 'Get Object (Read)', value: 'getObject' }] },
      { name: 'content', label: 'Payload Content (for Put)', type: 'text', placeholder: '{{node_1.data}}' }
    ]
  },
  {
    type: 'action.googleSheets',
    label: 'Google Sheets',
    category: 'storage',
    icon: 'Sheet',
    description: 'Append rows or query spreadsheet values in Google Sheets.',
    paramsSchema: [
      { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'string', required: true, placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' },
      { name: 'sheetName', label: 'Sheet / Tab Name', type: 'string', defaultValue: 'Sheet1' },
      { name: 'action', label: 'Action', type: 'select', required: true, defaultValue: 'appendRow', options: [{ label: 'Append Row', value: 'appendRow' }, { label: 'Read Rows', value: 'readRows' }] },
      { name: 'rowValues', label: 'Row Values (JSON Array or Comma-separated)', type: 'text', placeholder: '["John Doe", "john@example.com", "Active"]' }
    ]
  },
  {
    type: 'action.github',
    label: 'GitHub Integration',
    category: 'actions',
    icon: 'GitBranch',
    description: 'Create issues, fetch pull requests, or trigger repository dispatches in GitHub.',
    paramsSchema: [
      { name: 'repository', label: 'Repository (owner/repo)', type: 'string', required: true, placeholder: 'nexflow/automation' },
      { name: 'action', label: 'Action', type: 'select', required: true, defaultValue: 'createIssue', options: [{ label: 'Create Issue', value: 'createIssue' }, { label: 'Get Repository Info', value: 'getRepo' }, { label: 'Trigger Workflow Dispatch', value: 'dispatch' }] },
      { name: 'title', label: 'Issue Title / Event Type', type: 'string', placeholder: 'Automated Issue from NexFlow' },
      { name: 'body', label: 'Description Body', type: 'text', placeholder: 'Created automatically by workflow: {{node_1.id}}' }
    ]
  },
  {
    type: 'action.dbQuery',
    label: 'Internal CRM Query',
    category: 'storage',
    icon: 'Users',
    description: 'Lookup or create customer records in the internal platform CRM database.',
    paramsSchema: [
      { name: 'operation', label: 'Operation', type: 'select', required: true, defaultValue: 'findCustomer', options: [{ label: 'Find Customer by Email', value: 'findCustomer' }, { label: 'Create Customer', value: 'createCustomer' }] },
      { name: 'email', label: 'Customer Email', type: 'string', required: true, placeholder: 'customer@example.com' },
      { name: 'name', label: 'Customer Name (for create)', type: 'string', placeholder: 'Jane Doe' }
    ]
  }
];
