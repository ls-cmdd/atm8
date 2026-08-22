import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import cron from 'node-cron';

const prisma = new PrismaClient();
// Stripe is lazily initialized
let stripeInstance: Stripe | null = null;
function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is required');
    stripeInstance = new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return stripeInstance;
}

export const PLAN_LIMITS = {
  free: 500,
  basic: 5000,
  pro: -1 // unlimited
};

export class BillingService {
  /** Ensure a user has a subscription record */
  static async getSubscription(userId: string) {
    let sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      sub = await prisma.subscription.create({
        data: { userId, plan: 'free', status: 'active', workflowsEnabled: true }
      });
    }
    return sub;
  }

  /** Track workflow execution usage */
  static async incrementUsage(userId: string) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const usage = await prisma.usageMetric.upsert({
      where: { userId_month: { userId, month } },
      update: { executions: { increment: 1 } },
      create: { userId, month, executions: 1 }
    });

    // We can soft-check limits here, but the cron job handles the actual blocking
    return usage;
  }

  static async getUsage(userId: string) {
    const month = new Date().toISOString().slice(0, 7);
    const sub = await this.getSubscription(userId);
    const usage = await prisma.usageMetric.findUnique({
      where: { userId_month: { userId, month } }
    });
    
    return {
      plan: sub.plan,
      status: sub.status,
      executions: usage?.executions || 0,
      limit: PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS] || 500,
      workflowsEnabled: sub.workflowsEnabled
    };
  }

  /** Create a Stripe Checkout Session for upgrade */
  static async createCheckoutSession(userId: string, plan: 'basic' | 'pro') {
    const sub = await this.getSubscription(userId);
    
    // In a real scenario, you'd map these to real Stripe Price IDs
    const priceId = plan === 'basic' ? process.env.STRIPE_PRICE_BASIC : process.env.STRIPE_PRICE_PRO;
    
    const price = priceId;
    if (!price) throw new Error(`Missing STRIPE_PRICE_${plan.toUpperCase()} in environment`);

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userId,
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing?success=true`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing?canceled=true`,
      customer_email: (await prisma.user.findUnique({ where: { id: userId } }))?.email
    });

    return session.url;
  }

  /** Handle Webhook */
  static async handleStripeWebhook(event: Stripe.Event) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId) {
        // Find which plan they subscribed to based on amount or price ID
        // For simplicity, we just set to pro here if not specified, 
        // in production you'd check session.line_items
        await prisma.subscription.update({
          where: { userId },
          data: {
            plan: 'pro', // Ideally map this from the price ID
            status: 'active',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            workflowsEnabled: true
          }
        });
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: invoice.subscription as string },
        data: { status: 'past_due' }
      });
    }
  }
}

// Cron Job to check limits
export function initBillingCron() {
  // Run daily at midnight (or every minute for testing, let's use every hour '0 * * * *')
  // We'll run it every 5 minutes in this demo so we can see it act fast
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running daily limits check...');
    const month = new Date().toISOString().slice(0, 7);
    
    // Get all usages for this month
    const usages = await prisma.usageMetric.findMany({ where: { month } });
    
    for (const usage of usages) {
      const sub = await prisma.subscription.findUnique({ where: { userId: usage.userId } });
      if (!sub) continue;

      const limit = PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS] || 500;
      
      if (limit !== -1 && usage.executions >= limit) {
        if (sub.workflowsEnabled) {
          console.log(`[CRON] User ${usage.userId} exceeded limit. Disabling workflows.`);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { workflowsEnabled: false }
          });
        }
      } else {
        if (!sub.workflowsEnabled && sub.status === 'active') {
          console.log(`[CRON] User ${usage.userId} under limit. Enabling workflows.`);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { workflowsEnabled: true }
          });
        }
      }
    }
    console.log('[CRON] Limits check complete.');
  });
}
