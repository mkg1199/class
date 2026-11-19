import { create } from 'zustand';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { db } from '../lib/db';

interface BatchStudentAttendance {
  studentId: string;
  studentName: string;
  rollNo?: string;
  status: AttendanceStatus;
  remarks?: string;
}

interface AttendanceState {
  attendanceRecords: AttendanceRecord[];
  isLoading: boolean;
  error: string | null;

  loadAttendance: () => Promise<void>;
  markBatchAttendance: (
    batchId: string,
    batchName: string,
    date: string,
    studentsAttendance: BatchStudentAttendance[],
    markedBy?: string
  ) => Promise<void>;
  getAttendanceForBatchAndDate: (batchId: string, date: string) => AttendanceRecord[];
  getStudentAttendanceStats: (studentId: string) => {
    totalClasses: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  markParentAlertSent: (recordId: string) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  attendanceRecords: [],
  isLoading: false,
  error: null,

  loadAttendance: async () => {
    set({ isLoading: true, error: null });
    try {
      const records = await db.attendance.toArray();
      set({
        attendanceRecords: records.sort((a, b) => b.date.localeCompare(a.date)),
        isLoading: false
      });
    } catch (err: any) {
      console.error('Failed to load attendance from Dexie:', err);
      set({ error: err?.message || 'Failed to load attendance', isLoading: false });
    }
  },

  markBatchAttendance: async (batchId, batchName, date, studentsAttendance, markedBy = 'Faculty') => {
    const newRecords: AttendanceRecord[] = studentsAttendance.map((sa) => ({
      id: `att-${batchId}-${sa.studentId}-${date}`,
      date,
      batchId,
      batchName,
      studentId: sa.studentId,
      studentName: sa.studentName,
      rollNo: sa.rollNo,
      status: sa.status,
      remarks: sa.remarks,
      notifiedParent: false,
      markedBy,
      createdAt: new Date().toISOString()
    }));

    await db.attendance.bulkPut(newRecords);

    // Merge into store state
    const current = get().attendanceRecords.filter(
      (r) => !(r.batchId === batchId && r.date === date)
    );

    set({
      attendanceRecords: [...newRecords, ...current].sort((a, b) => b.date.localeCompare(a.date))
    });
  },

  getAttendanceForBatchAndDate: (batchId, date) => {
    return get().attendanceRecords.filter((r) => r.batchId === batchId && r.date === date);
  },

  getStudentAttendanceStats: (studentId) => {
    const studentRecords = get().attendanceRecords.filter((r) => r.studentId === studentId);
    const totalClasses = studentRecords.length;
    if (totalClasses === 0) {
      return { totalClasses: 0, present: 0, absent: 0, late: 0, percentage: 100 };
    }

    const present = studentRecords.filter((r) => r.status === 'present').length;
    const late = studentRecords.filter((r) => r.status === 'late').length;
    const absent = studentRecords.filter((r) => r.status === 'absent').length;

    // Late counts as 0.5 or present with delay
    const percentage = Math.round(((present + late * 0.8) / totalClasses) * 100);

    return { totalClasses, present, absent, late, percentage };
  },

  markParentAlertSent: async (recordId) => {
    const existing = get().attendanceRecords.find((r) => r.id === recordId);
    if (!existing) return;
    const updated = { ...existing, notifiedParent: true };
    await db.attendance.put(updated);
    set((state) => ({
      attendanceRecords: state.attendanceRecords.map((r) => (r.id === recordId ? updated : r))
    }));
  }
}));
