import React, { useState, useEffect } from 'react';
import { 
  Store, Save, RefreshCw, Download, Upload, ShieldCheck, Trash2,
  Printer, Receipt, FileText, CheckCircle2, Usb, Scissors, Zap, DollarSign, Info, Monitor,
  Volume2, VolumeX, Bluetooth, ShoppingBag, MessageCircle, Image as ImageIcon,
  ArrowLeft, ChevronRight, Settings, Sparkles, Key, Eye, EyeOff, ExternalLink, Keyboard,
  ScanBarcode, Barcode, Tag
} from 'lucide-react';
import { BarcodeGeneratorModal } from '../products/BarcodeGeneratorModal';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProductStore } from '../../store/useProductStore';
import { useSalesStore } from '../../store/useSalesStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { ShopProfileSchema } from '../../utils/validation';
import { PaperSize, PrintEngine, BillingSettings } from '../../types';
import { PwaInstallModal } from '../common/PwaInstallModal';
import { WINDOWS_EXE_URL } from '../../utils/constants';
import { usePwaInstall } from '../../utils/usePwaInstall';
import { isSoundEnabled, setSoundEnabled, playBeep, playCashChime, playError } from '../../utils/audio';
import { 
  pairUsbPrinter, testUsbPrinter, testUsbCut, testUsbCashDrawer, 
  getUsbPrinterStatus, isWebUsbSupported 
} from '../../lib/usbPrinter';
import {
  isBluetoothSupported,
  isBluetoothPrinterConnected,
  getConnectedBluetoothName,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  printTestBluetooth
} from '../../lib/bluetoothPrinter';

