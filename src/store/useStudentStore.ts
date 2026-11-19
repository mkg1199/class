import { create } from 'zustand';
import { Student } from '../types';
import { db } from '../lib/db';
import { INITIAL_STUDENTS } from '../lib/seedData';

interface StudentState {
  students: Student[];
  isLoading: boolean;
  error: string | null;

  loadStudents: () => Promise<void>;
  addStudent: (studentData: Omit<Student, 'id' | 'createdAt' | 'enrollmentNo'> & { enrollmentNo?: string }) => Promise<Student>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  getStudentById: (id: string) => Student | undefined;
  searchStudents: (term: string) => Student[];
  assignBatch: (studentId: string, batchId: string) => Promise<void>;
  removeBatch: (studentId: string, batchId: string) => Promise<void>;
  generateNextEnrollmentNo: () => Promise<string>;
}

export const useStudentStore = create<StudentState>((set, get) => ({
  students: [],
  isLoading: false,
  error: null,

  loadStudents: async () => {
    set({ isLoading: true, error: null });
    try {
      let localStudents = await db.students.toArray();
      if (localStudents.length === 0) {
        await db.students.bulkPut(INITIAL_STUDENTS);
        localStudents = INITIAL_STUDENTS;
      }
      set({
        students: localStudents.sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false
      });
    } catch (err: any) {
      console.error('Failed to load students from Dexie:', err);
      set({ error: err?.message || 'Failed to load students', isLoading: false });
    }
  },

  generateNextEnrollmentNo: async () => {
    const students = get().students;
    const year = new Date().getFullYear();
    const count = students.length + 1;
    const padded = String(count).padStart(3, '0');
    return `AA-${year}-${padded}`;
  },

  addStudent: async (studentData) => {
    const enrollmentNo = studentData.enrollmentNo || (await get().generateNextEnrollmentNo());
    const newStudent: Student = {
      ...studentData,
      id: 'stu-' + Date.now(),
      enrollmentNo,
      status: studentData.status || 'active',
      totalFeeAssigned: studentData.totalFeeAssigned || 0,
      totalFeePaid: studentData.totalFeePaid || 0,
      feeBalanceDue: (studentData.totalFeeAssigned || 0) - (studentData.totalFeePaid || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.students.put(newStudent);
    set((state) => ({
      students: [newStudent, ...state.students]
    }));
    return newStudent;
  },

  updateStudent: async (id, updates) => {
    const existing = get().students.find((s) => s.id === id);
    if (!existing) return;
    const totalAssigned = updates.totalFeeAssigned !== undefined ? updates.totalFeeAssigned : existing.totalFeeAssigned || 0;
    const totalPaid = updates.totalFeePaid !== undefined ? updates.totalFeePaid : existing.totalFeePaid || 0;
    const balanceDue = totalAssigned - totalPaid;

    const updated: Student = {
      ...existing,
      ...updates,
      feeBalanceDue: balanceDue,
      updatedAt: new Date().toISOString()
    };

    await db.students.put(updated);
    set((state) => ({
      students: state.students.map((s) => (s.id === id ? updated : s))
    }));
  },

  deleteStudent: async (id) => {
    await db.students.delete(id);
    set((state) => ({
      students: state.students.filter((s) => s.id !== id)
    }));
  },

  getStudentById: (id) => get().students.find((s) => s.id === id),

  searchStudents: (term) => {
    if (!term || !term.trim()) return get().students;
    const query = term.toLowerCase().trim();
    return get().students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.enrollmentNo.toLowerCase().includes(query) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(query)) ||
        s.parentMobile.includes(query) ||
        (s.whatsappNumber && s.whatsappNumber.includes(query)) ||
        s.standard.toLowerCase().includes(query)
    );
  },

  assignBatch: async (studentId, batchId) => {
    const student = get().getStudentById(studentId);
    if (!student) return;
    if (student.batchIds.includes(batchId)) return;
    const updatedBatchIds = [...student.batchIds, batchId];
    await get().updateStudent(studentId, { batchIds: updatedBatchIds });
  },

  removeBatch: async (studentId, batchId) => {
    const student = get().getStudentById(studentId);
    if (!student) return;
    const updatedBatchIds = student.batchIds.filter((b) => b !== batchId);
    await get().updateStudent(studentId, { batchIds: updatedBatchIds });
  }
}));
