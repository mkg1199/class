import { Student, Course, Batch, FeePlan, Exam } from '../types';
import { db } from './db';

// Clean empty arrays for production — zero dummy data
export const INITIAL_COURSES: Course[] = [];
export const INITIAL_BATCHES: Batch[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_FEE_PLANS: FeePlan[] = [];
export const INITIAL_EXAMS: Exam[] = [];

// Helper to remove any leftover demo records from Dexie IndexedDB
export async function clearAllDemoData(): Promise<void> {
  try {
    const demoStudentIds = ['stu-101', 'stu-102', 'stu-103'];
    const demoCourseIds = ['course-10-cbse', 'course-11-pcm', 'course-12-pcb', 'course-jee-dropper'];
    const demoBatchIds = ['batch-10-morn', 'batch-10-eve', 'batch-11-pcm', 'batch-12-pcb'];
    const demoPlanIds = ['plan-101'];
    const demoExamIds = ['exam-1', 'exam-2'];

    await Promise.all([
      db.students.bulkDelete(demoStudentIds),
      db.courses.bulkDelete(demoCourseIds),
      db.batches.bulkDelete(demoBatchIds),
      db.feePlans.bulkDelete(demoPlanIds),
      db.exams.bulkDelete(demoExamIds),
    ]);
  } catch (err) {
    console.warn('Could not clear some demo records:', err);
  }
}
