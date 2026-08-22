import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreditCard, CheckCircle2, AlertCircle, ChevronLeft, Zap, Infinity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Billing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: usage, isLoading } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: async () => {
      const res = await api.get('/billing/usage');
      return res.data;
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: 'basic' | 'pro') => {
      const res = await api.post('/billing/create-checkout-session', { plan });
      return res.data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading billing info...</div>;
  }

  const isUnlimited = usage?.limit === -1;
  const progress = isUnlimited ? 0 : Math.min((usage?.executions / usage?.limit) * 100, 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <CreditCard />
            Billing & Usage
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {!usage?.workflowsEnabled && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800">Usage Limit Reached</h3>
              <p className="text-sm">Your workflows have been paused because you have reached the execution limit for your current plan. Please upgrade to continue automating.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Usage Card */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Current Plan: <span className="capitalize text-blue-600">{usage?.plan}</span></h2>
            
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">Monthly Workflow Executions</span>
                <span className="text-gray-900 font-bold">
                  {usage?.executions} / {isUnlimited ? <Infinity className="w-4 h-4 inline" /> : usage?.limit}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${progress > 90 ? 'bg-red-500' : 'bg-blue-600'}`} 
                  style={{ width: `${isUnlimited ? 0 : progress}%` }}
                ></div>
              </div>
              {!isUnlimited && progress > 80 && (
                <p className="text-xs text-red-600 mt-2 font-medium">You are approaching your plan limit.</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Plan Details</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Subscription Status: <span className="capitalize">{usage?.status}</span></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Workflows Enabled: {usage?.workflowsEnabled ? 'Yes' : 'No'}</li>
              </ul>
            </div>
          </div>

          {/* Upgrade Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Available Plans</h2>
            
            {/* Basic Plan */}
            <div className={`bg-white rounded-2xl shadow-sm border p-5 transition-all ${usage?.plan === 'basic' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900">Basic</h3>
                {usage?.plan === 'basic' && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-semibold">Current</span>}
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-4">$19<span className="text-sm text-gray-500 font-normal">/mo</span></p>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500" /> 5,000 Executions</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Standard Support</li>
              </ul>
              <button 
                onClick={() => checkoutMutation.mutate('basic')}
                disabled={usage?.plan === 'basic' || usage?.plan === 'pro' || checkoutMutation.isPending}
                className="w-full py-2 px-4 rounded-lg font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {checkoutMutation.isPending ? 'Processing...' : (usage?.plan === 'basic' || usage?.plan === 'pro') ? 'Current or Lower Plan' : 'Upgrade to Basic'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className={`bg-gradient-to-b from-blue-600 to-blue-800 rounded-2xl shadow-md border-0 p-5 text-white transition-all ${usage?.plan === 'pro' ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Pro</h3>
                {usage?.plan === 'pro' && <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-semibold">Current</span>}
              </div>
              <p className="text-2xl font-bold mb-4">$49<span className="text-sm text-blue-200 font-normal">/mo</span></p>
              <ul className="text-sm text-blue-50 space-y-2 mb-6">
                <li className="flex items-center gap-2"><Infinity className="w-4 h-4 text-blue-300" /> Unlimited Executions</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-300" /> Priority Support</li>
              </ul>
              <button 
                onClick={() => checkoutMutation.mutate('pro')}
                disabled={usage?.plan === 'pro' || checkoutMutation.isPending}
                className="w-full py-2 px-4 rounded-lg font-bold bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {checkoutMutation.isPending ? 'Processing...' : usage?.plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
