import { create } from 'zustand';
import { Course, Batch } from '../types';
import { db } from '../lib/db';
import { INITIAL_COURSES, INITIAL_BATCHES } from '../lib/seedData';

interface CourseState {
  courses: Course[];
  batches: Batch[];
  isLoading: boolean;
  error: string | null;

  loadCoursesAndBatches: () => Promise<void>;
  addCourse: (courseData: Omit<Course, 'id' | 'createdAt'>) => Promise<Course>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  addBatch: (batchData: Omit<Batch, 'id' | 'createdAt'>) => Promise<Batch>;
  updateBatch: (id: string, updates: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;

  getCourseById: (id: string) => Course | undefined;
  getBatchById: (id: string) => Batch | undefined;
  getBatchesByCourse: (courseId: string) => Batch[];
}

export const useCourseStore = create<CourseState>((set, get) => ({
  courses: [],
  batches: [],
  isLoading: false,
  error: null,

  loadCoursesAndBatches: async () => {
    set({ isLoading: true, error: null });
    try {
      let localCourses = await db.courses.toArray();
      let localBatches = await db.batches.toArray();

      // If empty, initialize with seed courses & batches
      if (localCourses.length === 0) {
        await db.courses.bulkPut(INITIAL_COURSES);
        localCourses = INITIAL_COURSES;
      }
      if (localBatches.length === 0) {
        await db.batches.bulkPut(INITIAL_BATCHES);
        localBatches = INITIAL_BATCHES;
      }

      set({
        courses: localCourses.sort((a, b) => a.name.localeCompare(b.name)),
        batches: localBatches.sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false
      });
    } catch (err: any) {
      console.error('Failed to load courses & batches from Dexie:', err);
      set({ error: err?.message || 'Failed to load courses', isLoading: false });
    }
  },

  addCourse: async (courseData) => {
    const newCourse: Course = {
      ...courseData,
      id: 'course-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    await db.courses.put(newCourse);
    set((state) => ({
      courses: [...state.courses, newCourse].sort((a, b) => a.name.localeCompare(b.name))
    }));
    return newCourse;
  },

  updateCourse: async (id, updates) => {
    const existing = get().courses.find((c) => c.id === id);
    if (!existing) return;
    const updated: Course = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await db.courses.put(updated);
    set((state) => ({
      courses: state.courses.map((c) => (c.id === id ? updated : c))
    }));
  },

  deleteCourse: async (id) => {
    await db.courses.delete(id);
    set((state) => ({
      courses: state.courses.filter((c) => c.id !== id),
      batches: state.batches.filter((b) => b.courseId !== id)
    }));
  },

  addBatch: async (batchData) => {
    const newBatch: Batch = {
      ...batchData,
      id: 'batch-' + Date.now(),
      currentStrength: batchData.currentStrength || 0,
      createdAt: new Date().toISOString()
    };
    await db.batches.put(newBatch);
    set((state) => ({
      batches: [...state.batches, newBatch].sort((a, b) => a.name.localeCompare(b.name))
    }));
    return newBatch;
  },

  updateBatch: async (id, updates) => {
    const existing = get().batches.find((b) => b.id === id);
    if (!existing) return;
    const updated: Batch = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await db.batches.put(updated);
    set((state) => ({
      batches: state.batches.map((b) => (b.id === id ? updated : b))
    }));
  },

  deleteBatch: async (id) => {
    await db.batches.delete(id);
    set((state) => ({
      batches: state.batches.filter((b) => b.id !== id)
    }));
  },

  getCourseById: (id) => get().courses.find((c) => c.id === id),
  getBatchById: (id) => get().batches.find((b) => b.id === id),
  getBatchesByCourse: (courseId) => get().batches.filter((b) => b.courseId === courseId)
}));
