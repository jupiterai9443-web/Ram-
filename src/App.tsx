/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, Download, ChevronLeft, CheckCircle2, Lock, Unlock, Info, User } from 'lucide-react';
import { DESIGNS, Design } from './data';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import AdminDashboard from './AdminDashboard';

const AVAILABLE_SIZES = [10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5] as const;
type Size = typeof AVAILABLE_SIZES[number];
type KadapOption = 'Kadap' | 'Without Kadap';
type GajjiOption = '3 Gajji' | 'Plain';

interface OrderItem {
  id: string;
  designId: string;
  kadap: KadapOption;
  gajji: GajjiOption;
  size: Size;
  quantity: number;
}

interface GroupedOrder {
  key: string;
  designId: string;
  designName: string;
  kadap: KadapOption;
  gajji: GajjiOption;
  sizes: Record<Size, number>;
  total: number;
}

interface MaterialRequirement {
  componentName: string;
  totalWeight: number;
}

export default function App() {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [view, setView] = useState<'shop' | 'results' | 'admin'>('shop');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [showDownloadInfo, setShowDownloadInfo] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.email === 'jupiterai9443@gmail.com') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (designId: string, kadap: KadapOption, gajji: GajjiOption, size: Size, quantity: number) => {
    if (quantity <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => 
        item.designId === designId && 
        item.kadap === kadap &&
        item.gajji === gajji &&
        item.size === size
      );
      if (existing) {
        return prev.map(item => 
          item.id === existing.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { id: crypto.randomUUID(), designId, kadap, gajji, size, quantity }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !customerName.trim()) return;
    setIsPlacingOrder(true);
    try {
      await addDoc(collection(db, 'orders'), {
        customerName,
        status: 'pending',
        totalQuantity,
        createdAt: serverTimestamp(),
        items: cart.map(item => ({
          designId: item.designId,
          kadap: item.kadap,
          gajji: item.gajji,
          size: item.size,
          quantity: item.quantity
        }))
      });
      setView('results');
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const resetOrder = () => {
    setCart([]);
    setCustomerName('');
    setView('shop');
    setSelectedCategory(null);
  };

  const groupedOrders = useMemo(() => {
    const groups = new Map<string, GroupedOrder>();
    cart.forEach(item => {
      const key = `${item.designId}-${item.kadap}-${item.gajji}`;
      if (!groups.has(key)) {
        const design = DESIGNS.find(d => d.id === item.designId);
        groups.set(key, {
          key,
          designId: item.designId,
          designName: design?.name || 'Unknown',
          kadap: item.kadap,
          gajji: item.gajji,
          sizes: AVAILABLE_SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {} as Record<Size, number>),
          total: 0
        });
      }
      const group = groups.get(key)!;
      group.sizes[item.size] += item.quantity;
      group.total += item.quantity;
    });
    return Array.from(groups.values());
  }, [cart]);

  const ordersByDesign = useMemo(() => {
    const grouped = new Map<string, GroupedOrder[]>();
    groupedOrders.forEach(order => {
      if (!grouped.has(order.designId)) {
        grouped.set(order.designId, []);
      }
      grouped.get(order.designId)!.push(order);
    });
    return Array.from(grouped.values());
  }, [groupedOrders]);

  const materialRequirements = useMemo(() => {
    const requirements = new Map<string, number>();

    cart.forEach(item => {
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
  }, [cart]);

  const downloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Order Sheet Section
    csvContent += "ORDER SHEET\n";
    csvContent += `Design Name,Kadap,Gajji,${AVAILABLE_SIZES.map(s => `${s} inch`).join(',')},Total\n`;
    groupedOrders.forEach(row => {
      const sizeValues = AVAILABLE_SIZES.map(s => row.sizes[s]).join(',');
      csvContent += `"${row.designName}","${row.kadap}","${row.gajji}",${sizeValues},${row.total}\n`;
    });
    csvContent += `Total,,,${AVAILABLE_SIZES.map(() => '').join(',')},${totalQuantity}\n`;

    if (isAdmin) {
      csvContent += "\n\n";

      // Material Requirement Section
      csvContent += "MATERIAL REQUIREMENT SHEET\n";
      csvContent += "Component Name,Total Weight Required (gm)\n";
      materialRequirements.forEach(req => {
        csvContent += `"${req.componentName}",${req.totalWeight.toFixed(2)}\n`;
      });
      csvContent += `Total Silver Required,,${materialRequirements.reduce((sum, req) => sum + req.totalWeight, 0).toFixed(2)}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jagam_order_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const designsByCategory = useMemo(() => {
    const grouped = new Map<string, Design[]>();
    DESIGNS.forEach(d => {
      if (!grouped.has(d.category)) grouped.set(d.category, []);
      grouped.get(d.category)!.push(d);
    });
    return Array.from(grouped.entries());
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gold-400/20 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500 rounded-full flex items-center justify-center text-white font-serif font-bold text-xl shadow-md">
              JC
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">Jagam Collections</h1>
              <p className="text-xs text-gold-600 font-medium uppercase tracking-widest">Wholesale Silver</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDownloadInfo(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <Info className="w-4 h-4" />
              How to Download
            </button>
            <button
              onClick={async () => {
                if (isAdmin) {
                  await logout();
                  setView('shop');
                } else {
                  await loginWithGoogle();
                }
              }}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${isAdmin ? 'bg-gold-100 text-gold-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              {isAdmin ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {isAdmin ? 'Logout' : 'Admin Login'}
            </button>

            {isAdmin && (
              <button
                onClick={() => setView(view === 'admin' ? 'shop' : 'admin')}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full transition-colors bg-gray-900 text-white hover:bg-gray-800"
              >
                {view === 'admin' ? 'Back to Shop' : 'Dashboard'}
              </button>
            )}

            {view === 'shop' && !isAdmin && (
              <div className="flex items-center gap-2 bg-beige-50 px-4 py-2 rounded-full border border-gold-400/30">
                <ShoppingBag className="w-5 h-5 text-gold-600" />
                <span className="font-semibold text-gray-900">{totalQuantity} items</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative">
        {showDownloadInfo && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
              <button 
                onClick={() => setShowDownloadInfo(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
              <h3 className="font-serif text-xl font-bold text-gray-900 mb-4">How to Download this App</h3>
              <div className="space-y-4 text-gray-600 text-sm">
                <p>To download the source code of this application to your local computer:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Look at the top right corner of the AI Studio interface.</li>
                  <li>Click on the <strong>Settings</strong> menu (usually a gear icon or three dots).</li>
                  <li>Select <strong>"Export to ZIP"</strong> or <strong>"Export to GitHub"</strong>.</li>
                  <li>If you choose ZIP, it will download a folder containing all the code (React, Vite, Tailwind).</li>
                </ol>
                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mt-4">
                  <p className="font-medium mb-1">To run it locally after downloading:</p>
                  <code className="block bg-white/50 px-2 py-1 rounded text-xs">npm install</code>
                  <code className="block bg-white/50 px-2 py-1 rounded text-xs mt-1">npm run dev</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'admin' && isAdmin && (
          <AdminDashboard />
        )}

        {view === 'shop' ? (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Product List / Categories */}
            <div className="flex-grow space-y-6">
              {!selectedCategory ? (
                <>
                  <h2 className="font-serif text-2xl font-semibold text-gray-900 mb-6">Collections</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {designsByCategory.map(([category, categoryDesigns]) => (
                      <div 
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className="cursor-pointer bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gold-400/10 overflow-hidden group relative"
                      >
                        <div className="aspect-[4/3] relative overflow-hidden bg-beige-100">
                          <img 
                            src={categoryDesigns[0].image} 
                            alt={category}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                            <h3 className="text-white font-serif text-3xl font-bold tracking-widest drop-shadow-lg mb-2">{category}</h3>
                            <p className="text-gold-400 font-medium text-sm uppercase tracking-widest">{categoryDesigns.length} Designs</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-4 mb-6 border-b border-gold-400/20 pb-4">
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className="p-2 hover:bg-beige-50 rounded-full transition-colors text-gray-500 hover:text-gold-600"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                      <h2 className="font-serif text-2xl font-semibold text-gray-900">{selectedCategory}</h2>
                      <p className="text-sm text-gray-500">{designsByCategory.find(([c]) => c === selectedCategory)?.[1].length} Designs Available</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {designsByCategory.find(([c]) => c === selectedCategory)?.[1].map(design => (
                      <ProductCard key={design.id} design={design} onAdd={addToCart} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cart / Order Summary */}
            <div className="w-full lg:w-96 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-lg border border-gold-400/20 p-6 sticky top-28">
                <h2 className="font-serif text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-gold-500" />
                  Order Summary
                </h2>
                
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Your order is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {cart.map(item => {
                      const design = DESIGNS.find(d => d.id === item.designId);
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-beige-50 rounded-xl border border-gold-400/10">
                          <div>
                            <p className="font-medium text-gray-900">{design?.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.kadap} | {item.gajji}</p>
                            <p className="text-sm text-gray-600 mt-1">Size: {item.size}" | Qty: {item.quantity}</p>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center font-serif text-lg font-semibold text-gray-900">
                    <span>Total Quantity</span>
                    <span>{totalQuantity}</span>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Customer Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                      />
                    </div>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={cart.length === 0 || !customerName.trim() || isPlacingOrder}
                    className="w-full bg-gold-500 hover:bg-gold-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:shadow-none"
                  >
                    {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
                    {!isPlacingOrder && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : view === 'results' ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setView('shop')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium"
              >
                <ChevronLeft className="w-5 h-5" />
                Back to Shop
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={downloadCSV}
                  className="flex items-center gap-2 bg-white border border-gold-400 text-gold-600 hover:bg-gold-50 font-medium py-2 px-4 rounded-xl transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
                <button 
                  onClick={resetOrder}
                  className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white font-medium py-2 px-4 rounded-xl transition-colors shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  New Order
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gold-400/20 overflow-hidden">
              <div className="bg-gold-50 p-6 border-b border-gold-400/20 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-gold-500" />
                <div>
                  <h2 className="font-serif text-2xl font-bold text-gray-900">Order Successfully Placed</h2>
                  <p className="text-gold-600 font-medium">Review your order details and material requirements below.</p>
                </div>
              </div>

              <div className="p-8 space-y-10">
                {/* Order Sheet */}
                <div>
                  <h3 className="font-serif text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-gold-500 rounded-full"></span>
                    Order Sheet
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-beige-50 border-b border-gray-200">
                          <th className="py-3 px-4 font-semibold text-gray-700">Design Name</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">Kadap</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">Gajji</th>
                          {AVAILABLE_SIZES.map(s => (
                            <th key={s} className="py-3 px-2 font-semibold text-gray-700 text-center">{s}"</th>
                          ))}
                          <th className="py-3 px-4 font-semibold text-gray-700 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ordersByDesign.map((orders, groupIndex) => (
                          <React.Fragment key={orders[0].designId}>
                            {orders.map((row, index) => (
                              <tr key={row.key} className="hover:bg-gray-50/50 transition-colors">
                                {index === 0 && (
                                  <td 
                                    rowSpan={orders.length} 
                                    className="py-3 px-4 font-medium text-gray-900 border-r border-gray-100 align-top bg-white"
                                  >
                                    {row.designName}
                                  </td>
                                )}
                                <td className="py-3 px-4 text-gray-600">{row.kadap}</td>
                                <td className="py-3 px-4 text-gray-600">{row.gajji}</td>
                                {AVAILABLE_SIZES.map(s => (
                                  <td key={s} className="py-3 px-2 text-gray-900 text-center">{row.sizes[s] || '-'}</td>
                                ))}
                                <td className="py-3 px-4 text-gray-900 font-medium text-right">{row.total}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                      <tfoot className="bg-beige-50/50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="py-4 px-4 font-bold text-gray-900 text-right">Total Quantity</td>
                          {AVAILABLE_SIZES.map(s => {
                            const colTotal = groupedOrders.reduce((sum, row) => sum + row.sizes[s], 0);
                            return (
                              <td key={s} className="py-4 px-2 font-bold text-gray-900 text-center">
                                {colTotal || '-'}
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 font-bold text-gray-900 text-right text-lg">{totalQuantity}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Material Requirement Sheet */}
                {isAdmin && (
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-gold-500 rounded-full"></span>
                      Material Requirement Sheet
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-beige-50 border-b border-gray-200">
                            <th className="py-3 px-4 font-semibold text-gray-700">Component Name</th>
                            <th className="py-3 px-4 font-semibold text-gray-700 text-right">Total Weight Required (gm)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {materialRequirements.map((req, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-4 font-medium text-gray-900">{req.componentName}</td>
                              <td className="py-3 px-4 text-gray-900 font-mono text-right">{req.totalWeight.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gold-50/50 border-t border-gold-400/20">
                          <tr>
                            <td className="py-4 px-4 font-bold text-gray-900">Total Silver Required</td>
                            <td className="py-4 px-4 font-bold font-mono text-gold-600 text-right text-lg">
                              {materialRequirements.reduce((sum, req) => sum + req.totalWeight, 0).toFixed(2)} gm
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

interface ProductCardProps {
  design: Design;
  onAdd: (id: string, kadap: KadapOption, gajji: GajjiOption, size: Size, qty: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ design, onAdd }) => {
  const [kadap, setKadap] = useState<KadapOption>('Kadap');
  const [gajji, setGajji] = useState<GajjiOption>('3 Gajji');
  const [size, setSize] = useState<Size>(10);
  const [quantity, setQuantity] = useState<number>(1);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gold-400/10 overflow-hidden flex flex-col group">
      <div className="aspect-[4/3] relative overflow-hidden bg-beige-100">
        <img 
          src={design.image} 
          alt={design.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-serif text-xl font-semibold text-gray-900 mb-4">{design.name}</h3>
        
        <div className="space-y-4 mt-auto">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Kadap Option</label>
            <div className="flex gap-2">
              {(['Kadap', 'Without Kadap'] as KadapOption[]).map(k => (
                <button
                  key={k}
                  onClick={() => setKadap(k)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    kadap === k 
                      ? 'bg-gold-50 border-gold-400 text-gold-600' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gold-400/50 hover:bg-beige-50'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Gajji Option</label>
            <div className="flex gap-2">
              {(['3 Gajji', 'Plain'] as GajjiOption[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGajji(g)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    gajji === g 
                      ? 'bg-gold-50 border-gold-400 text-gold-600' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gold-400/50 hover:bg-beige-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Size</label>
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    size === s 
                      ? 'bg-gold-50 border-gold-400 text-gold-600' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gold-400/50 hover:bg-beige-50'
                  }`}
                >
                  {s}"
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Quantity</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-1.5 text-gray-500 hover:bg-beige-50 hover:text-gold-600 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input 
                type="number" 
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-center font-medium text-gray-900 focus:outline-none py-1.5 bg-transparent"
              />
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="p-1.5 text-gray-500 hover:bg-beige-50 hover:text-gold-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              onAdd(design.id, kadap, gajji, size, quantity);
              setQuantity(1); // Reset quantity after adding
            }}
            className="w-full bg-gray-900 hover:bg-gold-600 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <Plus className="w-4 h-4" />
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}
