import { SOFTWARE_KNOWLEDGE_BASE } from './softwareKnowledge';

export interface LiveStoreContext {
  totalProducts: number;
  lowStockCount: number;
  lowStockSample: string[];
  todaySalesCount: number;
  todaySalesRevenue: number;
  totalCustomersWithDue: number;
  totalKhataOutstanding: number;
}

export interface ChatActionItem {
  type: string;
  label: string;
  icon?: string;
}

export interface AssistantTurnResponse {
  cleanText: string;
  actions: ChatActionItem[];
}

const ACTION_MAP: Record<string, { label: string; icon?: string }> = {
  NAVIGATE_BILLING: { label: 'Go to Billing', icon: 'Receipt' },
  NAVIGATE_INVENTORY: { label: 'Go to Inventory', icon: 'Package' },
  NAVIGATE_CUSTOMERS: { label: 'Go to Customers & Khata', icon: 'Users' },
  NAVIGATE_REPORTS: { label: 'Go to Reports', icon: 'BarChart3' },
  NAVIGATE_SETTINGS: { label: 'Go to Settings', icon: 'Settings' },
  OPEN_BILL_SCANNER: { label: 'Scan Purchase Bill', icon: 'Camera' },
  OPEN_STOCK_TAKE: { label: 'Start Stock Take Audit', icon: 'ClipboardCheck' },
  OPEN_REORDER_ASSISTANT: { label: 'Open Reorder Assistant', icon: 'Sparkles' }
};

/**
 * Extracts [ACTION:XXXX] tags from model text and maps them to clean actionable buttons
 */
export function parseActionsFromText(rawText: string): AssistantTurnResponse {
  const actions: ChatActionItem[] = [];
  const actionRegex = /\[ACTION:([A-Z_]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = actionRegex.exec(rawText)) !== null) {
    const actionKey = match[1];
    const mapping = ACTION_MAP[actionKey];
    if (mapping && !actions.some(a => a.type === actionKey)) {
      actions.push({
        type: actionKey,
        label: mapping.label,
        icon: mapping.icon
      });
    }
  }

  // Remove the [ACTION:...] tags from display text
  let cleanText = rawText.replace(/\[ACTION:[A-Z_]+\]/g, '').trim();

  // Hard Word-Budget Safety: Guarantee max 80 words for ultra-fast reading and token efficiency
  const words = cleanText.split(/\s+/);
  if (words.length > 85) {
    cleanText = words.slice(0, 80).join(' ') + '...';
  }

  return { cleanText, actions };
}

/**
 * Calls Google Gemini (optimized for minimal token consumption and 70-80 word answers)
 */
export async function sendQueryToGeminiCopilot(params: {
  apiKey: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  userQuery: string;
  liveContext?: LiveStoreContext;
}): Promise<AssistantTurnResponse> {
  const { apiKey, history, userQuery, liveContext } = params;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('No Gemini API Key provided. Please add your free key in Settings or AI Config.');
  }

  // Build ultra-lean single-line live context string (~35 tokens)
  let contextBlock = '';
  if (liveContext) {
    contextBlock = `\n[STORE STATUS: SKUs=${liveContext.totalProducts}, LowStock=${liveContext.lowStockCount}${liveContext.lowStockSample.length > 0 ? ` (${liveContext.lowStockSample.slice(0, 3).join(', ')})` : ''}, TodayBills=${liveContext.todaySalesCount}, TodaySales=₹${liveContext.todaySalesRevenue}, KhataDues=₹${liveContext.totalKhataOutstanding}]`;
  }

  const systemInstruction = `${SOFTWARE_KNOWLEDGE_BASE}${contextBlock}`;

  // Assemble Gemini contents payload
  const contents: any[] = [];

  // Grounding prompt with strict conciseness mandate
  contents.push({
    role: 'user',
    parts: [{ text: `[SYSTEM INSTRUCTION]\n${systemInstruction}` }]
  });
  contents.push({
    role: 'model',
    parts: [{ text: "Understood. 70-80 words max. Direct facts & steps only." }]
  });

  // Append recent history (only last 2 turns to keep token consumption minimal)
  const recentHistory = history.slice(-2);
  for (const turn of recentHistory) {
    const textWithoutActions = turn.text.replace(/\[ACTION:[A-Z_]+\]/g, '').trim();
    if (textWithoutActions) {
      contents.push({
        role: turn.role,
        parts: [{ text: textWithoutActions }]
      });
    }
  }

  // Append current user message
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }]
  });

  // Prioritize gemini-2.5-flash-lite: 5x cheaper, 2x faster, sub-second latency
  const CANDIDATE_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 140
          }
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }
        const errorBody = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorBody}`);
      }

      const result = await response.json();
      const rawOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawOutput) {
        return parseActionsFromText(rawOutput);
      }
    } catch (err: any) {
      lastError = err;
      if (!String(err?.message || '').includes('404')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('No compatible Gemini model could be reached with this API key.');
}

