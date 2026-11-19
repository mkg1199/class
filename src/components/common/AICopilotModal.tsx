import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, X, Send, Bot, User, Trash2, Mic, MicOff,
  Receipt, Package, Users, BarChart3, Settings, Camera, 
  ClipboardCheck, ChevronDown, Minimize2, ExternalLink
} from 'lucide-react';
import { useChatbotStore, type ChatMessage } from '../../store/useChatbotStore';
import { useProductStore } from '../../store/useProductStore';
import { useSalesStore } from '../../store/useSalesStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { type LiveStoreContext } from '../../lib/ai/chatEngine';

interface AICopilotModalProps {
  onNavigateSection: (section: 'billing' | 'products' | 'inventory' | 'customers' | 'sales' | 'settings') => void;
  onOpenModal?: (modalType: 'bill_scanner' | 'stock_take' | 'reorder_assistant') => void;
  showFloatingButton?: boolean;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  NAVIGATE_BILLING: <Receipt className="w-3.5 h-3.5 text-blue-600" />,
  NAVIGATE_INVENTORY: <Package className="w-3.5 h-3.5 text-emerald-600" />,
  NAVIGATE_CUSTOMERS: <Users className="w-3.5 h-3.5 text-indigo-600" />,
  NAVIGATE_REPORTS: <BarChart3 className="w-3.5 h-3.5 text-amber-600" />,
  NAVIGATE_SETTINGS: <Settings className="w-3.5 h-3.5 text-slate-600" />,
  OPEN_BILL_SCANNER: <Camera className="w-3.5 h-3.5 text-purple-600" />,
  OPEN_STOCK_TAKE: <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" />,
  OPEN_REORDER_ASSISTANT: <Sparkles className="w-3.5 h-3.5 text-orange-600" />
};

