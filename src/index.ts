import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import axios from 'axios';
import dns from 'dns';
import util from 'util';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { workflowQueue } from './queue';
import { NODE_REGISTRY } from './integrations/registry';
import { executeNode, checkSSRF, interpolateParams } from './integrations/executor';
import { generateWorkflowFromPrompt } from './ai-generator';

dotenv.config();
const role = process.env.ROLE || 'all';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { CredentialsService } from './credentials.service';
import { BillingService, initBillingCron } from './billing';
import Stripe from 'stripe';
import { ChatwootClient } from './chatwoot';

const prisma = new PrismaClient();
const credsService = new CredentialsService();
initBillingCron();

const resolveDns = util.promisify(dns.resolve);

const queue = workflowQueue;


async function checkSSRF(urlStr: string) {
  const parsed = new URL(urlStr);
  const hostname = parsed.hostname;
  
  // Basic checks
  if (hostname === 'localhost') throw new Error('SSRF Blocked: localhost');

  try {
    const addresses = await resolveDns(hostname);
    for (const ip of addresses) {
      if (
        ip.startsWith('127.') ||
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('169.254.')
      ) {
        throw new Error(`SSRF Blocked: Resolves to private IP ${ip}`);
      }
    }
  } catch(e: any) {
    if (e.message.includes('SSRF Blocked')) throw e;
    // if DNS resolution fails, let axios handle it
  }
}

async function handleSendEmail(params: any) {
  let pass = process.env.SMTP_PASS || '';
  if (params.credentialId) {
    const cred = await prisma.credential.findUnique({ where: { id: params.credentialId } });
    if (cred) {
      pass = credsService.decrypt(cred.encrypted, cred.iv, cred.authTag);
    }
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '127.0.0.1',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false,
    auth: pass ? {
      user: process.env.SMTP_USER || 'test',
      pass
    } : undefined
  });

  const info = await transporter.sendMail({
    from: '"Workflow Engine" <system@example.com>',
    to: params.to,
    subject: params.subject,
    text: params.text,
  });

  return { messageId: info.messageId };
}

async function handleHttpRequest(params: any) {
  await checkSSRF(params.url);
  if (params.url.includes('169.254.169.254')) {
    throw new Error('SSRF blocked: Access to internal metadata endpoints is not allowed.');
  }
  const response = await axios({
    method: params.method || 'GET',
    url: params.url,
    data: params.body,
  });
  return { status: response.status, data: response.data };
}

async function handleDbQuery(params: any) {
  // parameterize via Prisma
  // We can't do arbitrary raw queries easily if we want 0 injection and full parametrization,
  // but we can support findMany on a specific table for instance.
  // We will allow finding customers by email.
  if (params.operation === 'findCustomer') {
    const customers = await prisma.customer.findMany({
      where: {
        email: params.email
      }
    });
    return { customers };
  } else if (params.operation === 'createCustomer') {
    const customer = await prisma.customer.create({
      data: {
        name: params.name,
        email: params.email
      }
    });
    return { customer };
  }
  throw new Error('Unsupported DB Operation');
}

async function handleAiAgent(params: any) {
  let apiKey = process.env.OPENAI_API_KEY;
  if (params.credentialId) {
    const cred = await prisma.credential.findUnique({ where: { id: params.credentialId } });
    if (cred) {
      apiKey = credsService.decrypt(cred.encrypted, cred.iv, cred.authTag);
    }
  }

  if (!apiKey) {
    throw new Error("No OPENAI_API_KEY found in environment or credentials");
  }
  
  const openai = new OpenAI({ apiKey });
  const messages = params.messages || [{ role: 'user', content: 'Say hello' }];
  
  const completion = await openai.chat.completions.create({
    messages,
    model: 'gpt-3.5-turbo',
  });
  
  return { message: completion.choices[0].message.content };
}


async function handleChatwootReply(params: any) {
  const client = new ChatwootClient();
  const res = await client.sendReply(
    params.accountId,
    params.conversationId,
    params.content
  );
  return res.data;
}

