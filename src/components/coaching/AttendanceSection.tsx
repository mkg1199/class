import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Smartphone,
  Save,
  Users,
  Send,
  Sparkles
} from 'lucide-react';
import { useCourseStore } from '../../store/useCourseStore';
import { useStudentStore } from '../../store/useStudentStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AttendanceStatus } from '../../types';
import { sendAbsentAlertWhatsApp } from '../../lib/coachingWhatsApp';

export function AttendanceSection() {
  const { batches, loadCoursesAndBatches } = useCourseStore();
  const { students, loadStudents } = useStudentStore();
  const { attendanceRecords, loadAttendance, markBatchAttendance, markParentAlertSent } = useAttendanceStore();
  const { shopProfile } = useSettingsStore();

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadCoursesAndBatches();
    loadStudents();
    loadAttendance();
  }, []);

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches]);

  const selectedBatch = useMemo(() => {
    return batches.find((b) => b.id === selectedBatchId);
  }, [batches, selectedBatchId]);

  // Students in selected batch
  const batchStudents = useMemo(() => {
    if (!selectedBatchId) return [];
    return students.filter((s) => s.batchIds.includes(selectedBatchId) && s.status === 'active');
  }, [students, selectedBatchId]);

  // Load existing records for this batch and date
  useEffect(() => {
    if (!selectedBatchId || !selectedDate) return;
    const existing = attendanceRecords.filter(
      (r) => r.batchId === selectedBatchId && r.date === selectedDate
    );

    const initialMap: Record<string, { status: AttendanceStatus; remarks: string }> = {};

    batchStudents.forEach((student) => {
      const found = existing.find((r) => r.studentId === student.id);
      if (found) {
        initialMap[student.id] = { status: found.status, remarks: found.remarks || '' };
      } else {
        // Default to present
        initialMap[student.id] = { status: 'present', remarks: '' };
      }
    });

    setAttendanceMap(initialMap);
    setIsSaved(existing.length > 0);
  }, [selectedBatchId, selectedDate, batchStudents, attendanceRecords]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
    setIsSaved(false);
  };

  const handleRemarkChange = (studentId: string, remarks: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks
      }
    }));
    setIsSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const nextMap = { ...attendanceMap };
    batchStudents.forEach((s) => {
      nextMap[s.id] = { ...nextMap[s.id], status };
    });
    setAttendanceMap(nextMap);
    setIsSaved(false);
  };

  const handleSaveAttendance = async () => {
    if (!selectedBatch) return;

    const payload = batchStudents.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      rollNo: s.rollNo,
      status: attendanceMap[s.id]?.status || 'present',
      remarks: attendanceMap[s.id]?.remarks || ''
    }));

    await markBatchAttendance(selectedBatch.id, selectedBatch.name, selectedDate, payload);
    setIsSaved(true);
  };

  // Metrics
  const presentCount = batchStudents.filter((s) => attendanceMap[s.id]?.status === 'present').length;
  const absentCount = batchStudents.filter((s) => attendanceMap[s.id]?.status === 'absent').length;
  const lateCount = batchStudents.filter((s) => attendanceMap[s.id]?.status === 'late').length;
  const attendanceRate = batchStudents.length > 0 ? Math.round((presentCount / batchStudents.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Batch Selector */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#C88A35]" />
            Daily Batch Attendance
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Mark daily attendance, monitor presence rates and send 1-click absent alerts to parents
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Select Batch */}
          <div>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-hidden"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.standard})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Metrics & Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-xs text-stone-400 block">Total Students</span>
          <span className="font-mono text-2xl font-bold text-stone-900">{batchStudents.length}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-xs text-[#1E6B52] font-semibold block">Present</span>
          <span className="font-mono text-2xl font-bold text-[#1E6B52]">{presentCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-xs text-red-700 font-semibold block">Absent</span>
          <span className="font-mono text-2xl font-bold text-red-700">{absentCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-xs text-[#C88A35] font-semibold block">Attendance %</span>
          <span className="font-mono text-2xl font-bold text-[#C88A35]">{attendanceRate}%</span>
        </div>
      </div>

      {/* Main Attendance Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-medium">Quick Mark:</span>
            <button
              onClick={() => markAll('present')}
              className="px-2.5 py-1 bg-[#1E6B52]/10 hover:bg-[#1E6B52]/20 text-[#1E6B52] text-xs rounded-lg font-medium transition-colors cursor-pointer"
            >
              All Present
            </button>
            <button
              onClick={() => markAll('absent')}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs rounded-lg font-medium transition-colors cursor-pointer"
            >
              All Absent
            </button>
          </div>

          <button
            onClick={handleSaveAttendance}
            className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
              isSaved
                ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                : 'bg-[#C88A35] hover:bg-[#B37929] text-white shadow-[#C88A35]/20'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaved ? 'Attendance Saved ✓' : 'Save Attendance'}
          </button>
        </div>

        {/* Mobile Student Attendance Cards View (< md) */}
        <div className="md:hidden divide-y divide-gray-100">
          {batchStudents.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-xs">
              No active students enrolled in this batch yet.
            </div>
          ) : (
            batchStudents.map((student) => {
              const currentStatus = attendanceMap[student.id]?.status || 'present';

              return (
                <div key={student.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                        {student.rollNo && (
                          <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            #{student.rollNo}
                          </span>
                        )}
                        <span>{student.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{student.enrollmentNo}</span>
                    </div>

                    {currentStatus === 'absent' && (
                      <button
                        onClick={() => {
                          if (!selectedBatch) return;
                          sendAbsentAlertWhatsApp(
                            {
                              id: `temp-${student.id}`,
                              date: selectedDate,
                              batchId: selectedBatch.id,
                              batchName: selectedBatch.name,
                              studentId: student.id,
                              studentName: student.name,
                              rollNo: student.rollNo,
                              status: 'absent',
                              createdAt: new Date().toISOString()
                            },
                            student.parentMobile,
                            shopProfile
                          );
                        }}
                        className="px-2.5 py-1 bg-red-50 text-red-700 font-bold rounded-lg text-[10px] flex items-center gap-1 border border-red-200"
                      >
                        <Smartphone className="w-3 h-3" />
                        Alert Parent
                      </button>
                    )}
                  </div>

                  {/* Big Thumb-friendly status buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((st) => {
                      const isActive = currentStatus === st;
                      const label = st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'late' ? 'L' : 'E';
                      const fullLabel = st === 'present' ? 'Present' : st === 'absent' ? 'Absent' : st === 'late' ? 'Late' : 'Excused';

                      return (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(student.id, st)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                            isActive
                              ? st === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : st === 'absent'
                                ? 'bg-red-600 text-white shadow-xs'
                                : st === 'late'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-blue-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {fullLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Students Table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Roll</th>
                <th className="py-3 px-4">Student Name & ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Remarks / Excuse</th>
                <th className="py-3 px-4 text-right">Parent WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batchStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No active students enrolled in this batch yet.
                  </td>
                </tr>
              ) : (
                batchStudents.map((student) => {
                  const currentStatus = attendanceMap[student.id]?.status || 'present';
                  const currentRemarks = attendanceMap[student.id]?.remarks || '';

                  return (
                    <tr key={student.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-700">
                        {student.rollNo || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900 block text-sm">{student.name}</span>
                        <span className="font-mono text-gray-400 text-[10px]">{student.enrollmentNo}</span>
                      </td>

                      {/* Status Pills */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => handleStatusChange(student.id, st)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                                currentStatus === st
                                  ? st === 'present'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'absent'
                                    ? 'bg-red-600 text-white'
                                    : st === 'late'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Add remark..."
                          value={currentRemarks}
                          onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                          className="w-full px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                        />
                      </td>

                      {/* Absent Parent Alert WhatsApp */}
                      <td className="py-3 px-4 text-right">
                        {currentStatus === 'absent' ? (
                          <button
                            onClick={() => {
                              if (!selectedBatch) return;
                              sendAbsentAlertWhatsApp(
                                {
                                  id: `temp-${student.id}`,
                                  date: selectedDate,
                                  batchId: selectedBatch.id,
                                  batchName: selectedBatch.name,
                                  studentId: student.id,
                                  studentName: student.name,
                                  rollNo: student.rollNo,
                                  status: 'absent',
                                  createdAt: new Date().toISOString()
                                },
                                student.parentMobile,
                                shopProfile
                              );
                            }}
                            className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            Send Absent Alert
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px] font-mono">
                            {student.parentMobile}
                          </span>
                        )}
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