export const AICopilotModal: React.FC<AICopilotModalProps> = ({
  onNavigateSection,
  onOpenModal,
  showFloatingButton = false
}) => {
  const { isOpen, isLoading, messages, toggleOpen, sendMessage, clearMessages } = useChatbotStore();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Store data for live context injection
  const { products } = useProductStore();
  const { invoices } = useSalesStore();
  const { customers } = useCustomerStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  // Build live context snapshot
  const getLiveStoreContext = (): LiveStoreContext => {
    const activeProducts = products.filter(p => p.isActive !== false);
    const lowStock = activeProducts.filter(p => p.stockQty <= p.minStockLevel && p.stockQty >= 0);
    
    // Today's sales
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayInvoices = invoices.filter(inv => (inv.date === todayStr || inv.createdAt?.slice(0, 10) === todayStr) && inv.status !== 'cancelled');
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + (inv.netPayable || 0), 0);

    // Customer dues
    const dueCustomers = customers.filter(c => (c.creditBalance || 0) > 0);
    const totalKhata = dueCustomers.reduce((sum, c) => sum + (c.creditBalance || 0), 0);

    return {
      totalProducts: activeProducts.length,
      lowStockCount: lowStock.length,
      lowStockSample: lowStock.slice(0, 3).map(p => `${p.name} (${p.stockQty} left)`),
      todaySalesCount: todayInvoices.length,
      todaySalesRevenue: todayRevenue,
      totalCustomersWithDue: dueCustomers.length,
      totalKhataOutstanding: totalKhata
    };
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    const context = getLiveStoreContext();
    await sendMessage(text, context);
  };

  const handleActionClick = (actionType: string) => {
    switch (actionType) {
      case 'NAVIGATE_BILLING':
        onNavigateSection('billing');
        break;
      case 'NAVIGATE_INVENTORY':
        onNavigateSection('inventory');
        break;
      case 'NAVIGATE_CUSTOMERS':
        onNavigateSection('customers');
        break;
      case 'NAVIGATE_REPORTS':
        onNavigateSection('sales');
        break;
      case 'NAVIGATE_SETTINGS':
        onNavigateSection('settings');
        break;
      case 'OPEN_BILL_SCANNER':
        onNavigateSection('inventory');
        onOpenModal?.('bill_scanner');
        break;
      case 'OPEN_STOCK_TAKE':
        onNavigateSection('inventory');
        onOpenModal?.('stock_take');
        break;
      case 'OPEN_REORDER_ASSISTANT':
        onNavigateSection('inventory');
        onOpenModal?.('reorder_assistant');
        break;
      default:
        console.warn('Unknown action:', actionType);
    }
  };

  // Web Speech API Voice Recognition
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please type your question.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSend(transcript);
        }
      };

      recognition.start();
    } catch (e) {
      console.error('Speech recognition error:', e);
      setIsListening(false);
    }
  };

  // Quick Starter Prompts
  const QUICK_PROMPTS = [
    'How do I do a physical stock count?',
    'Customer ka udhaar khata kaise update karein?',
    'Show items low on stock right now',
    'How to scan a supplier bill with camera?',
    'What are all keyboard shortcuts in billing?'
  ];

  // Helper to format basic markdown text into elements
  const renderFormattedText = (content: string) => {
    return content.split('\n').map((line, idx) => {
      // Bold rendering
      let processed: React.ReactNode = line;
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        processed = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx} className="font-bold text-[#0F172A]">{part.slice(2, -2)}</strong>;
          }
          return part;
        });
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-[#334155] leading-relaxed">
            {typeof processed === 'string' ? processed.replace(/^[-*]\s+/, '') : processed}
          </li>
        );
      }

      // Empty line / paragraph break
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-xs text-[#334155] leading-relaxed">
          {processed}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Launcher Button (Hidden by default; launched via Tools menu) */}
      {!isOpen && showFloatingButton && (
        <button
          type="button"
          onClick={() => toggleOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-3 sm:px-4 sm:py-3 shadow-xl hover:shadow-2xl flex items-center gap-2.5 transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer border border-white/20 group"
          title="Open WebRajya Invoice Chatbot (100% Free)"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-700 animate-pulse" />
          </div>
          <span className="hidden sm:inline text-xs font-bold tracking-wide">
            WebRajya AI Chatbot
          </span>
        </button>
      )}

      {/* Slide-Up / Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-16 sm:bottom-6 right-2 sm:right-6 z-40 w-[95vw] sm:w-[420px] max-h-[85vh] sm:max-h-[640px] h-[600px] bg-white rounded-2xl shadow-2xl border border-[#CBD5E1] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] text-white p-3.5 sm:p-4 flex items-center justify-between shadow-md shrink-0 border-b border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                <img src="/logo.png" alt="WebRajya Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 tracking-tight">
                  WebRajya Invoice Chatbot
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                    FREE
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 flex items-center gap-1">
                  <span>Powered by Gemini AI</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearMessages}
                className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Viewport */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-[#F8FAFC]">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200 shadow-2xs">
                      <img src="/logo.png" alt="WebRajya Logo" className="w-full h-full object-contain" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-xs ${
                      isUser
                        ? 'bg-[#2563EB] text-white rounded-tr-xs'
                        : 'bg-white border border-[#E2E8F0] text-[#1E293B] rounded-tl-xs'
                    }`}
                  >
                    <div className={`space-y-1 ${isUser ? 'text-white' : ''}`}>
                      {renderFormattedText(msg.text)}
                    </div>

                    {/* Interactive Action Buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {msg.actions.map((action, aIdx) => (
                          <button
                            key={aIdx}
                            type="button"
                            onClick={() => handleActionClick(action.type)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-95 text-[#1E293B] text-[11px] font-bold rounded-lg border border-[#CBD5E1] transition-all cursor-pointer shadow-2xs"
                          >
                            {ACTION_ICONS[action.type] || <ExternalLink className="w-3 h-3 text-blue-600" />}
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking / Loading Animation */}
            {isLoading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                  <img src="/logo.png" alt="WebRajya Logo" className="w-full h-full object-contain animate-pulse" />
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 shadow-xs text-xs text-[#64748B] flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                  </div>
                  <span>Checking store knowledge & thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Chips */}
          {messages.length <= 2 && (
            <div className="px-3.5 py-2 bg-white border-t border-slate-100 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5 shrink-0">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 rounded-full text-[11px] font-medium border border-slate-200 transition-colors shrink-0 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-[#E2E8F0] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask anything (English / हिंदी / Hinglish)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-3 pr-9 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                    isListening
                      ? 'text-rose-600 bg-rose-50 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Voice Input (Speech-to-Text)'}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="p-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