let worker: any = null;
if (role === 'worker' || role === 'all') {
  workflowQueue.initWorker(async (job: any) => {
    const { node, context, workflow, workflowId } = job.data;
    console.log(`[Worker] Executing node type: ${node?.type} (ID: ${node?.id})`);
    
    try {
      io.emit('execution.step.started', { workflowId, nodeId: node?.id, startedAt: new Date().toISOString() });

      const result = await executeNode(node, context || {}, prisma);
      
      // Save state
      if (context) {
        context[node.id] = result;
      }
      
      io.emit('execution.step.completed', {
        workflowId,
        nodeId: node.id,
        nodeType: node.type,
        result,
        status: 'success',
        finishedAt: new Date().toISOString()
      });

      // Find next node(s) - support parallel targets
      const nextTargets: string[] = [];
      if (Array.isArray(node.next)) {
        nextTargets.push(...node.next);
      } else if (node.next) {
        nextTargets.push(node.next);
      }

      // If condition filter node didn't pass, skip branching if configured
      if (node.type === 'action.filter' && result.passed === false) {
        console.log(`[Worker] Filter node ${node.id} condition failed (passed=false). Branch terminated.`);
      } else if (nextTargets.length > 0) {
        for (const nextNodeId of nextTargets) {
          const nextNode = workflow?.nodes?.find((n: any) => n.id === nextNodeId);
          if (nextNode) {
            let delayMs = 0;
            if (node.type === 'action.delay') {
              delayMs = parseInt(node.params?.ms) || 0;
            }
            await queue.add('execute-node', {
              workflow,
              workflowId,
              node: nextNode,
              context
            }, { delay: delayMs });
          }
        }
      } else {
        console.log(`[Worker] Workflow ${workflowId} execution path finished. Final Context keys:`, Object.keys(context));
        io.emit('execution.workflow.completed', { workflowId, context, status: 'success' });
      }
      
      return result;
    } catch (error: any) {
      console.error(`[Worker] Error in node ${node?.id}:`, error.message);

      if (workflowId) {
        io.emit('execution.step.completed', {
          workflowId,
          nodeId: node?.id,
          nodeType: node?.type,
          error: error.message,
          status: 'failed',
          finishedAt: new Date().toISOString()
        });
      }

      throw error;
    }
  });
}



// API Server to trigger workflows
const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.APP_URL || 'http://localhost:3000';
const io = new SocketIOServer(server, { cors: { origin: allowedOrigin } });
app.use(helmet({ contentSecurityPolicy: false })); // allow frontend execution
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Audit Log helper
async function logAudit(userId: string, action: string, req: any, details?: string) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress: String(ipAddress)
      }
    });
  } catch (e) {
    console.error('Audit log failed', e);
  }
}
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';

// CORS for development (if needed)
app.use(cors());

