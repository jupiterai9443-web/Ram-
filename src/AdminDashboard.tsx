import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { DESIGNS } from './data';
import { CheckCircle2, Clock, Package, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl font-bold text-gray-900">Admin Dashboard</h2>
        <div className="bg-gold-50 text-gold-700 px-4 py-2 rounded-full font-medium text-sm border border-gold-400/30">
          Total Orders: {orders.length}
        </div>
      </div>

      <div className="space-y-6">
        {orders.map(order => (
          <OrderCard 
            key={order.id} 
            order={order} 
            isExpanded={expandedOrder === order.id}
            onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
          />
        ))}
        {orders.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No orders placed yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const OrderCard: React.FC<{ order: any, isExpanded: boolean, onToggle: () => void }> = ({ order, isExpanded, onToggle }) => {
  const date = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt).toLocaleString();
  
  const materialRequirements = useMemo(() => {
    const requirements = new Map<string, number>();
    order.items.forEach((item: any) => {
      const design = DESIGNS.find(d => d.id === item.designId);
      if (!design) return;
      const scalingFactor = item.size / 10;
      design.components.forEach(comp => {
        const adjustedWeight = comp.baseWeight * scalingFactor;
        const finalWeight = adjustedWeight * item.quantity;
        const currentTotal = requirements.get(comp.name) || 0;
        requirements.set(comp.name, currentTotal + finalWeight);
      });
    });
    return Array.from(requirements.entries())
      .map(([componentName, totalWeight]) => ({ componentName, totalWeight }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
  }, [order.items]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gold-400/20 overflow-hidden transition-all">
      <div 
        className="p-6 flex items-center justify-between cursor-pointer hover:bg-beige-50/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-gold-100 rounded-full flex items-center justify-center text-gold-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-semibold text-gray-900">{order.customerName}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {date}</span>
              <span className="font-medium text-gold-600">{order.totalQuantity} items</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {order.status.toUpperCase()}
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-gold-400/10 bg-beige-50/30 space-y-8">
          <div>
            <h4 className="font-serif text-lg font-semibold text-gray-900 mb-4">Items Ordered</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {order.items.map((item: any, idx: number) => {
                const design = DESIGNS.find(d => d.id === item.designId);
                return (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="font-medium text-gray-900">{design?.name || 'Unknown Design'}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.kadap} | {item.gajji}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                      <span className="text-sm font-medium text-gray-600">Size: {item.size}"</span>
                      <span className="text-sm font-bold text-gold-600">Qty: {item.quantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="font-serif text-lg font-semibold text-gray-900 mb-4">Material Requirements</h4>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Component</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-sm text-right">Weight (gm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materialRequirements.map((req, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-4 text-sm text-gray-900">{req.componentName}</td>
                      <td className="py-2 px-4 text-sm font-mono text-right text-gray-600">{req.totalWeight.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gold-50/50 border-t border-gold-400/20">
                  <tr>
                    <td className="py-3 px-4 font-bold text-gray-900 text-sm">Total Silver</td>
                    <td className="py-3 px-4 font-bold font-mono text-gold-600 text-right">
                      {materialRequirements.reduce((sum, req) => sum + req.totalWeight, 0).toFixed(2)} gm
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
