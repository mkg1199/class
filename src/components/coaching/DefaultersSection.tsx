import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Send,
  Phone,
  Receipt,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { useStudentStore } from '../../store/useStudentStore';
import { useFeeStore } from '../../store/useFeeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Student, SUPPORTED_STANDARDS } from '../../types';
import { sendFeeDueReminderWhatsApp } from '../../lib/coachingWhatsApp';

interface DefaultersSectionProps {
  onNavigateToFeeCounter?: (studentId: string) => void;
}

export function DefaultersSection({ onNavigateToFeeCounter }: DefaultersSectionProps) {
  const { students, loadStudents } = useStudentStore();
  const { feePlans, loadFeeData, getDefaultersList } = useFeeStore();
  const { shopProfile } = useSettingsStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [standardFilter, setStandardFilter] = useState('all');

  useEffect(() => {
    loadStudents();
    loadFeeData();
  }, []);

  const defaulters = useMemo(() => {
    const list = getDefaultersList();
    return list.filter(({ student }) => {
      const matchSearch =
        !searchTerm.trim() ||
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.enrollmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.parentMobile.includes(searchTerm);

      const matchStd = standardFilter === 'all' || student.standard === standardFilter;
      return matchSearch && matchStd;
    });
  }, [getDefaultersList, searchTerm, standardFilter]);

  const totalOverdue = defaulters.reduce((sum, item) => sum + item.overdueAmount, 0);

  const handleSendReminder = (student: Student, dueAmount: number, dueDate?: string) => {
    sendFeeDueReminderWhatsApp(
      student,
      dueAmount,
      dueDate || 'Immediate',
      shopProfile
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#C88A35]" />
            Fee Defaulters & Outstanding Dues
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Identify overdue installments, send instant WhatsApp notices and reconcile pending institute revenues
          </p>
        </div>

        <div className="bg-[#FAF7F0] border border-amber-200/80 px-4 py-2 rounded-xl text-right">
          <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">Total Outstanding Dues</span>
          <span className="font-mono text-xl font-black text-amber-900">
            ₹{totalOverdue.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Filter Standard:</span>
          <select
            value={standardFilter}
            onChange={(e) => setStandardFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
          >
            <option value="all">All Standards</option>
            {SUPPORTED_STANDARDS.map((std) => (
              <option key={std} value={std}>
                {std}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search defaulter by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Defaulters Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Student & ID</th>
                <th className="py-3 px-3">Class</th>
                <th className="py-3 px-3">Parent Phone</th>
                <th className="py-3 px-3">Fee Plan Progress</th>
                <th className="py-3 px-3">Overdue Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {defaulters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No defaulters found! All fee installments are cleared.
                  </td>
                </tr>
              ) : (
                defaulters.map(({ student, plan, overdueAmount }) => {
                  const firstOverdueInst = plan?.installments.find(
                    (i) => i.status !== 'paid' && i.dueDate < new Date().toISOString().split('T')[0]
                  );

                  return (
                    <tr key={student.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-900 block text-sm">{student.name}</span>
                        <span className="font-mono text-gray-400 text-[10px]">
                          {student.enrollmentNo} {student.rollNo && `• Roll: ${student.rollNo}`}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-medium text-gray-800">{student.standard}</span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-mono text-gray-700">{student.parentMobile}</div>
                        <span className="text-[10px] text-gray-400">{student.fatherName || 'Parent'}</span>
                      </td>

                      <td className="py-3.5 px-3">
                        {plan ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                              <span>Paid: ₹{plan.totalPaid.toLocaleString('en-IN')}</span>
                              <span>Total: ₹{plan.netFeePayable.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, (plan.totalPaid / plan.netFeePayable) * 100)}%`
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">No Plan</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-red-600 text-sm block">
                          ₹{overdueAmount.toLocaleString('en-IN')}
                        </span>
                        {firstOverdueInst && (
                          <span className="text-[10px] text-red-500">
                            Due since: {firstOverdueInst.dueDate}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSendReminder(student, overdueAmount, firstOverdueInst?.dueDate)}
                            className="px-3 py-1.5 bg-[#FAF7F0] hover:bg-[#F2EDE4] text-[#C88A35] border border-[#E5E1DA] rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Send WhatsApp Reminder"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-[#C88A35]" />
                            WhatsApp Notice
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
