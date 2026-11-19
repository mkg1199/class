import { create } from 'zustand';
import { sendQueryToGeminiCopilot, type ChatActionItem, type LiveStoreContext } from '../lib/ai/chatEngine';
import { usePurchaseStore } from './usePurchaseStore';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actions?: ChatActionItem[];
  timestamp: number;
}

interface ChatbotState {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  messages: ChatMessage[];

  // Actions
  toggleOpen: (open?: boolean) => void;
  sendMessage: (text: string, liveContext?: LiveStoreContext) => Promise<void>;
  clearMessages: () => void;
}

const INITIAL_GREETING: ChatMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  text: `👋 Namaste! I am **WebRajya Invoice Chatbot**, your in-store AI assistant.
I know everything about **WebRajya Invoice** software and your live store inventory.

Ask me anything in **English, Hindi, or Hinglish**! For example:
- *"How do I do a physical stock count?"*
- *"Customer ka udhaar khata kaise update karein?"*
- *"Do we have any items running low on stock?"*
- *"How to scan a supplier bill with camera?"*`,
  actions: [
    { type: 'OPEN_STOCK_TAKE', label: 'Audit Stock', icon: 'ClipboardCheck' },
    { type: 'OPEN_BILL_SCANNER', label: 'Scan Purchase Bill', icon: 'Camera' },
    { type: 'NAVIGATE_BILLING', label: 'Start Billing (F2)', icon: 'Receipt' }
  ],
  timestamp: Date.now()
};

const STORAGE_CHAT_KEY = 'webrajya_copilot_history_v1';

function getStoredMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_CHAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return [INITIAL_GREETING];
}

export const useChatbotStore = create<ChatbotState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  error: null,
  messages: typeof window !== 'undefined' ? getStoredMessages() : [INITIAL_GREETING],

  toggleOpen: (open?: boolean) => {
    set(state => ({ isOpen: typeof open === 'boolean' ? open : !state.isOpen }));
  },

  clearMessages: () => {
    try {
      sessionStorage.removeItem(STORAGE_CHAT_KEY);
    } catch (e) {}
    set({ messages: [INITIAL_GREETING], error: null });
  },

  sendMessage: async (userText: string, liveContext?: LiveStoreContext) => {
    const trimmed = userText.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `msg-u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'user',
      text: trimmed,
      timestamp: Date.now()
    };

    const updatedMessages = [...get().messages, userMessage];
    set({ messages: updatedMessages, isLoading: true, error: null });

    // Save to session storage
    try {
      sessionStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(updatedMessages));
    } catch (e) {}

    try {
      const apiKey = usePurchaseStore.getState().geminiApiKey;
      if (!apiKey || !apiKey.trim()) {
        const errorAssistantMsg: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Gemini API Key Required**\n\nTo use the AI Copilot for free, please add your Google Gemini API key in **Settings > AI Config** or click the key icon in the Purchase Bill Scanner.\n\nYou can get a 100% free key directly from [aistudio.google.com/app/api-keys](https://aistudio.google.com/app/api-keys).`,
          actions: [
            { type: 'NAVIGATE_SETTINGS', label: 'Go to Settings', icon: 'Settings' }
          ],
          timestamp: Date.now()
        };

        const finalMsgs = [...updatedMessages, errorAssistantMsg];
        set({ messages: finalMsgs, isLoading: false });
        sessionStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(finalMsgs));
        return;
      }

      // Convert history for Gemini
      const history = updatedMessages
        .filter(m => m.id !== 'msg-welcome' && m.id !== userMessage.id)
        .map(m => ({
          role: m.sender === 'user' ? ('user' as const) : ('model' as const),
          text: m.text
        }));

      const response = await sendQueryToGeminiCopilot({
        apiKey,
        history,
        userQuery: trimmed,
        liveContext
      });

      const assistantMessage: ChatMessage = {
        id: `msg-a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'assistant',
        text: response.cleanText,
        actions: response.actions,
        timestamp: Date.now()
      };

      const finalMsgs = [...updatedMessages, assistantMessage];
      set({ messages: finalMsgs, isLoading: false });
      sessionStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(finalMsgs));
    } catch (err: any) {
      console.error('[Copilot Error]:', err);
      const errMsg = err?.message || 'Failed to communicate with AI Assistant';
      set({ error: errMsg, isLoading: false });

      const assistantError: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: `❌ **Error:** ${errMsg}\n\nPlease check your internet connection or verify your Gemini API key in Settings.`,
        timestamp: Date.now()
      };
      set(state => ({ messages: [...state.messages, assistantError] }));
    }
  }
}));

