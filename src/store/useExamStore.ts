import { create } from 'zustand';
import { Exam, ExamScore } from '../types';
import { db } from '../lib/db';
import { INITIAL_EXAMS } from '../lib/seedData';

interface StudentScoreInput {
  studentId: string;
  studentName: string;
  rollNo?: string;
  marksObtained: number;
  isAbsent: boolean;
  remarks?: string;
}

interface ExamState {
  exams: Exam[];
  examScores: ExamScore[];
  isLoading: boolean;
  error: string | null;

  loadExamsAndScores: () => Promise<void>;
  createExam: (examData: Omit<Exam, 'id' | 'createdAt'>) => Promise<Exam>;
  updateExam: (id: string, updates: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  saveExamScores: (examId: string, scores: StudentScoreInput[]) => Promise<void>;
  getScoresForExam: (examId: string) => ExamScore[];
  getStudentScores: (studentId: string) => { exam: Exam; score: ExamScore }[];
}

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 35) return 'D';
  return 'F';
}

export const useExamStore = create<ExamState>((set, get) => ({
  exams: [],
  examScores: [],
  isLoading: false,
  error: null,

  loadExamsAndScores: async () => {
    set({ isLoading: true, error: null });
    try {
      let localExams = await db.exams.toArray();
      let localScores = await db.examScores.toArray();

      if (localExams.length === 0) {
        await db.exams.bulkPut(INITIAL_EXAMS);
        localExams = INITIAL_EXAMS;
      }

      set({
        exams: localExams.sort((a, b) => b.examDate.localeCompare(a.examDate)),
        examScores: localScores,
        isLoading: false
      });
    } catch (err: any) {
      console.error('Failed to load exams & scores from Dexie:', err);
      set({ error: err?.message || 'Failed to load exams', isLoading: false });
    }
  },

  createExam: async (examData) => {
    const newExam: Exam = {
      ...examData,
      id: 'exam-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    await db.exams.put(newExam);
    set((state) => ({
      exams: [newExam, ...state.exams]
    }));
    return newExam;
  },

  updateExam: async (id, updates) => {
    const existing = get().exams.find((e) => e.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await db.exams.put(updated);
    set((state) => ({
      exams: state.exams.map((e) => (e.id === id ? updated : e))
    }));
  },

  deleteExam: async (id) => {
    await db.exams.delete(id);
    await db.examScores.where('examId').equals(id).delete();
    set((state) => ({
      exams: state.exams.filter((e) => e.id !== id),
      examScores: state.examScores.filter((s) => s.examId !== id)
    }));
  },

  saveExamScores: async (examId, scoreInputs) => {
    const exam = get().exams.find((e) => e.id === examId);
    if (!exam) throw new Error('Exam not found');

    // Sort by marks descending to compute ranks for present students
    const sorted = [...scoreInputs].sort((a, b) => {
      if (a.isAbsent && !b.isAbsent) return 1;
      if (!a.isAbsent && b.isAbsent) return -1;
      return b.marksObtained - a.marksObtained;
    });

    let currentRank = 1;
    const computedScores: ExamScore[] = sorted.map((s) => {
      const percentage = exam.maxMarks > 0 && !s.isAbsent
        ? Math.round((s.marksObtained / exam.maxMarks) * 100)
        : 0;
      const grade = s.isAbsent ? 'AB' : calculateGrade(percentage);
      const rank = s.isAbsent ? undefined : currentRank++;

      return {
        id: `score-${examId}-${s.studentId}`,
        examId,
        studentId: s.studentId,
        studentName: s.studentName,
        rollNo: s.rollNo,
        marksObtained: s.isAbsent ? 0 : s.marksObtained,
        isAbsent: s.isAbsent,
        percentage,
        grade,
        rank,
        remarks: s.remarks,
        notifiedParent: false,
        createdAt: new Date().toISOString()
      };
    });

    await db.examScores.bulkPut(computedScores);

    // Filter out previous scores for this exam
    const otherScores = get().examScores.filter((s) => s.examId !== examId);
    set({
      examScores: [...computedScores, ...otherScores]
    });
  },

  getScoresForExam: (examId) => {
    return get().examScores.filter((s) => s.examId === examId);
  },

  getStudentScores: (studentId) => {
    const exams = get().exams;
    const scores = get().examScores.filter((s) => s.studentId === studentId);

    const result: { exam: Exam; score: ExamScore }[] = [];
    for (const score of scores) {
      const exam = exams.find((e) => e.id === score.examId);
      if (exam) {
        result.push({ exam, score });
      }
    }
    return result;
  }
}));