interface SettingsSectionProps {
  onToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ onToast }) => {
  const { 
    shopProfile, printSettings, billingSettings, supabaseConfig, isLoading, isTestingConnection,
    loadSettings, saveShopProfile, savePrintSettings, saveBillingSettings, saveSupabaseConfig, testConnection, exportBackupJSON, importBackupJSON, clearAllDemoData
  } = useSettingsStore();

  const { products, loadProducts } = useProductStore();
  const { loadInvoices } = useSalesStore();

  const { syncWithSupabase: syncProducts } = useProductStore();
  const { syncInvoicesWithSupabase: syncInvoices } = useSalesStore();

  const [activeTab, setActiveTab] = useState<'shop' | 'billing' | 'print' | 'hardware' | 'backup' | 'sound' | 'ai' | 'shortcuts' | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [hardwareScanInput, setHardwareScanInput] = useState('');
  const [lastHardwareScan, setLastHardwareScan] = useState<{
    code: string;
    length: number;
    speedMs: number;
    matchedProduct?: any;
    timestamp: string;
  } | null>(null);
  const scanStartTimeRef = React.useRef<number | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => 
    typeof window !== 'undefined' ? localStorage.getItem('webrajya_last_backup_date') : null
  );

  // Gemini AI Key State
  const { geminiApiKey, setGeminiApiKey } = usePurchaseStore();
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  
  // Local form states
  const [profileForm, setProfileForm] = useState(shopProfile);
  const [printForm, setPrintForm] = useState(printSettings);
  const [billingForm, setBillingForm] = useState(billingSettings);
  const [supaForm, setSupaForm] = useState(supabaseConfig);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBillingForm(billingSettings);
  }, [billingSettings]);

  const handleToggleBillingSetting = async (key: keyof BillingSettings, value: any) => {
    const updated = { ...billingForm, [key]: value };
    setBillingForm(updated);
    await saveBillingSettings(updated);
    onToast('success', 'Setting Saved', 'Invoice & billing mode configuration updated.');
  };

  const handleTestGeminiKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      onToast('error', 'API Key Missing', 'Please paste your Google Gemini API key first.');
      return;
    }
    setIsTestingAi(true);
    try {
      // 1. First validate API key against Google's models endpoint
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        onToast('success', 'Gemini AI Connected!', 'Successfully validated your Google Gemini API key with Google AI Studio.');
        setIsTestingAi(false);
        return;
      }

      // 2. If list fails, try generation with active candidate models
      const candidates = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite'];
      let succeeded = false;
      let lastErr = '';

      for (const model of candidates) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Ping' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });
          if (res.ok) {
            succeeded = true;
            onToast('success', 'Gemini AI Connected!', `Connected successfully using ${model}.`);
            break;
          } else {
            lastErr = await res.text();
          }
        } catch (e: any) {
          lastErr = e?.message || '';
        }
      }

      if (!succeeded) {
        onToast('error', 'Validation Failed', `Google API error: ${lastErr.slice(0, 120)}`);
      }
    } catch (err: any) {
      onToast('error', 'Connection Error', err?.message || 'Failed to reach Google Gemini API');
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveGeminiKey = () => {
    const key = apiKeyInput.trim();
    setGeminiApiKey(key);
    onToast('success', 'AI Configuration Saved', key ? 'Google Gemini API key saved successfully.' : 'API key cleared.');
  };

  const { hasNativePrompt, isInstalled, isStandalone, isIos, promptInstall } = usePwaInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [installModalTab, setInstallModalTab] = useState<'windows' | 'pwa'>('windows');

  // Electron Native Windows App state
  const isInsideElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const [nativePrinters, setNativePrinters] = useState<Array<{ name: string; displayName: string; isDefault: boolean }>>([]);
  const [selectedNativePrinter, setSelectedNativePrinter] = useState<string>(
    () => (typeof window !== 'undefined' ? localStorage.getItem('webrajya_electron_printer') || '' : '')
  );
  const [isTestingNativePrint, setIsTestingNativePrint] = useState(false);

  // USB Thermal Hardware Pairing State
  const [usbStatus, setUsbStatus] = useState(getUsbPrinterStatus());
  const [isPairingUsb, setIsPairingUsb] = useState(false);
  const [isTestingUsb, setIsTestingUsb] = useState(false);

  // Wireless Bluetooth Hardware Pairing State (Mobile / Handheld)
  const [bluetoothConnected, setBluetoothConnected] = useState(isBluetoothPrinterConnected());
  const [bluetoothDeviceName, setBluetoothDeviceName] = useState(getConnectedBluetoothName());
  const [isPairingBluetooth, setIsPairingBluetooth] = useState(false);
  const [isTestingBluetooth, setIsTestingBluetooth] = useState(false);

  useEffect(() => {
    loadSettings();
    setUsbStatus(getUsbPrinterStatus());
    setBluetoothConnected(isBluetoothPrinterConnected());
    setBluetoothDeviceName(getConnectedBluetoothName());

    const handleBtStatus = (e: any) => {
      setBluetoothConnected(!!e.detail?.connected);
      setBluetoothDeviceName(e.detail?.deviceName || null);
    };
    window.addEventListener('webrajya_bluetooth_status', handleBtStatus);

    if (isInsideElectron && window.electronAPI) {
      window.electronAPI.getPrinters().then((printers) => {
        setNativePrinters(printers);
      }).catch(err => console.warn('Could not fetch native printers:', err));
    }

    return () => {
      window.removeEventListener('webrajya_bluetooth_status', handleBtStatus);
    };
  }, [isInsideElectron]);

  const handleSelectNativePrinter = (printerName: string) => {
    setSelectedNativePrinter(printerName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('webrajya_electron_printer', printerName);
    }
    onToast('success', 'Windows Printer Set', printerName ? `Assigned to: ${printerName}` : 'Using Windows Default Printer');
  };

  const handleTestNativePrint = async () => {
    if (!window.electronAPI) return;
    setIsTestingNativePrint(true);
    try {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 11px; margin: 0; padding: 12px; }
            .c { text-align: center; }
            .b { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="c b">*** WEBRAJYA INVOICE ***</div>
          <div class="c">${shopProfile.shopName || 'Retail Store'}</div>
          <div class="line"></div>
          <div>TEST PRINT: Native Windows Silent Spooler</div>
          <div>TARGET PRINTER: ${selectedNativePrinter || 'System Default'}</div>
          <div>STATUS: 100% Zero-Click Silent Mode</div>
          <div>TIME: ${new Date().toLocaleTimeString()}</div>
          <div class="line"></div>
          <div class="c b">*** PRINTER READY FOR BILLING ***</div>
        </body>
        </html>
      `;
      const res = await window.electronAPI.printSilent({
        html: testHtml,
        is80mm: true,
        deviceName: selectedNativePrinter || undefined,
        printerName: selectedNativePrinter || undefined
      });
      if (res.success) {
        onToast('success', 'Silent Test Printed!', `Sent to ${selectedNativePrinter || 'Default Printer'}`);
      } else {
        onToast('error', 'Silent Print Failed', res.error || 'Unknown error');
      }
    } catch (e: any) {
      onToast('error', 'Print Error', e.message);
    } finally {
      setIsTestingNativePrint(false);
    }
  };

  const handlePairUsb = async () => {
    setIsPairingUsb(true);
    const res = await pairUsbPrinter();
    setIsPairingUsb(false);
    setUsbStatus(getUsbPrinterStatus());
    if (res.success) {
      onToast('success', 'USB Printer Paired!', `Connected to ${res.deviceName || 'Thermal Printer'}`);
    } else {
      onToast('error', 'Pairing Failed', res.error);
    }
  };

  const handleTestUsbPrint = async () => {
    setIsTestingUsb(true);
    const res = await testUsbPrinter(shopProfile.shopName);
    setIsTestingUsb(false);
    if (res.success) {
      onToast('success', 'Test Receipt Printed!', 'Hardware communication verified.');
    } else {
      onToast('error', 'Print Failed', res.error);
    }
  };

  const handleTestCut = async () => {
    const res = await testUsbCut();
    if (res.success) {
      onToast('success', 'Auto-Cut Triggered', 'Cutter command sent to printer.');
    } else {
      onToast('error', 'Cut Failed', res.error);
    }
  };

  const handleTestCashDrawer = async () => {
    const res = await testUsbCashDrawer();
    if (res.success) {
      onToast('success', 'Cash Drawer Pulse Sent', 'Pulse command sent to drawer pin.');
    } else {
      onToast('error', 'Drawer Pulse Failed', res.error);
    }
  };

  const handlePairBluetooth = async () => {
    if (!isBluetoothSupported()) {
      onToast('error', 'Bluetooth Unavailable', 'Web Bluetooth requires Chrome on Android or a supported browser over HTTPS.');
      return;
    }
    setIsPairingBluetooth(true);
    const res = await connectBluetoothPrinter();
    setIsPairingBluetooth(false);
    setBluetoothConnected(isBluetoothPrinterConnected());
    setBluetoothDeviceName(getConnectedBluetoothName());
    if (res.success) {
      onToast('success', 'Bluetooth Printer Paired!', `Connected to ${res.deviceName || 'Wireless Printer'}`);
    } else {
      onToast('error', 'Bluetooth Pairing Failed', res.error);
    }
  };

  const handleDisconnectBluetooth = async () => {
    await disconnectBluetoothPrinter();
    setBluetoothConnected(false);
    setBluetoothDeviceName(null);
    onToast('info', 'Bluetooth Disconnected', 'Printer connection released.');
  };

  const handleTestBluetoothPrint = async () => {
    setIsTestingBluetooth(true);
    const res = await printTestBluetooth(shopProfile.shopName || 'WEBRAJYA POS');
    setIsTestingBluetooth(false);
    if (res.success) {
      onToast('success', 'Bluetooth Test Printed!', 'Wirelessly transmitted ESC/POS receipt.');
    } else {
      onToast('error', 'Bluetooth Print Failed', res.error);
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDirty) {
      setProfileForm(shopProfile);
    }
    setPrintForm(printSettings);
    setSupaForm(supabaseConfig);
  }, [shopProfile, printSettings, supabaseConfig, isDirty]);

  const handleProfileChange = (field: keyof typeof profileForm, value: string) => {
    const next = { ...profileForm, [field]: value };
    setProfileForm(next);
    setIsDirty(true);
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      await saveShopProfile(next);
      setIsDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 350);
  };

  const handleProfileBlur = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    await saveShopProfile(profileForm);
    setIsDirty(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleSaveShopProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const result = ShopProfileSchema.safeParse(profileForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setProfileErrors(errors);
      const firstError = result.error.issues[0]?.message || 'Please check required fields';
      onToast('error', 'Validation Notice', firstError);
      return;
    }
    setProfileErrors({});
    setSaveStatus('saving');
    await saveShopProfile(profileForm);
    setIsDirty(false);
    setSaveStatus('saved');
    onToast('success', 'Shop Profile Saved', 'Updated invoice header and shop details');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleSavePrintSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePrintSettings(printForm);
    const sizeName = printForm.paperSize === '80mm' || printForm.paperSize === 'Thermal'
      ? '80mm Receipt Roll'
      : printForm.paperSize === 'A4'
      ? 'A4 Full Page'
      : 'A5 Standard';
    const engineName = printForm.printEngine === 'usb' ? 'Direct USB' : printForm.printEngine === 'bluetooth' ? 'Wireless Bluetooth' : printForm.printEngine === 'browser' ? 'Browser Kiosk' : 'Auto Dual-Mode';
    onToast('success', 'Print Settings Saved', `Paper: ${sizeName} | Mode: ${engineName}`);
  };

  const handleSelectPaperSize = async (size: PaperSize) => {
    const updated = { ...printForm, paperSize: size };
    setPrintForm(updated);
    await savePrintSettings(updated);
    const sizeName = size === '80mm' ? '80mm Receipt Roll' : size === 'A4' ? 'A4 Full Sheet' : 'A5 Half-Sheet';
    onToast('success', 'Paper Format Updated', `Default set to: ${sizeName}`);
  };

  const handleSelectPrintEngine = async (engine: PrintEngine) => {
    const updated = { ...printForm, printEngine: engine };
    setPrintForm(updated);
    await savePrintSettings(updated);
    const engineName = engine === 'usb' ? 'Direct USB Cable' : engine === 'bluetooth' ? 'Wireless Bluetooth' : engine === 'browser' ? 'Browser Kiosk' : 'Auto Dual-Mode';
    onToast('success', 'Print Engine Updated', `Mode set to: ${engineName}`);
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSupabaseConfig(supaForm);
    onToast('success', 'Supabase Config Saved', 'Supabase endpoint updated');
  };

  const handleTestConnection = async () => {
    const res = await testConnection(supaForm.url, supaForm.anonKey);
    if (res.success) {
      onToast('success', 'Connection Successful', res.message);
    } else {
      onToast('error', 'Connection Failed', res.message);
    }
  };

  const handleSyncToCloud = async () => {
    onToast('info', 'Sync Started', 'Pushing local products and invoices to Supabase...');
    const prodRes = await syncProducts(true);
    const invRes = await syncInvoices(true);
    
    if (prodRes.success && invRes.success) {
      onToast('success', 'Sync Complete!', `${prodRes.message} | ${invRes.message}`);
    } else {
      onToast('error', 'Sync Partial Error', `${prodRes.message || ''} ${invRes.message || ''}`);
    }
  };

  const handleDownloadBackup = async () => {
    const jsonStr = await exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WebRajya_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const nowIso = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.setItem('webrajya_last_backup_date', nowIso);
      setLastBackupTime(nowIso);
    }
    onToast('success', 'Backup Exported', 'Downloaded full JSON database backup file.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importBackupJSON(content);
      if (res.success) {
        onToast('success', 'Database Restored!', res.message);
      } else {
        onToast('error', 'Import Failed', res.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearDemoData = async () => {
    if (confirm('Are you sure you want to delete all demo data and reset local cache? This will clear all local demo products, invoices, and customers, and resync cleanly with Supabase.')) {
      await clearAllDemoData();
      await loadProducts(true);
      await loadInvoices();
      await useCustomerStore.getState().loadCustomers(true);
      onToast('success', 'Demo Data Cleared & Cloud Resynced', 'Clean state synchronized with Supabase.');
    }
  };

  const renderOfficialAppsBanner = () => (
    isInsideElectron ? (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-blue-900/40">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white p-1 shrink-0 overflow-hidden shadow-xs">
            <img src="/logo.png" alt="WebRajya Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 px-2 py-0.5 rounded text-white flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                Windows Desktop App Active
              </span>
              <span className="text-xs font-black text-white">WebRajya Native Edition</span>
            </div>
            <p className="text-[11px] text-blue-100/80 mt-0.5">
              Running with native Windows print spooler access & 0-click silent printing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/brochure.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open Printable A4 Product Brochure"
          >
            <FileText className="w-3.5 h-3.5 text-blue-200" />
            <span>Sales Brochure</span>
          </a>
          <span className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-blue-200 border border-white/15">
            Desktop Client v1.0.0
          </span>
        </div>
      </div>
    ) : (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#123B70] to-[#1E3A8A] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-blue-900/40">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white p-1 shrink-0 overflow-hidden shadow-xs">
            <img src="/logo.png" alt="WebRajya Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-[#2563EB] px-2 py-0.5 rounded text-white">
                Official Apps
              </span>
              <span className="text-xs font-black text-white">Get WebRajya for Windows & Mobile</span>
            </div>
            <p className="text-[11px] text-blue-100/80 mt-0.5">
              Download Windows .exe for 0-click silent printing, or install Chrome PWA on mobile/tablet.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          <a
            href="/brochure.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-white/20 transition-all cursor-pointer"
            title="Open Printable A4 Product Brochure"
          >
            <FileText className="w-4 h-4 text-blue-200" />
            <span>Sales Brochure</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setInstallModalTab(typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent) ? 'windows' : 'pwa');
              setIsInstallModalOpen(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>{isInstalled || isStandalone ? 'App Ready • Open Info' : 'Download / Install App'}</span>
          </button>
        </div>
      </div>
    )
  );

  const handleHardwareScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!scanStartTimeRef.current) {
      scanStartTimeRef.current = Date.now();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = hardwareScanInput.trim().replace(/[\s\r\n\t>]+/g, '');
      if (!code) return;
      const speed = scanStartTimeRef.current ? Math.max(1, Date.now() - scanStartTimeRef.current) : 10;
      scanStartTimeRef.current = null;

      // Find matching product in catalog
      const clean = code.toLowerCase();
      const match = products.find(p => {
        const b = (p.barcode || '').trim().toLowerCase();
        const s = (p.sku || '').trim().toLowerCase();
        const alt = (p.alternateBarcodes || []).map(x => x.trim().toLowerCase());
        return b === clean || s === clean || alt.includes(clean);
      });

      if (match) {
        playBeep();
        onToast('success', 'Hardware Scanner Test: Product Matched!', `Found "${match.name}" (${match.sku})`);
      } else {
        playBeep();
        onToast('info', 'Hardware Scanner Test: Code Captured', `Scanned ${code} (${code.length} digits) - No product matched yet.`);
      }

      setLastHardwareScan({
        code,
        length: code.length,
        speedMs: speed,
        matchedProduct: match,
        timestamp: new Date().toLocaleTimeString()
      });
      setHardwareScanInput('');
    }
  };

  const settingCategories = [
    {
      id: 'shop' as const,
      title: 'Shop Profile & Header',
      subtitle: 'Store name, address, GSTIN, phone, bank details & invoice tagline',
      icon: <Store className="w-5 h-5 text-[#2563EB]" />,
      iconBg: 'bg-blue-50 text-[#2563EB] border-blue-200',
      meta: shopProfile.shopName || 'Configured'
    },
    {
      id: 'billing' as const,
      title: 'Invoice & Tax Modes',
      subtitle: 'Counter document modes (GST/Simple), statutory modes & WhatsApp receipt format',
      icon: <Receipt className="w-5 h-5 text-[#16A34A]" />,
      iconBg: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
      meta: billingForm.defaultInvoiceType === 'gst' ? 'GST Mode' : 'Simple Mode'
    },
    {
      id: 'print' as const,
      title: 'Print & Paper Settings',
      subtitle: 'Paper size (A5 / 80mm / 58mm), Windows silent printing, auto-cut & cash drawer',
      icon: <Printer className="w-5 h-5 text-[#D97706]" />,
      iconBg: 'bg-amber-50 text-[#D97706] border-amber-200',
      meta: printSettings?.paperSize || 'A5'
    },
    {
      id: 'hardware' as const,
      title: 'Machines & Hardware Integration',
      subtitle: 'USB/Bluetooth Barcode Scanners, Thermal Receipt Printers & Barcode Label Printers',
      icon: <ScanBarcode className="w-5 h-5 text-[#0284C7]" />,
      iconBg: 'bg-cyan-50 text-[#0284C7] border-cyan-200',
      meta: 'Scanner & Printer'
    },
    {
      id: 'backup' as const,
      title: 'Data Backup & Restore',
      subtitle: 'Export JSON v2.0 database backup, restore records & Supabase cloud sync',
      icon: <Download className="w-5 h-5 text-[#7C3AED]" />,
      iconBg: 'bg-purple-50 text-[#7C3AED] border-purple-200',
      meta: 'Backup v2.0'
    },
    {
      id: 'sound' as const,
      title: 'Sound & Audio Effects',
      subtitle: 'Barcode scanner beep, cash register chime & sound feedback toggles',
      icon: soundOn ? <Volume2 className="w-5 h-5 text-[#4F46E5]" /> : <VolumeX className="w-5 h-5 text-[#94A3B8]" />,
      iconBg: soundOn ? 'bg-indigo-50 text-[#4F46E5] border-indigo-200' : 'bg-slate-100 text-[#94A3B8] border-slate-200',
      meta: soundOn ? 'Sound ON' : 'Muted'
    },
    {
      id: 'ai' as const,
      title: 'AI & Gemini Configuration',
      subtitle: 'Google Gemini 2.0 Flash API key for WebRajya AI Chatbot & Bill Scanner',
      icon: <Sparkles className="w-5 h-5 text-[#8B5CF6]" />,
      iconBg: 'bg-purple-50 text-[#8B5CF6] border-purple-200',
      meta: geminiApiKey ? 'Configured' : 'Key Needed'
    },
    {
      id: 'shortcuts' as const,
      title: 'POS Shortcuts & Hotkeys',
      subtitle: 'Complete cashier keyboard shortcuts (F2 to F11), barcode gun flow & instant billing',
      icon: <Keyboard className="w-5 h-5 text-[#2563EB]" />,
      iconBg: 'bg-blue-50 text-[#2563EB] border-blue-200',
      meta: 'F2 – F11'
    }
  ];

  return (
    <div className="max-w-4xl md:max-w-6xl lg:max-w-7xl mx-auto space-y-4 font-sans text-[#172B4D] pb-24 md:pb-6">
      {/* CASE 1: Main Settings Hub Menu (activeTab === null) */}
      {activeTab === null && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header Card */}
          <div className="bg-white border border-[#D8E1EC] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563EB]/10 to-[#1E3A8A]/15 border border-[#2563EB]/25 flex items-center justify-center text-[#2563EB] shadow-2xs shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#172B4D] tracking-tight">
                    Settings & Configuration
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                    Select a category below to configure store details, billing rules, hardware, and data
                  </p>
                </div>
              </div>

              {/* Desktop Quick Status Bar (hidden on mobile) */}
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[#64748B] font-medium">Billing:</span>
                  <span className="font-bold text-[#172B4D]">{billingForm.defaultInvoiceType === 'gst' ? 'GST Mode' : 'Simple'}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 text-xs">
                  <Printer className="w-3.5 h-3.5 text-[#64748B]" />
                  <span className="text-[#64748B] font-medium">Printer:</span>
                  <span className="font-bold text-[#172B4D]">{printSettings?.paperSize || 'A5'}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 text-xs">
                  {soundOn ? <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-[#64748B] font-medium">Audio:</span>
                  <span className="font-bold text-[#172B4D]">{soundOn ? 'On' : 'Muted'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MOBILE 1-COLUMN LIST (Original UX: untouched for mobile screens)         */}
          {/* ========================================================================= */}
          <div className="space-y-2.5 md:hidden">
            {settingCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try { navigator.vibrate(15); } catch (_) {}
                  }
                  setActiveTab(cat.id);
                }}
                className="p-4 bg-white hover:bg-[#F8FAFC] border border-[#D8E1EC] hover:border-[#2563EB]/40 rounded-2xl cursor-pointer transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${cat.iconBg} group-hover:scale-105 transition-transform`}>
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-[#172B4D] group-hover:text-[#2563EB] transition-colors truncate">
                        {cat.title}
                      </h3>
                      {cat.meta && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] shrink-0 hidden sm:inline-block">
                          {cat.meta}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed line-clamp-1">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>

          {/* ========================================================================= */}
          {/* DESKTOP 3-COLUMN DASHBOARD GRID (Clean, spacious, computer-friendly)      */}
          {/* ========================================================================= */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {settingCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try { navigator.vibrate(15); } catch (_) {}
                  }
                  setActiveTab(cat.id);
                }}
                className="p-5 bg-white hover:bg-[#F8FAFC] border border-[#D8E1EC] hover:border-[#2563EB]/40 rounded-2xl cursor-pointer transition-all shadow-xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${cat.iconBg} group-hover:scale-105 transition-transform`}>
                      {cat.icon}
                    </div>
                    {cat.meta && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] shrink-0 group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB] group-hover:border-[#BFDBFE] transition-colors">
                        {cat.meta}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-[#172B4D] group-hover:text-[#2563EB] transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                    {cat.subtitle}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs font-bold text-[#2563EB]">
                  <span className="group-hover:underline">Configure Settings</span>
                  <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] group-hover:bg-[#2563EB] text-[#2563EB] group-hover:text-white flex items-center justify-center transition-all group-hover:translate-x-0.5">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Official Apps Card at bottom of Hub */}
          <div className="pt-1">
            {renderOfficialAppsBanner()}
          </div>
        </div>
      )}

      {/* CASE 2: Active Sub-Setting Detail (activeTab !== null) */}
      {activeTab !== null && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Top Sticky Navigation Bar with Back Button */}
          <div className="flex items-center justify-between bg-white border border-[#D8E1EC] rounded-2xl px-4 py-3 shadow-xs sticky top-0 z-20">
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  try { navigator.vibrate(15); } catch (_) {}
                }
                setActiveTab(null);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Settings</span>
            </button>

            {/* Desktop-only Quick Category Switcher (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
              {settingCategories.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveTab(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#2563EB] shadow-xs border border-[#CBD5E1]'
                        : 'text-[#64748B] hover:text-[#172B4D] hover:bg-white/60'
                    }`}
                  >
                    <span className="scale-90">{cat.icon}</span>
                    <span>{cat.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
                {activeTab === 'shop' && <><Store className="w-4 h-4 text-[#2563EB]" /> Shop Profile</>}
                {activeTab === 'billing' && <><Receipt className="w-4 h-4 text-[#16A34A]" /> Invoice & Tax Modes</>}
                {activeTab === 'print' && <><Printer className="w-4 h-4 text-[#D97706]" /> Print & Paper</>}
                {activeTab === 'hardware' && <><ScanBarcode className="w-4 h-4 text-[#0284C7]" /> Machines & Hardware</>}
                {activeTab === 'backup' && <><Download className="w-4 h-4 text-[#7C3AED]" /> Backup & Restore</>}
                {activeTab === 'sound' && <><Volume2 className="w-4 h-4 text-[#4F46E5]" /> Sound & Audio</>}
                {activeTab === 'ai' && <><Sparkles className="w-4 h-4 text-[#8B5CF6]" /> AI & Gemini Configuration</>}
                {activeTab === 'shortcuts' && <><Keyboard className="w-4 h-4 text-[#2563EB]" /> POS Shortcuts & Hotkeys</>}
              </span>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-white border border-[#D8E1EC] rounded-2xl p-4 sm:p-6 text-xs shadow-xs">
        {activeTab === 'shop' && (
          <form onSubmit={handleSaveShopProfile} className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider">
                  Retail Shop Details & Invoice Header
                </h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Fields marked with <strong className="text-red-600 font-extrabold">* (Compulsory)</strong> in red must be filled. All others are optional.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                    Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full transition-all">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    Auto-saved
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Shop Name <span className="text-red-600 font-black text-sm">*</span> <span className="text-red-600 text-[10px] font-extrabold uppercase tracking-wider">(Compulsory)</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.shopName}
                  onChange={(e) => handleProfileChange('shopName', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. WebRajya Retail Store"
                  className={`w-full px-3 py-2 bg-white rounded-lg text-[#172B4D] focus:outline-none font-bold text-sm border transition-colors ${
                    !profileForm.shopName.trim()
                      ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-400 bg-red-50/15'
                      : 'border-[#D8E1EC] focus:border-[#2563EB]'
                  }`}
                />
                {profileErrors.shopName && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.shopName}</p>}
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Tagline / Subheading <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.tagline}
                  onChange={(e) => handleProfileChange('tagline', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. Mens Clothing & Retail Store"
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Address <span className="text-red-600 font-black text-sm">*</span> <span className="text-red-600 text-[10px] font-extrabold uppercase tracking-wider">(Compulsory)</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={profileForm.address}
                  onChange={(e) => handleProfileChange('address', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="Shop No., Market / Street, City, State - PIN"
                  className={`w-full px-3 py-2 bg-white rounded-lg text-[#172B4D] focus:outline-none border transition-colors ${
                    !profileForm.address.trim()
                      ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-400 bg-red-50/15'
                      : 'border-[#D8E1EC] focus:border-[#2563EB]'
                  }`}
                />
                {profileErrors.address && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.address}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Phone Number <span className="text-red-600 font-black text-sm">*</span> <span className="text-red-600 text-[10px] font-extrabold uppercase tracking-wider">(Compulsory)</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. 9425174721 or +91 94251 74721"
                  className={`w-full px-3 py-2 bg-white rounded-lg text-[#172B4D] focus:outline-none font-mono border transition-colors ${
                    !profileForm.phone.trim()
                      ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-400 bg-red-50/15'
                      : 'border-[#D8E1EC] focus:border-[#2563EB]'
                  }`}
                />
                {profileErrors.phone && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  GSTIN (15 Digits) <span className="text-[#64748B] text-[11px] font-normal">(Optional for Non-GST)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.gstin}
                  onChange={(e) => handleProfileChange('gstin', e.target.value.toUpperCase())}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. 23AAAAA0000A1Z5 (Leave blank if non-GST)"
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB] uppercase font-bold text-[#B45309] font-mono"
                />
                {profileErrors.gstin && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.gstin}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  State / Union Territory <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.state || ''}
                  onChange={(e) => handleProfileChange('state', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. Madhya Pradesh (23)"
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
                />
                {profileErrors.state && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.state}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Pincode <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.pincode || ''}
                  onChange={(e) => handleProfileChange('pincode', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. 480661"
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB] font-mono"
                />
                {profileErrors.pincode && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.pincode}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Invoice Number Prefix <span className="text-red-600 font-black text-sm">*</span> <span className="text-red-600 text-[10px] font-extrabold uppercase tracking-wider">(Compulsory)</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.invoicePrefix}
                  onChange={(e) => handleProfileChange('invoicePrefix', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. CTC- or INV-"
                  className={`w-full px-3 py-2 bg-white rounded-lg text-[#172B4D] focus:outline-none font-mono border transition-colors ${
                    !profileForm.invoicePrefix.trim()
                      ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-400 bg-red-50/15'
                      : 'border-[#D8E1EC] focus:border-[#2563EB]'
                  }`}
                />
                {profileErrors.invoicePrefix && <p className="text-[#B91C1C] text-[11px] font-mono mt-0.5 font-bold">{profileErrors.invoicePrefix}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  UPI Payment ID (for Invoice QR) <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.upiId}
                  onChange={(e) => handleProfileChange('upiId', e.target.value)}
                  onBlur={handleProfileBlur}
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB] font-mono"
                  placeholder="e.g. yourshop@upi or 9876543210@paytm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Bank Name <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.bankName}
                  onChange={(e) => handleProfileChange('bankName', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. State Bank of India"
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Bank Account Number <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.accountNo}
                  onChange={(e) => handleProfileChange('accountNo', e.target.value)}
                  onBlur={handleProfileBlur}
                  placeholder="e.g. 34567890123"
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  IFSC Code <span className="text-[#64748B] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={profileForm.ifscCode || ''}
                  onChange={(e) => handleProfileChange('ifscCode', e.target.value.toUpperCase())}
                  onBlur={handleProfileBlur}
                  className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-[#172B4D] focus:outline-none focus:border-[#2563EB] font-mono uppercase"
                  placeholder="e.g. SBIN0001234"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#D8E1EC] flex items-center justify-between">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Shop Profile
              </button>
              <span className="text-[11px] text-[#64748B]">
                Changes auto-save automatically as you type
              </span>
            </div>
          </form>
        )}

        {activeTab === 'billing' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider">
                  Default Counter Document Mode
                </h3>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> Auto-saved
                </span>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Choose the primary document mode pre-selected every time you open the billing counter.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* GST Tax Invoice Card */}
                <div
                  onClick={() => handleToggleBillingSetting('defaultInvoiceType', 'gst')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    billingForm.defaultInvoiceType === 'gst'
                      ? 'border-[#15803D] bg-[#F0FDF4] shadow-xs ring-2 ring-[#15803D]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className={`w-5 h-5 ${billingForm.defaultInvoiceType === 'gst' ? 'text-[#15803D]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-sm text-[#0F172A]">GST Tax Invoice (Rule 46)</span>
                      </div>
                      {billingForm.defaultInvoiceType === 'gst' && (
                        <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                      )}
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Official tax bill with CGST + SGST or IGST tax calculations, HSN summaries, and GSTR-1 compliance.
                    </p>
                  </div>
                </div>

                {/* Simple Retail Cash Memo Card */}
                <div
                  onClick={() => handleToggleBillingSetting('defaultInvoiceType', 'simple')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    billingForm.defaultInvoiceType === 'simple'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className={`w-5 h-5 ${billingForm.defaultInvoiceType === 'simple' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-sm text-[#0F172A]">Simple Retail Cash Memo</span>
                      </div>
                      {billingForm.defaultInvoiceType === 'simple' && (
                        <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                      )}
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Clean and fast retail cash memo without GST percentages or HSN clutter. Ideal for fast counter walk-ins.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fast Billing Workflow & Optional Fields Switch */}
            <div>
              <div className="border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#2563EB]" />
                  Fast Billing & Product Entry Workflow
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Configure whether scanning or selecting a product adds it instantly or navigates through quantity, rates, and remarks.
              </p>

              <div className="p-4 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between shadow-2xs hover:border-[#94A3B8] transition-all">
                <div className="pr-4 space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-extrabold text-[#172B4D]">
                      Qty, Free, Rate, and Remark Are Purely Optional:
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      billingForm.quickSearchAdd !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {billingForm.quickSearchAdd !== false ? 'Enabled (Fast Add)' : 'Disabled (Step-by-Step)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {billingForm.quickSearchAdd !== false
                      ? 'When enabled, scanning or selecting an item instantly adds it to the bill with Qty 1 and refocuses search. Quantity, Free, Rate, and Remark are purely optional.'
                      : 'When disabled, selecting an item populates the input bar and lets you navigate sequentially through Qty → Rate → Remark with the Enter key before adding.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={billingForm.quickSearchAdd !== false}
                    onChange={(e) => handleToggleBillingSetting('quickSearchAdd', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
                </label>
              </div>
            </div>

            {/* Counter Document Display Settings */}
            <div>
              <div className="border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider">
                  Counter Toolbar Display & Specialized Modes
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Keep the counter clean with only <b>GST</b> and <b>Simple</b>, or enable specialized statutory documents as needed.
              </p>

              <div className="space-y-3">
                {/* Master Switch: Show Advanced Document Types */}
                <div className="p-3.5 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-xs font-bold text-[#172B4D]">
                      Show Advanced Document Types at Counter
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      When disabled, the counter bar cleanly shows only <b>GST</b> and <b>Simple</b> buttons.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingForm.showAdvancedModes}
                      onChange={(e) => handleToggleBillingSetting('showAdvancedModes', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563EB]"></div>
                  </label>
                </div>

                {/* Sub-options when enabled */}
                {billingForm.showAdvancedModes && (
                  <div className="ml-4 pl-4 border-l-2 border-[#BFDBFE] space-y-2.5">
                    {/* B.O.S */}
                    <div className="p-3 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#172B4D]">
                          Bill of Supply (B.O.S - CGST Rule 49)
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          For GST Composition Scheme dealers and 100% tax-exempt supplies.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={billingForm.enableBos}
                          onChange={(e) => handleToggleBillingSetting('enableBos', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0284C7]"></div>
                      </label>
                    </div>

                    {/* Delivery Challan */}
                    <div className="p-3 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#172B4D]">
                          Delivery Challan (CGST Rule 55)
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          For Goods on Approval, Godown/Branch Transfers, or Job Work without sale.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={billingForm.enableChallan}
                          onChange={(e) => handleToggleBillingSetting('enableChallan', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]"></div>
                      </label>
                    </div>

                    {/* Quotation / Estimate */}
                    <div className="p-3 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#172B4D]">
                          Quotation / Price Estimate
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          Formal cost quotation without deducting inventory or recording sales revenue.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={billingForm.enableEstimate}
                          onChange={(e) => handleToggleBillingSetting('enableEstimate', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D97706]"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Interstate IGST Toggle */}
                <div className="p-3.5 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-xs font-bold text-[#172B4D]">
                      Allow Interstate IGST Billing Checkbox
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      Shows the "IGST" checkbox on the counter for out-of-state customer sales.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingForm.enableIgst}
                      onChange={(e) => handleToggleBillingSetting('enableIgst', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563EB]"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* WhatsApp & Digital Bill Dispatch Settings */}
            <div>
              <div className="border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#16A34A]" />
                  WhatsApp & Digital Bill Dispatch
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Select what format is dispatched when clicking the WhatsApp button at the counter or in mobile checkout.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Text Message */}
                <div
                  onClick={() => handleToggleBillingSetting('whatsappFormat', 'text')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    (billingForm.whatsappFormat || 'text') === 'text'
                      ? 'border-[#16A34A] bg-[#F0FDF4] shadow-xs ring-2 ring-[#16A34A]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <MessageCircle className={`w-4 h-4 ${(billingForm.whatsappFormat || 'text') === 'text' ? 'text-[#16A34A]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">Text Message</span>
                      </div>
                      {(billingForm.whatsappFormat || 'text') === 'text' && (
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Instant itemized bill text summary prefilled in customer chat. Zero data download required for customer.
                    </p>
                  </div>
                </div>

                {/* 2. PDF Document */}
                <div
                  onClick={() => handleToggleBillingSetting('whatsappFormat', 'pdf')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    billingForm.whatsappFormat === 'pdf'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <FileText className={`w-4 h-4 ${billingForm.whatsappFormat === 'pdf' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">PDF Invoice</span>
                      </div>
                      {billingForm.whatsappFormat === 'pdf' && (
                        <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Generates a formal GST Tax Invoice or Thermal Receipt PDF attached directly via Web Share API or download.
                    </p>
                  </div>
                </div>

                {/* 3. Receipt Image */}
                <div
                  onClick={() => handleToggleBillingSetting('whatsappFormat', 'image')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    billingForm.whatsappFormat === 'image'
                      ? 'border-[#7C3AED] bg-[#F5F3FF] shadow-xs ring-2 ring-[#7C3AED]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <ImageIcon className={`w-4 h-4 ${billingForm.whatsappFormat === 'image' ? 'text-[#7C3AED]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">Receipt Image</span>
                      </div>
                      {billingForm.whatsappFormat === 'image' && (
                        <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Crisp 2x retina PNG snapshot. Fast to share on mobile or paste (Ctrl+V) directly into WhatsApp Web.
                    </p>
                  </div>
                </div>
              </div>

              {/* PDF / Image Style Selector (A5 vs 80mm) */}
              {(billingForm.whatsappFormat === 'pdf' || billingForm.whatsappFormat === 'image') && (
                <div className="mt-3 p-3.5 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-xs font-bold text-[#172B4D]">
                      {billingForm.whatsappFormat === 'pdf' ? 'PDF Document Layout Style' : 'Image Receipt Layout Style'}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      Choose whether {billingForm.whatsappFormat === 'pdf' ? 'PDFs' : 'Images'} use the formal full A5 layout or 80mm thermal roll format.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleToggleBillingSetting('whatsappPdfStyle', 'a5')}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        (billingForm.whatsappPdfStyle || 'a5') === 'a5'
                          ? 'bg-white text-[#2563EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#172B4D]'
                      }`}
                    >
                      A5 Official
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBillingSetting('whatsappPdfStyle', 'thermal_80mm')}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        billingForm.whatsappPdfStyle === 'thermal_80mm'
                          ? 'bg-white text-[#2563EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#172B4D]'
                      }`}
                    >
                      80mm Thermal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'print' && (
          <form onSubmit={handleSavePrintSettings} className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider border-b border-[#D8E1EC] pb-2 mb-3">
                Default Invoice Paper Size & Format
              </h3>
              <p className="text-xs text-[#64748B] mb-4">
                Select the default paper format used for all invoice prints, billing shortcuts [F9], and receipts.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 80mm Receipt Roll */}
                <div
                  onClick={() => handleSelectPaperSize('80mm')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    printForm.paperSize === '80mm' || printForm.paperSize === 'Thermal'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className={`w-5 h-5 ${printForm.paperSize === '80mm' || printForm.paperSize === 'Thermal' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-sm text-[#0F172A]">80mm Receipt Roll</span>
                      </div>
                      {(printForm.paperSize === '80mm' || printForm.paperSize === 'Thermal') && (
                        <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-[#DBEAFE] text-[#1E40AF] rounded mb-2">
                      Thermal / Plain Receipt
                    </span>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Compact 80mm (3-inch) roll paper format. Ideal for high-speed retail billing, thermal receipt printers, and plain counter slips.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-[#D8E1EC]/60 text-[10px] font-mono font-bold text-[#64748B]">
                    Width: 80mm (Continuous)
                  </div>
                </div>

                {/* A5 Landscape / Half-Letter */}
                <div
                  onClick={() => handleSelectPaperSize('A5')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    printForm.paperSize === 'A5'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className={`w-5 h-5 ${printForm.paperSize === 'A5' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-sm text-[#0F172A]">A5 Half-Sheet</span>
                      </div>
                      {printForm.paperSize === 'A5' && (
                        <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-[#E0E7FF] text-[#3730A3] rounded mb-2">
                      Standard Retail
                    </span>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Standard wholesale A5 retail format. Includes full item breakdown, HSN codes, Scheme discounts, and bank details.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-[#D8E1EC]/60 text-[10px] font-mono font-bold text-[#64748B]">
                    Dimensions: 148 × 210 mm
                  </div>
                </div>

                {/* A4 Full Sheet */}
                <div
                  onClick={() => handleSelectPaperSize('A4')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    printForm.paperSize === 'A4'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Printer className={`w-5 h-5 ${printForm.paperSize === 'A4' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-sm text-[#0F172A]">A4 Full Sheet</span>
                      </div>
                      {printForm.paperSize === 'A4' && (
                        <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-[#F1F5F9] text-[#475569] rounded mb-2">
                      Accounting / Filing
                    </span>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Full-page standard office sheet. Spacious layout for large invoices with 30+ items, GST summary slabs, and formal tax audit records.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-[#D8E1EC]/60 text-[10px] font-mono font-bold text-[#64748B]">
                    Dimensions: 210 × 297 mm
                  </div>
                </div>
              </div>
            </div>

            {/* Silent Print Engine Selection */}
            <div>
              <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider border-b border-[#D8E1EC] pb-2 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#2563EB]" />
                Silent Printing Engine & Hardware Mode
              </h3>
              <p className="text-xs text-[#64748B] mb-3">
                Choose how WebRajya communicates with your receipt printer to bypass the Chrome print dialog.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Auto Dual-Mode */}
                <div
                  onClick={() => handleSelectPrintEngine('auto')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    (printForm.printEngine || 'auto') === 'auto'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Zap className={`w-4 h-4 ${(printForm.printEngine || 'auto') === 'auto' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">Auto Dual-Mode</span>
                      </div>
                      {(printForm.printEngine || 'auto') === 'auto' && (
                        <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase bg-[#DCFCE7] text-[#15803D] rounded mb-1.5">
                      Recommended
                    </span>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Automatically prints 100% silently via USB or Bluetooth if connected; gracefully falls back to browser/kiosk print.
                    </p>
                  </div>
                </div>

                {/* Direct USB WebUSB */}
                <div
                  onClick={() => handleSelectPrintEngine('usb')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    printForm.printEngine === 'usb'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Usb className={`w-4 h-4 ${printForm.printEngine === 'usb' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">Direct USB Cable</span>
                      </div>
                      {printForm.printEngine === 'usb' && (
                        <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase bg-[#DBEAFE] text-[#1E40AF] rounded mb-1.5">
                      Zero Print Dialog
                    </span>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Sends raw ESC/POS binary bytes straight over the USB wire. Triggers instant printing, auto-cutter, and cash drawer kick.
                    </p>
                  </div>
                </div>

                {/* Wireless Bluetooth */}
                <div
                  onClick={() => handleSelectPrintEngine('bluetooth')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    printForm.printEngine === 'bluetooth'
                      ? 'border-[#7C3AED] bg-[#FAF5FF] shadow-xs ring-2 ring-[#7C3AED]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Bluetooth className={`w-4 h-4 ${printForm.printEngine === 'bluetooth' ? 'text-[#7C3AED]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">Wireless Bluetooth</span>
                      </div>
                      {printForm.printEngine === 'bluetooth' && (
                        <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" />
                      )}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase bg-[#EDE9FE] text-[#6D28D9] rounded mb-1.5">
                      Mobile & Tablet
                    </span>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Connects wirelessly over Web Bluetooth to portable 58mm or 80mm ESC/POS printers. Perfect for phone billing counters.
                    </p>
                  </div>
                </div>

                {/* Browser Kiosk Mode */}
                <div
                  onClick={() => handleSelectPrintEngine('browser')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    printForm.printEngine === 'browser'
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-xs ring-2 ring-[#2563EB]/20'
                      : 'border-[#D8E1EC] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Printer className={`w-4 h-4 ${printForm.printEngine === 'browser' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="font-extrabold text-xs text-[#0F172A]">Browser / Kiosk</span>
                      </div>
                      {printForm.printEngine === 'browser' && (
                        <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                      )}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase bg-[#F1F5F9] text-[#475569] rounded mb-1.5">
                      Standard Spooler
                    </span>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Uses the operating system's standard print driver. Silent when Chrome is launched with the <code className="text-[#2563EB] font-bold">--kiosk-printing</code> flag.
                    </p>
                  </div>
                </div>
              </div>

              {/* Windows Native Silent Spooler Card (when running inside Desktop App) */}
              {isInsideElectron && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl space-y-3.5 mb-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-200/60">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-[#0F172A]">
                            Windows Native Silent Printer
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-[#15803D]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            0-Click Spooler Active
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          Direct hardware spooler integration. Bypasses all browser dialogs completely.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestNativePrint}
                      disabled={isTestingNativePrint}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isTestingNativePrint ? 'Testing...' : 'Test Windows Silent Print'}</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                    <label className="text-xs font-bold text-[#172B4D] shrink-0">Target Windows Printer:</label>
                    <select
                      value={selectedNativePrinter}
                      onChange={(e) => handleSelectNativePrinter(e.target.value)}
                      className="w-full sm:w-80 px-3 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="">System Default Printer (Automatic)</option>
                      {nativePrinters.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName || p.name} {p.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-[#64748B]">
                      {nativePrinters.length > 0 ? `${nativePrinters.length} printer(s) detected` : 'Detecting printers...'}
                    </span>
                  </div>
                </div>
              )}

              {/* USB Thermal Printer Hardware Pairing Box */}
              <div className="p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${usbStatus.isConnected ? 'bg-emerald-100 text-[#15803D]' : 'bg-slate-200 text-slate-600'}`}>
                      <Usb className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[#0F172A]">
                          USB Thermal Receipt Printer
                        </span>
                        {usbStatus.isConnected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-[#15803D]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Connected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            Not Paired / Unplugged
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {usbStatus.deviceName ? `Active Device: ${usbStatus.deviceName}` : 'Connect your 80mm thermal printer via USB cable to enable 1-click silent printing.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePairUsb}
                    disabled={isPairingUsb}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95"
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>{isPairingUsb ? 'Pairing...' : usbStatus.isConnected ? 'Re-pair USB Printer' : 'Pair USB Printer'}</span>
                  </button>
                </div>

                {/* Diagnostics and Hardware Control Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#64748B] mr-1">Hardware Tests:</span>
                  <button
                    type="button"
                    onClick={handleTestUsbPrint}
                    disabled={isTestingUsb}
                    className="px-3 py-1.5 bg-white hover:bg-[#F1F5F9] text-[#172B4D] border border-[#CBD5E1] rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{isTestingUsb ? 'Printing...' : 'Test Print Receipt'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestCut}
                    className="px-3 py-1.5 bg-white hover:bg-[#F1F5F9] text-[#172B4D] border border-[#CBD5E1] rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                  >
                    <Scissors className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Test Auto-Cut</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestCashDrawer}
                    className="px-3 py-1.5 bg-white hover:bg-[#F1F5F9] text-[#172B4D] border border-[#CBD5E1] rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-[#15803D]" />
                    <span>Kick Cash Drawer</span>
                  </button>
                </div>

                {/* Hardware Feature Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0]">
                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#E2E8F0] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printForm.autoCutPaper ?? true}
                      onChange={(e) => setPrintForm({ ...printForm, autoCutPaper: e.target.checked })}
                      className="rounded border-[#D8E1EC] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <div className="font-bold text-[11px] text-[#172B4D]">Auto-Cut Paper (GS V)</div>
                      <div className="text-[10px] text-[#64748B]">Triggers hardware cutter after bill ends</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#E2E8F0] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printForm.openCashDrawer ?? false}
                      onChange={(e) => setPrintForm({ ...printForm, openCashDrawer: e.target.checked })}
                      className="rounded border-[#D8E1EC] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <div className="font-bold text-[11px] text-[#172B4D]">Pop Open Cash Drawer (ESC p)</div>
                      <div className="text-[10px] text-[#64748B]">Sends electrical pulse to drawer pin 2</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Wireless Bluetooth Thermal Printer Hardware Pairing Box (Mobile & Tablet) */}
              <div className="p-4 bg-[#FAF5FF] border border-purple-200 rounded-2xl space-y-3.5 mt-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${bluetoothConnected ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-100 text-purple-700'}`}>
                      <Bluetooth className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[#0F172A]">
                          Wireless Bluetooth Thermal Printer (Mobile / Handheld)
                        </span>
                        {bluetoothConnected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                            Connected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            Not Connected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {bluetoothDeviceName ? `Active Device: ${bluetoothDeviceName}` : 'Pair with portable 58mm or 80mm Bluetooth receipt printer for wireless mobile counter billing.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handlePairBluetooth}
                      disabled={isPairingBluetooth}
                      className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-95"
                    >
                      <Bluetooth className="w-3.5 h-3.5" />
                      <span>{isPairingBluetooth ? 'Scanning...' : bluetoothConnected ? 'Re-pair Bluetooth' : 'Pair Bluetooth Printer'}</span>
                    </button>
                    {bluetoothConnected && (
                      <button
                        type="button"
                        onClick={handleDisconnectBluetooth}
                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#64748B] mr-1">Bluetooth Tests:</span>
                  <button
                    type="button"
                    onClick={handleTestBluetoothPrint}
                    disabled={isTestingBluetooth || !bluetoothConnected}
                    className="px-3 py-1.5 bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#172B4D] border border-[#CBD5E1] rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>{isTestingBluetooth ? 'Sending...' : 'Test Bluetooth Print'}</span>
                  </button>
                </div>
              </div>

              {/* Chrome Kiosk Silent Print Helper Card */}
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-start gap-2.5 mt-3">
                <Info className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div className="text-[11px] text-[#78350F] leading-relaxed">
                  <strong className="text-[#92400E]">Chrome Kiosk Silent Printing Shortcut:</strong> On Windows PCs, you can right-click your WebRajya Chrome desktop shortcut → <strong>Properties</strong> → add <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-[#92400E]">--kiosk-printing</code> at the end of the Target field. This will make even regular browser prints silent with zero dialog popups.
                </div>
              </div>

              {/* Windows .exe Native App Promo Card (when in web browser) */}
              {!isInsideElectron && (
                <div className="p-4 bg-gradient-to-r from-slate-900 to-[#123B70] text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 mt-3 shadow-xs border border-blue-900/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/20 shrink-0">
                      <Monitor className="w-5 h-5 text-blue-300" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-white flex items-center gap-2">
                        <span>Want 100% 0-Click Silent Printing without WebUSB prompts?</span>
                        <span className="text-[9px] font-black uppercase bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      </div>
                      <div className="text-[11px] text-blue-200/80 mt-0.5">
                        Download WebRajya for Windows (.exe) — connects directly to your Windows printer spooler for instant thermal bills.
                      </div>
                    </div>
                  </div>
                  <a
                    href={WINDOWS_EXE_URL}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shrink-0 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4 text-emerald-200" />
                    <span>Download Windows App (.exe)</span>
                  </a>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider border-b border-[#D8E1EC] pb-2 mb-3">
                Print Content & Template Elements
              </h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-[#F5F9FF] border border-[#D8E1EC] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printForm.showGstBreakdown}
                    onChange={(e) => setPrintForm({ ...printForm, showGstBreakdown: e.target.checked })}
                    className="rounded border-[#D8E1EC] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div>
                    <div className="font-bold text-[#172B4D]">Show Tax Breakdown Table</div>
                    <div className="text-[11px] text-[#64748B]">Includes CGST + SGST or IGST tax slab columns on printed invoice</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#F5F9FF] border border-[#D8E1EC] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printForm.showBankDetails}
                    onChange={(e) => setPrintForm({ ...printForm, showBankDetails: e.target.checked })}
                    className="rounded border-[#D8E1EC] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div>
                    <div className="font-bold text-[#172B4D]">Include Bank & UPI QR Payment Info</div>
                    <div className="text-[11px] text-[#64748B]">Prints bank account, IFSC, UPI ID and scan-and-pay details</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#F5F9FF] border border-[#D8E1EC] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printForm.showTerms}
                    onChange={(e) => setPrintForm({ ...printForm, showTerms: e.target.checked })}
                    className="rounded border-[#D8E1EC] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div>
                    <div className="font-bold text-[#172B4D]">Print Terms & Conditions Footer</div>
                    <div className="text-[11px] text-[#64748B]">Include return policy & jurisdiction terms</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-[#D8E1EC]">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Print Settings
              </button>
            </div>
          </form>
        )}

        {activeTab === 'hardware' && (
          <div className="max-w-3xl space-y-6">
            {/* 1. Barcode Scanners */}
            <div>
              <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <ScanBarcode className="w-4 h-4 text-[#0284C7]" />
                  Handheld & Desktop Barcode Scanners
                </h3>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                  Plug & Play Ready (HID Wedge)
                </span>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                USB and 2.4GHz Wireless scanners work automatically like a super-fast keyboard. WebRajya intercepts scanner bursts anywhere in the app with zero driver installation.
              </p>

              {/* Interactive Live Scanner Tester Card */}
              <div className="p-4 bg-[#F8FAFC] border-2 border-[#D8E1EC] rounded-xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#172B4D] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-[#2563EB]" />
                    Live Barcode Scanner Diagnostics & Speed Test
                  </div>
                  <span className="text-[10px] text-[#64748B] font-mono">Status: Listening for scan</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={hardwareScanInput}
                    onChange={(e) => {
                      if (!scanStartTimeRef.current) scanStartTimeRef.current = Date.now();
                      setHardwareScanInput(e.target.value);
                    }}
                    onKeyDown={handleHardwareScanKeyDown}
                    placeholder="Click here and pull your barcode scanner trigger (or scan 2323818749899019946875)..."
                    className="w-full pl-3 pr-28 py-2.5 bg-white border-2 border-[#2563EB]/40 focus:border-[#2563EB] rounded-lg text-xs font-mono font-bold text-[#172B4D] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all shadow-inner"
                  />
                  <div className="absolute right-2 top-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-mono font-bold rounded border border-blue-200">
                      Press Enter or Scan
                    </span>
                  </div>
                </div>

                {lastHardwareScan && (
                  <div className="p-3 bg-white border border-[#BFDBFE] rounded-lg space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#15803D] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Scan Successfully Captured
                      </span>
                      <span className="text-[10px] text-[#64748B] font-mono">{lastHardwareScan.timestamp}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs pt-1">
                      <div className="bg-[#F1F5F9] p-2 rounded">
                        <span className="text-[10px] text-[#64748B] block font-sans">Decoded Barcode:</span>
                        <strong className="text-[#172B4D] text-sm break-all">{lastHardwareScan.code}</strong>
                      </div>
                      <div className="bg-[#F1F5F9] p-2 rounded">
                        <span className="text-[10px] text-[#64748B] block font-sans">Length & Latency:</span>
                        <strong className="text-[#2563EB]">{lastHardwareScan.length} digits ({lastHardwareScan.speedMs}ms)</strong>
                      </div>
                      <div className="bg-[#F1F5F9] p-2 rounded">
                        <span className="text-[10px] text-[#64748B] block font-sans">Catalog Match:</span>
                        {lastHardwareScan.matchedProduct ? (
                          <strong className="text-[#15803D]">{lastHardwareScan.matchedProduct.name}</strong>
                        ) : (
                          <span className="text-amber-600 font-bold">Unregistered SKU</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Thermal Receipt & POS Printers */}
            <div>
              <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#D97706]" />
                  Thermal POS Receipt Printers (80mm / 58mm)
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Connect your USB or Bluetooth thermal roll printer for lightning-fast sub-second receipts and automatic paper cutting.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* USB Direct Print Card */}
                <div className="p-4 bg-white border border-[#D8E1EC] rounded-xl flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Usb className="w-4 h-4 text-[#2563EB]" />
                        <span className="font-extrabold text-xs text-[#0F172A]">USB ESC/POS Printer</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        WebUSB
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed mb-3">
                      Bypasses standard OS print preview dialogs for instant 100ms printing with automatic drawer kick.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await testUsbPrinter();
                          onToast('success', 'USB Printer Test Sent', 'Check your thermal printer for the printed slip.');
                        } catch (err: any) {
                          onToast('info', 'WebUSB Notice', err?.message || 'Please connect USB printer via Pair button first.');
                        }
                      }}
                      className="px-3 py-1.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Test USB Print
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await pairUsbPrinter();
                          onToast('success', 'Printer Paired', 'USB Printer connected successfully.');
                        } catch (err: any) {
                          onToast('error', 'Pair Failed', err?.message || 'USB pairing canceled.');
                        }
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#475569] border border-[#D8E1EC] rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Pair Device
                    </button>
                  </div>
                </div>

                {/* Bluetooth Thermal Card */}
                <div className="p-4 bg-white border border-[#D8E1EC] rounded-xl flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Bluetooth className="w-4 h-4 text-[#0284C7]" />
                        <span className="font-extrabold text-xs text-[#0F172A]">Wireless Bluetooth Printer</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                        BLE POS
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed mb-3">
                      Wirelessly print customer bills from laptops, iPads, tablets, or Android POS terminals.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await printTestBluetooth(shopProfile.shopName || 'WEBRAJYA POS');
                          onToast('success', 'Bluetooth Test Sent', 'Printed test slip via Bluetooth.');
                        } catch (err: any) {
                          onToast('info', 'Bluetooth Notice', err?.message || 'Connect Bluetooth printer first.');
                        }
                      }}
                      className="px-3 py-1.5 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Test Bluetooth
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Barcode Sticker & Label Printers */}
            <div>
              <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2 mb-3">
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#7C3AED]" />
                  Barcode Sticker & Serial Number Label Printers
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Generate and print scannable Code 128 barcode stickers (like Happy Brother serial 2323818749899019946875) for your products on thermal roll stickers or A4 label sheets.
              </p>

              <div className="p-4 bg-white border border-[#D8E1EC] rounded-xl flex items-center justify-between shadow-2xs">
                <div>
                  <div className="font-bold text-xs text-[#0F172A]">
                    Launch Barcode Label Generator & Sticker Roll Studio
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    Supports 50mm × 25mm rolls, 38mm × 25mm mini rolls, and A4 24/40 sticker sheets.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBarcodeModalOpen(true)}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Tag className="w-4 h-4" /> Open Label Studio
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider border-b border-[#D8E1EC] pb-2">
              Database Backup & JSON Data Management
            </h3>

            {/* Last Backup Status Indicator */}
            <div className="flex items-center justify-between p-3.5 bg-white border border-[#D8E1EC] rounded-xl shadow-xs">
              <div className="flex items-center gap-3">
                <ShieldCheck className={`w-5 h-5 shrink-0 ${lastBackupTime ? 'text-[#15803D]' : 'text-amber-500'}`} />
                <div>
                  <div className="text-xs font-bold text-[#172B4D]">
                    {lastBackupTime 
                      ? `Last Backup: ${new Date(lastBackupTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                      : 'No backup downloaded yet'}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    {lastBackupTime ? 'Your local IndexedDB data was safely saved to disk.' : 'Recommended: Take a manual JSON backup every 7 days.'}
                  </div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black shrink-0 ${lastBackupTime ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {lastBackupTime ? 'Active Protection' : 'Backup Needed'}
              </span>
            </div>

            <div className="p-4 bg-[#F5F9FF] border border-[#D8E1EC] rounded-xl space-y-3">
              <div className="font-bold text-[#172B4D]">Export Complete JSON Database Backup</div>
              <p className="text-[11px] text-[#64748B]">Download all local products, invoices, stock movements, and settings into a single JSON file for safe offline keeping.</p>
              <button
                onClick={handleDownloadBackup}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Backup (.json)
              </button>
            </div>

            <div className="p-4 bg-[#F5F9FF] border border-[#D8E1EC] rounded-xl space-y-3">
              <div className="font-bold text-[#172B4D]">Restore Database from Backup JSON</div>
              <p className="text-[11px] text-[#64748B]">Upload a previously exported WebRajya JSON backup file to restore product catalog and sales history.</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F5F9FF] text-[#172B4D] border border-[#D8E1EC] rounded-lg text-xs font-bold cursor-pointer shadow-xs">
                <Upload className="w-4 h-4 text-[#15803D]" /> Select Backup JSON File
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl space-y-3">
              <div className="font-bold text-[#1E40AF]">Reset Local Cache & Re-Sync with Cloud</div>
              <p className="text-[11px] text-[#1E40AF]/80">If another phone or computer shows different stock or products, tap here to wipe local temporary cache and re-download clean master data from Supabase.</p>
              <button
                type="button"
                onClick={handleClearDemoData}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reset Local Cache & Force Cloud Sync
              </button>
            </div>

            <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl space-y-3">
              <div className="font-bold text-[#B91C1C]">Purge All Local Demo Data</div>
              <p className="text-[11px] text-[#B91C1C]/80">Permanently wipe all local products, invoices, stock records, and customers from this device and reload a clean state.</p>
              <button
                type="button"
                onClick={handleClearDemoData}
                className="px-4 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete All Local Data
              </button>
            </div>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider border-b border-[#D8E1EC] pb-2">
              Sensory Audio Cues & Sound Effects
            </h3>

            <div className="p-4 bg-[#F5F9FF] border border-[#D8E1EC] rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center shrink-0">
                    {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#172B4D]">Audio Feedback & Sound Effects</div>
                    <div className="text-[11px] text-[#64748B]">Synthesized Web Audio API feedback for barcode scans, item additions, and cash chimes.</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextState = !soundOn;
                    setSoundEnabled(nextState);
                    setSoundOn(nextState);
                    if (nextState) playBeep();
                    onToast('info', 'Sound Settings', nextState ? 'Audio feedback enabled' : 'Audio muted');
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer shrink-0 ${
                    soundOn ? 'bg-[#15803D] text-white shadow-xs' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {soundOn ? 'SOUND: ON' : 'SOUND: MUTED'}
                </button>
              </div>

              <div className="pt-3 border-t border-[#D8E1EC]">
                <div className="text-xs font-bold text-[#172B4D] mb-2">Test Audio Cues</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => playBeep()}
                    className="px-3 py-1.5 bg-white hover:bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Barcode Beep (880Hz)
                  </button>
                  <button
                    type="button"
                    onClick={() => playCashChime()}
                    className="px-3 py-1.5 bg-white hover:bg-[#F0FDF4] text-[#15803D] border border-[#86EFAC] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Sale Complete Chime
                  </button>
                  <button
                    type="button"
                    onClick={() => playError()}
                    className="px-3 py-1.5 bg-white hover:bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Alert / Error Tone
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" /> Google Gemini 2.0 Flash AI Configuration
                </h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Powers the WebRajya Invoice Chatbot and Purchase Bill Scanner (AI Inwarding) at 100% free cost.
                </p>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                geminiApiKey ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {geminiApiKey ? 'AI Active' : 'Key Required'}
              </span>
            </div>

            {/* Free Tier Info Banner */}
            <div className="p-4 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-200/80 rounded-xl space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                    100% Free via Google AI Studio
                  </div>
                  <p className="text-[11px] text-purple-900/80 mt-0.5 leading-relaxed">
                    Google provides 1,500 free requests per day (15 requests/minute). Direct portal link:
                  </p>
                  <a
                    href="https://aistudio.google.com/app/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-700 underline font-bold mt-1 hover:text-purple-900"
                  >
                    https://aistudio.google.com/app/api-keys <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <a
                  href="https://aistudio.google.com/app/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
                >
                  <span>Open API Keys</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Input & Form */}
            <div className="p-4 bg-white border border-[#D8E1EC] rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1.5">
                  Google Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full pl-3 pr-20 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-mono text-[#0F172A] focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showApiKey ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1.5">
                  Your key is stored securely in your browser's local storage and used directly for AI requests.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={isTestingAi || !apiKeyInput.trim()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
                    <span>{isTestingAi ? 'Validating...' : 'Test Connection'}</span>
                  </button>

                  {geminiApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInput('');
                        setGeminiApiKey('');
                        onToast('info', 'AI Key Cleared', 'Google Gemini API key removed.');
                      }}
                      className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveGeminiKey}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#D8E1EC] pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-blue-600" /> POS Hotkeys & Cashier Quick Reference
                </h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Full reference guide for high-speed cashier billing, keyboard hotkeys, and barcode navigation.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                F2 – F11 Active
              </span>
            </div>

            {/* Quick Summary Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950">Zero-Mouse Billing Engine</h4>
                  <p className="text-[11px] text-blue-900/80 mt-0.5">
                    Cashiers can complete a full billing transaction in under 5 seconds using only the keyboard and barcode scanner.
                  </p>
                </div>
              </div>
              {typeof window !== 'undefined' && !window.electronAPI?.isElectron && (
                <a
                  href={WINDOWS_EXE_URL}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer"
                  title="Download WebRajya for Windows (.exe)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Windows App</span>
                </a>
              )}
            </div>

            {/* Hotkeys Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#172B4D] uppercase tracking-wider">
                Keyboard Hotkeys (F2 to F11)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[
                  {
                    key: 'F2',
                    label: 'New Bill',
                    color: 'bg-blue-600 text-white',
                    desc: 'Opens remark prompt / resets billing cart to start a new sale transaction cleanly.'
                  },
                  {
                    key: 'F3',
                    label: '+ Client / Customer',
                    color: 'bg-slate-700 text-white',
                    desc: 'Quickly select an existing customer or register a new client with GSTIN, phone & address.'
                  },
                  {
                    key: 'F4',
                    label: 'Search Product Catalog',
                    color: 'bg-slate-700 text-white',
                    desc: 'Opens full product picker with category filter, search, price & live stock balance.'
                  },
                  {
                    key: 'F6',
                    label: 'Toggle GST Mode',
                    color: 'bg-emerald-600 text-white',
                    desc: 'Instant toggle between GST Tax Invoice (with CGST/SGST/IGST) and Simple Estimate Bill.'
                  },
                  {
                    key: 'F7',
                    label: 'Only Save (No Print)',
                    color: 'bg-emerald-600 text-white',
                    desc: 'Saves invoice to database, reduces product inventory, without opening printer dialog.'
                  },
                  {
                    key: 'F8',
                    label: 'Quick Settle (Cash/UPI)',
                    color: 'bg-emerald-600 text-white',
                    desc: 'Opens instant payment settlement modal with Cash, UPI, Split payment and tender change.'
                  },
                  {
                    key: 'F9',
                    label: 'Save & Print Bill',
                    color: 'bg-amber-500 text-white',
                    desc: 'Saves bill, adjusts stock, and dispatches instant print job to configured thermal/A5 printer.'
                  },
                  {
                    key: 'F10',
                    label: 'Hold / Park Draft',
                    color: 'bg-rose-600 text-white',
                    desc: 'Parks the current bill in memory so you can serve another customer, then resume anytime.'
                  },
                  {
                    key: 'F11',
                    label: 'Clear Bill',
                    color: 'bg-rose-600 text-white',
                    desc: 'Completely empties current items cart after confirmation.'
                  }
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-xl flex items-start gap-3 transition-colors"
                  >
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono shadow-xs shrink-0 ${item.color}`}>
                      {item.key}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-[#0F172A]">{item.label}</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Tips Card */}
            <div className="p-4 bg-white border border-[#D8E1EC] rounded-2xl space-y-3">
              <h4 className="text-xs font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                Barcode Gun & Fast Cashier Pro-Tips
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#334155]">
                <div className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl space-y-1">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span>🔫 Barcode Scanner</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Point & scan any product barcode. The item is automatically added to cart. Scanning again increments quantity by 1.
                  </p>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl space-y-1">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span>↵ Enter Key Navigation</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Press Enter after barcode or product selection to jump straight into Qty, Rate, and Discount fields without reaching for the mouse.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl space-y-1">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span>⚡ Instant Settlement</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Press <span className="font-bold text-emerald-700">F8</span> then press Enter to immediately confirm cash payment, or press <span className="font-bold text-amber-700">F9</span> to instantly print.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Secondary Bottom Return Button */}
      <div className="flex justify-start pt-1">
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setActiveTab(null);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#F8FAFC] border border-[#D8E1EC] text-[#475569] hover:text-[#172B4D] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Settings Menu</span>
        </button>
      </div>
    </div>
  )}

  {/* PWA / Windows App Installation Modal */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onInstall={promptInstall}
        hasNativePrompt={hasNativePrompt}
        isInstalled={isInstalled}
        isIos={isIos}
        initialTab={installModalTab}
      />

      {/* Barcode & Serial Label Sticker Modal */}
      <BarcodeGeneratorModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        products={products}
        shopProfile={shopProfile}
        onToast={onToast}
      />
    </div>
  );
};

