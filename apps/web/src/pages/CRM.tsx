import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Users, Search, Phone, Mail, Clock, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CRM() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get(`/customers?search=${search}`);
      return res.data;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <Users />
            CRM
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Customers</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading customers...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers?.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No customers found</td></tr>
                ) : (
                  customers?.map((customer: any) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">ID: {customer.identifier || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          {customer.phone && <div className="text-sm text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</div>}
                          {customer.email && <div className="text-sm text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</div>}
                          {!customer.phone && !customer.email && <span className="text-sm text-gray-400">No contact info</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
