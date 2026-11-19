import React from 'react';
import {
  X,
  BookOpen,
  Award,
  ShieldAlert,
  Settings,
  DollarSign,
  Cloud,
  ChevronRight,
  Sparkles,
  PhoneCall,
  HelpCircle
} from 'lucide-react';
import { MainSection } from '../../App';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (section: MainSection) => void;
  onOpenSyncModal: () => void;
  onOpenCashRegister?: () => void;
  instituteName?: string;
}

export function MobileMoreDrawer({
  isOpen,
  onClose,
  onSelectSection,
  onOpenSyncModal,
  onOpenCashRegister,
  instituteName
}: MobileMoreDrawerProps) {
  if (!isOpen) return null;

  const handleSelect = (section: MainSection) => {
    onSelectSection(section);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-up bottom sheet */}
      <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl z-10 border-t border-slate-200 p-5 space-y-5 animate-in slide-in-from-bottom duration-250 safe-area-pb">
        {/* Drag handle / Header */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-3" />
          <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">Institute Menu & Hub</h3>
              <p className="text-xs text-slate-500">
                {instituteName && !instituteName.toLowerCase().includes('retail')
                  ? instituteName
                  : 'WebRajya Tuition'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section 1: Academic Management */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
            Academic Operations
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleSelect('batches')}
              className="p-3.5 bg-[#FAF9F5] hover:bg-[#F2EDE4] border border-[#E5E1DA] rounded-2xl text-left transition-all active:scale-97 flex flex-col justify-between h-24"
            >
              <div className="w-8 h-8 rounded-xl bg-[#14213D] text-[#C88A35] flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-[#1C1917] block">Batches & Courses</span>
                <span className="text-[10px] text-stone-500">Timetable & Schedule</span>
              </div>
            </button>

            <button
              onClick={() => handleSelect('exams')}
              className="p-3.5 bg-[#FAF9F5] hover:bg-[#F2EDE4] border border-[#E5E1DA] rounded-2xl text-left transition-all active:scale-97 flex flex-col justify-between h-24"
            >
              <div className="w-8 h-8 rounded-xl bg-[#C88A35]/20 text-[#C88A35] flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-[#1C1917] block">Exams & Tests</span>
                <span className="text-[10px] text-stone-500">Marks & Report Cards</span>
              </div>
            </button>
          </div>
        </div>

        {/* Section 2: Dues & Finance */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
            Accounts & Dues
          </span>
          <div className="space-y-2">
            <button
              onClick={() => handleSelect('defaulters')}
              className="w-full p-3 bg-amber-50/70 hover:bg-amber-50 border border-amber-200/80 rounded-2xl text-left transition-all active:scale-98 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-amber-950 block">Fee Defaulters List</span>
                  <span className="text-[10px] text-amber-700/80">Send 1-Click WhatsApp Reminders</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500" />
            </button>
          </div>
        </div>

        {/* Section 3: Institute Profile & Settings */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
            Settings & System
          </span>
          <div className="space-y-2">
            <button
              onClick={() => handleSelect('settings')}
              className="w-full p-3 bg-[#FAF9F5] hover:bg-[#F2EDE4] border border-[#E5E1DA] rounded-2xl text-left transition-all active:scale-98 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#14213D] text-[#C88A35] flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-[#1C1917] block">Institute Settings</span>
                  <span className="text-[10px] text-stone-500">Logo, Director Sign, Receipt Style</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenSyncModal();
              }}
              className="w-full p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-2xl text-left transition-all active:scale-98 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#14213D]/10 text-[#14213D] flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-[#14213D] block">Cloud Sync & Multi-Device</span>
                  <span className="text-[10px] text-stone-600">Sync with phone & receptionist PC</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#14213D]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