// Serve static files from apps/web/dist
app.use(express.static(path.join(__dirname, '../apps/web/dist')));

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = (decoded as any).userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.all(['/api/auth/demo', '/api/auth/skip'], async (req, res) => {
  try {
    const demoEmail = 'demo@example.com';
    let user = await prisma.user.findUnique({ where: { email: demoEmail } });

    if (!user) {
      const passwordHash = await bcrypt.hash('demo123456', 10);
      user = await prisma.user.create({
        data: {
          email: demoEmail,
          passwordHash,
        }
      });

      // Create a default starter workflow for demo user if none exists
      await prisma.workflow.create({
        data: {
          name: 'Lead Qualification & Email Bot',
          userId: user.id,
          nodes: JSON.stringify([
            {
              id: '1',
              type: 'action.httpRequest',
              position: { x: 100, y: 150 },
              data: { label: 'Webhook Inbound', type: 'action.httpRequest', params: { url: 'https://api.example.com/webhook', method: 'POST' } }
            },
            {
              id: '2',
              type: 'action.aiAgent',
              position: { x: 400, y: 150 },
              data: { label: 'AI Sentiment & Reply', type: 'action.aiAgent', params: { prompt: 'Analyze incoming lead and draft answer' } }
            },
            {
              id: '3',
              type: 'action.sendEmail',
              position: { x: 700, y: 150 },
              data: { label: 'Send Confirmation Email', type: 'action.sendEmail', params: { to: 'lead@example.com', subject: 'Thank you for reaching out' } }
            }
          ]),
          edges: JSON.stringify([
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' }
          ])
        }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/stats', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.userId;
    
    // Check if user has any workflows
    const workflowsCount = await prisma.workflow.count({ where: { userId } });
    
    if (workflowsCount === 0) {
      return res.json({
        empty: true,
        stats: { executionsToday: 0, activeConversations: 0, totalWorkflows: 0 }
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const executionsToday = await prisma.workflowExecution.count({
      where: {
        workflow: { userId },
        createdAt: { gte: startOfDay }
      }
    });

    const activeConversations = await prisma.conversation.count();
    const totalCustomers = await prisma.customer.count();

    res.json({
      empty: false,
      stats: {
        executionsToday,
        activeConversations,
        totalCustomers,
        totalWorkflows: workflowsCount
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback to index.html for SPA routing

app.get('/api/nodes/registry', (req, res) => {
  res.json(NODE_REGISTRY);
});

app.post('/api/workflows/generate-ai', authMiddleware, async (req: any, res: any) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    
    const generated = await generateWorkflowFromPrompt(prompt);
    
    // Create new workflow in database
    const workflow = await prisma.workflow.create({
      data: {
        name: generated.name || 'AI Generated Automation',
        userId: req.userId,
        nodes: JSON.stringify(generated.nodes || []),
        edges: JSON.stringify(generated.edges || [])
      }
    });

    await logAudit(req.userId, 'GENERATE_AI_WORKFLOW', req, `Prompt: ${prompt.slice(0, 80)}`);
    res.json({ workflow, generated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'AI Generation failed' });
  }
});

app.get('/api/workflows', authMiddleware, async (req: any, res: any) => {
  const workflows = await prisma.workflow.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(workflows);
});

app.post('/api/workflows', authMiddleware, async (req: any, res: any) => {
  const { name, nodes, edges } = req.body;
  await logAudit(req.userId, 'CREATE_WORKFLOW', req, `Name: ${name}`);
  const workflow = await prisma.workflow.create({
    data: {
      name: name || 'New Workflow',
      userId: req.userId,
      nodes: typeof nodes === 'string' ? nodes : JSON.stringify(nodes || []),
      edges: typeof edges === 'string' ? edges : JSON.stringify(edges || [])
    }
  });
  res.json(workflow);
});

app.get('/api/workflows/:id', authMiddleware, async (req: any, res: any) => {
  const workflow = await prisma.workflow.findUnique({ where: { id: req.params.id, userId: req.userId } });
  if (!workflow) return res.status(404).json({ error: 'Not found' });
  res.json(workflow);
});

app.put('/api/workflows/:id', authMiddleware, async (req: any, res: any) => {
  const { nodes, edges, name } = req.body;
  await logAudit(req.userId, 'UPDATE_WORKFLOW', req, `Workflow ID: ${req.params.id}`);
  const updateData: any = {};
  if (nodes !== undefined) updateData.nodes = typeof nodes === 'string' ? nodes : JSON.stringify(nodes);
  if (edges !== undefined) updateData.edges = typeof edges === 'string' ? edges : JSON.stringify(edges);
  if (name !== undefined) updateData.name = name;

  await prisma.workflow.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: updateData
  });
  res.json({ success: true });
});

app.post('/api/workflows/:id/test-run', authMiddleware, async (req: any, res: any) => {
  const sub = await BillingService.getSubscription(req.userId);
  if (!sub.workflowsEnabled) {
    return res.status(403).json({ error: 'Workflows disabled. Please upgrade your plan.' });
  }

  const workflow = await prisma.workflow.findUnique({ where: { id: req.params.id, userId: req.userId } });
  if (!workflow) return res.status(404).json({ error: 'Not found' });
  
  const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes;
  const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges;
  
  if (!nodes || nodes.length === 0) return res.status(400).json({ error: 'Empty workflow' });

  // Build DAG representation with multi-target next support
  const engineNodes = nodes.map((n: any) => {
    const outgoingEdges = edges.filter((e: any) => e.source === n.id);
    const targetIds = outgoingEdges.map((e: any) => e.target);
    return {
      id: n.id,
      type: n.data?.type || n.type,
      params: n.data?.params || n.params || {},
      next: targetIds.length === 1 ? targetIds[0] : (targetIds.length > 1 ? targetIds : null)
    };
  });

  // Find root / entry nodes (nodes with 0 incoming edges)
  const targetNodeIds = new Set(edges.map((e: any) => e.target));
  let rootNodes = engineNodes.filter((n: any) => !targetNodeIds.has(n.id));
  if (rootNodes.length === 0) rootNodes = [engineNodes[0]];

  // Schedule root nodes
  const initialPayload = req.body?.payload || {};
  for (const rootNode of rootNodes) {
    await queue.add('execute-node', {
      workflow: { id: workflow.id, nodes: engineNodes },
      workflowId: workflow.id,
      node: rootNode,
      userId: req.userId,
      context: { initialPayload }
    });
  }

  res.json({ success: true, rootCount: rootNodes.length });
});

app.post('/api/workflows/:id/test-node', authMiddleware, async (req: any, res: any) => {
  try {
    const { node, context } = req.body;
    if (!node || !node.type) return res.status(400).json({ error: 'Invalid node definition' });

    const result = await executeNode(node, context || {}, prisma);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



app.get('/api/customers', authMiddleware, async (req: any, res: any) => {
  const { search } = req.query;
  const customers = await prisma.customer.findMany({
    where: search ? {
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      ]
    } : undefined,
    orderBy: { createdAt: 'desc' }
  });
  res.json(customers);
});

app.get('/api/conversations', authMiddleware, async (req: any, res: any) => {
  const convs = await prisma.conversation.findMany({
    include: {
      customer: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(convs);
});

app.get('/api/conversations/:id/messages', authMiddleware, async (req: any, res: any) => {
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' }
  });
  res.json(messages);
});

import { ChatwootClient } from './chatwoot';
app.post('/api/conversations/:id/reply', authMiddleware, async (req: any, res: any) => {
  const { content } = req.body;
  const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // Save to DB
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      content,
      isIncoming: false
    }
  });

  // Emit to socket
  io.emit('new_message', { conversationId: conv.id, message: msg });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { updatedAt: new Date() }
  });

  // Send via Chatwoot
  if (conv.chatwootAccountId && conv.chatwootConversationId) {
    const client = new ChatwootClient();
    try {
      await client.sendReply(conv.chatwootAccountId, conv.chatwootConversationId, content);
    } catch(e) {
      console.error('Failed to send reply to Chatwoot', e);
    }
  }

  res.json(msg);
});

app.post('/webhooks/chatwoot', async (req, res) => {
  console.log('Received Chatwoot Webhook:', req.body);
  const payload = req.body;
  
  if (payload.event === 'message_created' && payload.message_type === 'incoming') {
    const accountId = payload.account.id;
    const conversationId = payload.conversation.id;
    const content = payload.content;
    
    // Upsert Customer
    const sender = payload.sender || {};
    const identifier = sender.phone_number || sender.email || sender.id?.toString();
    const name = sender.name || identifier || 'Unknown';
    let customer = null;
    if (identifier) {
      customer = await prisma.customer.upsert({
        where: { identifier },
        update: { name, phone: sender.phone_number, email: sender.email },
        create: { identifier, name, phone: sender.phone_number, email: sender.email }
      });









    } else {
      customer = await prisma.customer.create({
        data: { name }
      });
    }

    // Upsert Conversation
    const conversation = await prisma.conversation.upsert({
      where: { chatwootConversationId: conversationId },
      update: { customerId: customer.id, chatwootAccountId: accountId },
      create: { chatwootConversationId: conversationId, chatwootAccountId: accountId, customerId: customer.id }
    });

    // Create Message
    const msg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: content,
        isIncoming: true
      }
    });

    // Emit socket event
    io.emit('new_message', { conversationId: conversation.id, message: msg });

    // Continue with workflow...
    // To make it simple, we don't trigger workflow here for test, or we can just trigger it if a specific workflow is linked.
    // For now we just store it. We'll skip the workflow execution or just run the generic one.
  }
  
  res.json({ success: true });
});


app.post('/api/credentials', async (req, res) => {
  try {
    const { name, secret } = req.body;
    const { encrypted, iv, authTag } = credsService.encrypt(secret);
    const cred = await prisma.credential.create({
      data: { name, encrypted, iv, authTag }
    });
    // Never return the raw or decrypted secret
    res.json({ id: cred.id, name: cred.name, maskedSecret: credsService.mask(secret) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credentials', async (req, res) => {
  const creds = await prisma.credential.findMany();
  const maskedCreds = creds.map(c => {
    const decrypted = credsService.decrypt(c.encrypted, c.iv, c.authTag);
    return { id: c.id, name: c.name, maskedSecret: credsService.mask(decrypted) };
  });
  res.json(maskedCreds);
});

app.post('/api/workflows/trigger', async (req, res) => {
  const workflow = req.body;
  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
    return res.status(400).json({ error: 'Invalid workflow' });
  }
  
  const firstNode = workflow.nodes[0];
  const job = await queue.add('execute-node', {
    workflow,
    node: firstNode,
    context: {}
  });
  
  res.json({ success: true, jobId: job.id });
});

const PORT = 3000;

if (role === 'api' || role === 'all') {
  server.listen(PORT, () => {
    console.log(`Workflow engine API listening on port ${PORT}`);
  });
}

if (role === 'worker') {
  console.log('Running in WORKER mode ONLY. API Server not started.');
}


export { queue, worker, checkSSRF, handleDbQuery, prisma };



// Billing Endpoints
app.get('/api/billing/usage', authMiddleware, async (req: any, res: any) => {
  const usage = await BillingService.getUsage(req.userId);
  res.json(usage);
});

app.post('/api/billing/create-checkout-session', authMiddleware, async (req: any, res: any) => {
  const { plan } = req.body;
  try {
    const url = await BillingService.createCheckoutSession(req.userId, plan);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  // Stripe initialized lazily if needed in routes
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET || '');
    await BillingService.handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err: any) {
    // If testing without a signature, we can just process it raw
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('Skipping signature verification for local test');
      const event = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
      await BillingService.handleStripeWebhook(event);
      res.json({ received: true });
    } else {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, '../apps/web/dist/index.html'));
});