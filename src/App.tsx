import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { 
  ShoppingBag, Package, Boxes, Users, Receipt, Settings, Store, 
  Headphones, LogOut, FileSpreadsheet, Download, Smartphone, Monitor,
  ShieldCheck, X, Calculator, LayoutGrid, ChevronDown, Maximize2, Minimize2,
  Sparkles, BookOpen, Award, ShieldAlert, Calendar, GraduationCap
} from 'lucide-react';
import { BillingSection } from './components/billing/BillingSection';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { usePwaInstall } from './utils/usePwaInstall';
import { useAuthStore } from './store/useAuthStore';
import { useKeyboardShortcuts } from './utils/keyboard';
import { useProductStore, isDemoStationeryProduct } from './store/useProductStore';
import { useCustomerStore } from './store/useCustomerStore';
import { useSalesStore } from './store/useSalesStore';
import { useBillingStore } from './store/useBillingStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useChatbotStore } from './store/useChatbotStore';
import { initializeRealtimeLiveSync, useRealtimeStore } from './lib/realtimeSync';
import { db } from './lib/db';
import { getSupabaseClient } from './lib/supabase';
import { useStudentStore } from './store/useStudentStore';
import { useCourseStore } from './store/useCourseStore';
import { useFeeStore } from './store/useFeeStore';
import { useExamStore } from './store/useExamStore';

import { LoginPage } from './components/auth/LoginPage';
import { MobileMoreDrawer } from './components/coaching/MobileMoreDrawer';

// Coaching Class Modules
const FeeCounterSection = lazy(() => import('./components/coaching/FeeCounterSection').then(m => ({ default: m.FeeCounterSection })));
const StudentsSection = lazy(() => import('./components/coaching/StudentsSection').then(m => ({ default: m.StudentsSection })));
const CoursesBatchesSection = lazy(() => import('./components/coaching/CoursesBatchesSection').then(m => ({ default: m.CoursesBatchesSection })));
const AttendanceSection = lazy(() => import('./components/coaching/AttendanceSection').then(m => ({ default: m.AttendanceSection })));
const ExamsMarksSection = lazy(() => import('./components/coaching/ExamsMarksSection').then(m => ({ default: m.ExamsMarksSection })));
const DefaultersSection = lazy(() => import('./components/coaching/DefaultersSection').then(m => ({ default: m.DefaultersSection })));

// Code-split heavy views to guarantee instant 0ms first-contentful-paint
const ProductsSection = lazy(() => import('./components/products/ProductsSection').then(m => ({ default: m.ProductsSection })));
const InventorySection = lazy(() => import('./components/inventory/InventorySection').then(m => ({ default: m.InventorySection })));
const CustomersSection = lazy(() => import('./components/customers/CustomersSection').then(m => ({ default: m.CustomersSection })));
const SalesSection = lazy(() => import('./components/sales/SalesSection').then(m => ({ default: m.SalesSection })));
const SettingsSection = lazy(() => import('./components/settings/SettingsSection').then(m => ({ default: m.SettingsSection })));
const SupportModal = lazy(() => import('./components/common/SupportModal').then(m => ({ default: m.SupportModal })));
const ShareReportsModal = lazy(() => import('./components/caReports/ShareReportsModal').then(m => ({ default: m.ShareReportsModal })));
const PwaInstallModal = lazy(() => import('./components/common/PwaInstallModal').then(m => ({ default: m.PwaInstallModal })));
const DailyCashRegisterModal = lazy(() => import('./components/cashRegister/DailyCashRegisterModal').then(m => ({ default: m.DailyCashRegisterModal })));
const AICopilotModal = lazy(() => import('./components/common/AICopilotModal').then(m => ({ default: m.AICopilotModal })));
const MultiDeviceSyncModal = lazy(() => import('./components/common/MultiDeviceSyncModal').then(m => ({ default: m.MultiDeviceSyncModal })));

export type MainSection =
  | 'fee_counter'
  | 'students'
  | 'batches'
  | 'attendance'
  | 'exams'
  | 'defaulters'
  | 'billing'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'sales'
  | 'settings';

const VALID_SECTIONS: MainSection[] = [
  'fee_counter',
  'students',
  'batches',
  'attendance',
  'exams',
  'defaulters',
  'billing',
  'products',
  'inventory',
  'customers',
  'sales',
  'settings'
];

function getInitialSection(): MainSection {
  if (typeof window !== 'undefined') {
    if (window.location.hash) {
      const hash = window.location.hash.replace('#', '') as MainSection;
      if (VALID_SECTIONS.includes(hash)) return hash;
    }
    try {
      window.history.replaceState(null, '', window.location.pathname + '#fee_counter');
    } catch (_) {}
  }
  return 'fee_counter';
}

export function App() {
  const { isAuthenticated, logout, user } = useAuthStore();
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadCustomers = useCustomerStore((state) => state.loadCustomers);
  const loadInvoices = useSalesStore((state) => state.loadInvoices);
  const cartItemsCount = useBillingStore((state) => state.items.length);
  const products = useProductStore((state) => state.products);
  const lowStockCount = products.filter(p => p.isActive !== false && p.stockQty <= p.minStockLevel && p.stockQty >= 0).length;
  const toggleChatbot = useChatbotStore((state) => state.toggleOpen);
  const { status: realtimeStatus, connectedDevices, latencyMs } = useRealtimeStore();

  // Invoicing is the main default page whenever opening the app
  const [activeSection, setActiveSection] = useState<MainSection>(getInitialSection);

  useEffect(() => {
    window.location.hash = activeSection;
  }, [activeSection]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as MainSection;
      if (['billing', 'products', 'sales', 'settings'].includes(hash)) {
        setActiveSection(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const { shopProfile, loadSettings } = useSettingsStore();
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // Fullscreen state with bi-directional event synchronization
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isDocFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed or blocked by browser permissions:', err);
    }
  };

  const isSyncingRef = useRef(false);

  useEffect(() => {
    // Complete Clean Slate for New Client: Purge any old stock movements (Img 3), old demo products, old invoices, and cart
    if (typeof window !== 'undefined' && !localStorage.getItem('sukhyamart_clean_client_v1')) {
      (async () => {
        try {
          await db.transaction('rw', [
            db.products, db.invoices, db.drafts, db.stockMovements,
            db.customers, db.suppliers, db.purchaseInvoices, db.keyValueSettings
          ], async () => {
            await db.stockMovements.clear();
            await db.products.clear();
            await db.invoices.clear();
            await db.drafts.clear();
            await db.purchaseInvoices.clear();
            await db.suppliers.clear();
            await db.customers.clear();
            await db.keyValueSettings.delete('activeBillingCart');
          });

          // Reset cart in state
          useBillingStore.getState().clearBill();

          // Reset backup date so orange safety banner is dismissed
          localStorage.setItem('webrajya_last_backup_date', new Date().toISOString());
          sessionStorage.setItem('webrajya_backup_banner_dismissed', 'true');
          localStorage.setItem('sukhyamart_clean_client_v1', 'true');

          // Wipe old records from Supabase Cloud (leaving API keys & store settings intact!)
          const client = getSupabaseClient();
          if (client) {
            try {
              await client.from('stock_movements').delete().neq('id', 'keep_none');
              await client.from('invoice_items').delete().neq('id', 'keep_none');
              await client.from('invoices').delete().neq('id', 'keep_none');
              await client.from('purchase_invoice_items').delete().neq('id', 'keep_none');
              await client.from('purchase_invoices').delete().neq('id', 'keep_none');
              await client.from('products').delete().neq('id', 'keep_none');
              await client.from('suppliers').delete().neq('id', 'keep_none');
              await client.from('customers').delete().neq('id', 'cust_default_cash');
            } catch (_) {}
          }

          await Promise.allSettled([
            loadProducts(true),
            loadCustomers(true),
            loadInvoices(true)
          ]);
        } catch (_) {}
      })();
    }

    // Initial data load on mount (Coaching Class ERP)
    useStudentStore.getState().loadStudents();
    useCourseStore.getState().loadCoursesAndBatches();
    useFeeStore.getState().loadFeeData();
    useExamStore.getState().loadExamsAndScores();
    loadSettings();
    initializeRealtimeLiveSync();

    // Event-driven & adaptive background synchronization with Mutex
    const runSilentSync = async () => {
      if (isSyncingRef.current || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) {
        return;
      }
      isSyncingRef.current = true;
      try {
        await Promise.allSettled([
          loadCustomers(true),
          loadInvoices(true),
          loadSettings()
        ]);
      } catch (_) {
        // Silent background suppression
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Passive 60-second safety heartbeat interval (conserves mobile battery & eliminates UI lag).
    // Live multi-device updates are pushed instantly via Supabase Realtime WebSocket channels.
    const heartbeatInterval = setInterval(runSilentSync, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSilentSync();
      }
    };

    window.addEventListener('online', runSilentSync);
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('online', runSilentSync);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadProducts, loadCustomers, loadInvoices, loadSettings]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAddProductOpenFromApp, setIsAddProductOpenFromApp] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isShareReportsOpen, setIsShareReportsOpen] = useState(false);

  const { 
    hasNativePrompt, isInstalled, isStandalone, isIos, promptInstall 
  } = usePwaInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [installModalTab, setInstallModalTab] = useState<'windows' | 'pwa'>('windows');
  const isInsideElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsToolsMenuOpen(false);
      }
    };
    if (isToolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isToolsMenuOpen]);

  const [showBackupAlert, setShowBackupAlert] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (sessionStorage.getItem('webrajya_backup_banner_dismissed') === 'true') return false;
    const lastBackup = localStorage.getItem('webrajya_last_backup_date');
    if (!lastBackup) return true;
    const lastTime = new Date(lastBackup).getTime();
    const diffDays = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  });

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => {
      // Avoid stacking duplicate toast messages
      const isDuplicate = prev.some(t => t.title === title && t.description === description);
      if (isDuplicate) return prev;
      // Keep maximum 3 visible toasts on screen
      const trimmed = prev.length >= 3 ? prev.slice(-2) : prev;
      return [...trimmed, { id, type, title, description }];
    });
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Global Keyboard Navigation Shortcuts
  useKeyboardShortcuts({
    onF2_NewBill: () => {
      if (activeSection !== 'fee_counter') setActiveSection('fee_counter');
    },
    onF4_SearchProduct: () => {
      if (activeSection !== 'fee_counter') setActiveSection('fee_counter');
    },
    onF8_QuickPay: () => {
      if (activeSection !== 'fee_counter') setActiveSection('fee_counter');
    },
    onF9_SaveAndPrint: () => {
      if (activeSection !== 'fee_counter') setActiveSection('fee_counter');
    },
    onF10_HoldDraft: () => {
      if (activeSection !== 'fee_counter') setActiveSection('fee_counter');
    }
  });

  const navItems: { id: MainSection; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'fee_counter', label: 'Fee Counter', icon: <Receipt className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: 'F2' },
    { id: 'students', label: 'Students', icon: <Users className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: '' },
    { id: 'batches', label: 'Batches & Courses', icon: <BookOpen className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: '' },
    { id: 'attendance', label: 'Attendance', icon: <Calendar className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: '' },
    { id: 'exams', label: 'Exams & Marks', icon: <Award className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: '' },
    { id: 'defaulters', label: 'Defaulters', icon: <ShieldAlert className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: '' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5 text-current shrink-0" />, shortcut: '' },
  ];

  // Render Login Page if user is not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center font-bold text-[#14213D]">Loading WebRajya Tuition ERP...</div>}>
        <LoginPage onOpenSupport={() => setIsSupportOpen(true)} />
        {isSupportOpen && <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />}
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1C1917] flex flex-col font-sans antialiased">
      {/* SECTION 3: Compact Horizontal Top Navigation Bar (Oxford Navy #14213D) */}
      <header className="no-print bg-[#14213D] text-white shrink-0 border-b border-[#0A1220] shadow-sm sticky top-0 z-40 px-3 sm:px-4 py-2 flex items-center justify-between safe-area-pt">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#C88A35]/20 text-[#E0A96D] flex items-center justify-center font-black text-sm border border-[#C88A35]/40 shrink-0">
            🎓
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-black tracking-wide uppercase leading-none whitespace-nowrap">
              <span className="text-white">WEBRAJYA</span> <span className="text-[#C88A35]">TUITION</span>
            </h1>
            <span className="hidden xl:inline-block text-[11px] text-[#C88A35]/80 font-medium border-l border-white/20 pl-2 leading-none whitespace-nowrap">
              ERP & Fee Manager
            </span>
          </div>
        </div>

        {/* Horizontal Navigation Tabs (Desktop only) */}
        <nav className="hidden md:flex items-center gap-1 xl:gap-1.5 flex-1 justify-center px-2">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`h-9 px-2.5 xl:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#C88A35] text-[#14213D] shadow-sm font-bold ring-1 ring-[#E0A96D]/50'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="whitespace-nowrap">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-black/20 text-white font-mono font-bold leading-none shrink-0">
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Info: Unified Tools Dropdown & Logout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Single Unified Menu for App Download, CA Reports, Register & Support */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen((prev) => !prev)}
              className={`h-9 text-xs font-bold px-2.5 rounded-lg border flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                isToolsMenuOpen
                  ? 'bg-[#1D4ED8] text-white border-blue-300 ring-2 ring-white/20 shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white/95 hover:text-white border-white/15 shadow-xs'
              }`}
              title="Tools (Install App, CA Reports, Cash Register, Support)"
              aria-expanded={isToolsMenuOpen}
              aria-haspopup="true"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#E0A96D] shrink-0" />
              <span className="tracking-wide">Tools</span>
              <ChevronDown
                className={`w-3 h-3 text-white/70 shrink-0 transition-transform duration-200 ${
                  isToolsMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu Popup */}
            {isToolsMenuOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Quick Tools & Services
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                    5 Tools
                  </span>
                </div>

                <div className="py-1 space-y-1">
                  {/* 1. WebRajya AI Chatbot */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleChatbot(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-xs border border-slate-200 group-hover:scale-105 transition-transform">
                      <img src="/logo.png" alt="WebRajya Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-indigo-950 flex items-center gap-1.5">
                          WebRajya AI Chatbot
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Free AI
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Ask questions, software directions & store help
                      </p>
                    </div>
                  </button>

                  {/* 2. App Download / Install */}
                  {!isInsideElectron ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInstallModalTab(typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent) ? 'windows' : 'pwa');
                        setIsInstallModalOpen(true);
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-slate-800 group-hover:text-emerald-950">
                            {isInstalled || isStandalone ? 'App Ready' : 'Download / Install App'}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {isInstalled || isStandalone ? 'Ready' : 'PC & Mobile'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Windows desktop .exe & Mobile PWA
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full flex items-center gap-3 p-2 rounded-lg text-left bg-emerald-50/70 border border-emerald-200/80">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-emerald-950">Windows App Active</span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            v1.0
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 truncate mt-0.5">Desktop Edition Installed</p>
                      </div>
                    </div>
                  )}

                  {/* 2. CA Reports */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsShareReportsOpen(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-green-50 border border-transparent hover:border-green-200 transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 border border-green-200 flex items-center justify-center shrink-0 group-hover:bg-green-700 group-hover:text-white transition-colors">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-green-950">
                          CA Reports
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                          Excel / PDF
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Share monthly sales & tax data with CA
                      </p>
                    </div>
                  </button>

                  {/* 3. Daily Cash Register */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsCashRegisterOpen(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-amber-950">
                          Cash Register
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Daily Cash
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Daily cash drawer & day-end balance
                      </p>
                    </div>
                  </button>

                  {/* 4. Support */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsSupportOpen(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-red-50 border border-transparent hover:border-red-200 transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 border border-red-200 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-red-950">
                          Support
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                          Helpline
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Call / WhatsApp: 9630013483
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Kiosk Mode Toggle (Laptop / Desktop Viewports Only) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`h-9 hidden md:inline-flex items-center gap-1.5 font-bold text-xs px-2.5 rounded-lg border whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
              isFullscreen
                ? 'bg-[#1D4ED8] text-cyan-200 border-cyan-300 ring-2 ring-white/20 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border-white/15 shadow-xs'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc / F11)' : 'Enter Full Screen (F11 Kiosk Mode)'}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            )}
            <span className="tracking-wide hidden lg:inline">{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
          </button>

          <button
            onClick={() => logout()}
            className="h-9 bg-white/10 hover:bg-white/20 text-white/90 hover:text-white font-bold text-xs px-2.5 rounded-lg border border-white/15 flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer active:scale-95"
            title="Logout of WebRajya Tuition"
          >
            <LogOut className="w-3.5 h-3.5 text-red-300 shrink-0" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* 7-Day Safety Net Automated Backup Reminder */}
      {showBackupAlert && (
        <div className="no-print bg-gradient-to-r from-amber-600 to-amber-700 text-white px-3 sm:px-4 py-2 text-xs flex items-center justify-between shadow-sm shrink-0 border-b border-amber-800">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <ShieldCheck className="w-4 h-4 text-amber-200 shrink-0" />
            <span className="truncate">
              <strong>Database Safety Reminder:</strong> No offline backup taken in the last 7 days. Download your JSON backup to protect sales and stock records.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveSection('settings');
                setShowBackupAlert(false);
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 rounded-md font-black text-[11px] shadow-2xs transition-colors cursor-pointer"
            >
              Backup Now
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem('webrajya_backup_banner_dismissed', 'true');
                setShowBackupAlert(false);
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors text-white/90 cursor-pointer"
              title="Dismiss for this session"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Area (#F5F9FF background) */}
      <main className="no-print flex-1 p-2 pb-28 md:p-3 md:pb-4 w-full mx-auto overflow-x-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[350px] text-xs font-bold text-[#64748B]">
            <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
            Loading workspace...
          </div>
        }>
          {activeSection === 'fee_counter' && <FeeCounterSection />}
          {activeSection === 'students' && <StudentsSection />}
          {activeSection === 'batches' && <CoursesBatchesSection />}
          {activeSection === 'attendance' && <AttendanceSection />}
          {activeSection === 'exams' && <ExamsMarksSection />}
          {activeSection === 'defaulters' && (
            <DefaultersSection onNavigateToFeeCounter={() => setActiveSection('fee_counter')} />
          )}
          {activeSection === 'billing' && (
            <BillingSection 
              onToast={addToast} 
              onOpenAddProductModal={() => {
                setActiveSection('products');
                setIsAddProductOpenFromApp(true);
              }} 
            />
          )}
          {activeSection === 'products' && (
            <ProductsSection 
              onToast={addToast} 
              isAddModalOpenFromExternal={isAddProductOpenFromApp}
              onCloseExternalModal={() => setIsAddProductOpenFromApp(false)}
            />
          )}
          {activeSection === 'inventory' && <InventorySection onToast={addToast} />}
          {activeSection === 'customers' && <CustomersSection onToast={addToast} />}
          {activeSection === 'sales' && <SalesSection onToast={addToast} onNavigateToBilling={() => setActiveSection('billing')} />}
          {activeSection === 'settings' && <SettingsSection onToast={addToast} />}
        </Suspense>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar - Exactly 4 Focused Options */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F2942] text-white border-t border-[#0A1D30] flex items-center justify-around py-2 px-3 shadow-2xl safe-area-pb">
        <button
          onClick={() => setActiveSection('fee_counter')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all flex-1 active:scale-95 cursor-pointer ${
            activeSection === 'fee_counter'
              ? 'bg-[#C88A35] text-[#14213D] shadow-xs font-black'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Fee Counter</span>
        </button>

        <button
          onClick={() => setActiveSection('students')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all flex-1 active:scale-95 cursor-pointer ${
            activeSection === 'students'
              ? 'bg-[#C88A35] text-[#14213D] shadow-xs font-black'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Students</span>
        </button>

        <button
          onClick={() => setActiveSection('attendance')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all flex-1 active:scale-95 cursor-pointer ${
            activeSection === 'attendance'
              ? 'bg-[#C88A35] text-[#14213D] shadow-xs font-black'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setIsMobileMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all flex-1 active:scale-95 cursor-pointer ${
            ['batches', 'exams', 'defaulters', 'settings'].includes(activeSection)
              ? 'bg-[#C88A35] text-[#14213D] shadow-xs font-black'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Slide-up Hub Drawer for Mobile */}
      <MobileMoreDrawer
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        onSelectSection={(sec) => setActiveSection(sec)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        instituteName={shopProfile.shopName}
      />

      {/* Modals rendered on-demand inside Suspense */}
      <Suspense fallback={null}>
        {/* Support Contact Modal */}
        {isSupportOpen && <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />}

        {/* Share Reports with CA Modal */}
        {isShareReportsOpen && (
          <ShareReportsModal
            isOpen={isShareReportsOpen}
            onClose={() => setIsShareReportsOpen(false)}
            onToast={addToast}
          />
        )}

        {/* PWA / Windows Install Modal (Laptop, Tablet & Mobile) */}
        {isInstallModalOpen && (
          <PwaInstallModal
            isOpen={isInstallModalOpen}
            onClose={() => setIsInstallModalOpen(false)}
            onInstall={promptInstall}
            hasNativePrompt={hasNativePrompt}
            isInstalled={isInstalled}
            isIos={isIos}
            initialTab={installModalTab}
          />
        )}

        {/* Daily Cash Register & Day-End Cash Closure Modal */}
        {isCashRegisterOpen && (
          <DailyCashRegisterModal
            isOpen={isCashRegisterOpen}
            onClose={() => setIsCashRegisterOpen(false)}
            shopProfile={shopProfile}
            onToast={addToast}
          />
        )}

        {/* Multi-Device Live Sync Status & Diagnostic Modal */}
        {isSyncModalOpen && (
          <MultiDeviceSyncModal
            isOpen={isSyncModalOpen}
            onClose={() => setIsSyncModalOpen(false)}
            onNavigateToSettings={() => setActiveSection('settings')}
          />
        )}

        {/* 100% Free WebRajya Invoice Chatbot */}
        <AICopilotModal
          onNavigateSection={(sec) => {
            setActiveSection(sec);
          }}
          onOpenModal={(modalType) => {
            setActiveSection('inventory');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-inventory-modal', { detail: modalType }));
            }, 80);
          }}
        />
      </Suspense>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
