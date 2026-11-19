import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  Users,
  Plus,
  Trash2,
  Edit,
  GraduationCap,
  Sparkles,
  X
} from 'lucide-react';
import { useCourseStore } from '../../store/useCourseStore';
import { useStudentStore } from '../../store/useStudentStore';
import { Course, Batch, SUPPORTED_STANDARDS } from '../../types';

export function CoursesBatchesSection() {
  const { courses, batches, loadCoursesAndBatches, addCourse, deleteCourse, addBatch, deleteBatch } = useCourseStore();
  const { students, loadStudents } = useStudentStore();

  const [activeTab, setActiveTab] = useState<'batches' | 'courses'>('batches');
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);

  // Course Form
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseStandard, setCourseStandard] = useState('Class 10');
  const [courseStream, setCourseStream] = useState('Foundation');
  const [courseSubjects, setCourseSubjects] = useState('Physics, Chemistry, Maths');
  const [courseDuration, setCourseDuration] = useState(12);
  const [courseFee, setCourseFee] = useState(40000);
  const [courseInstallments, setCourseInstallments] = useState(3);

  // Batch Form
  const [batchName, setBatchName] = useState('');
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchStandard, setBatchStandard] = useState('Class 10');
  const [batchTiming, setBatchTiming] = useState('04:30 PM - 06:30 PM');
  const [batchDays, setBatchDays] = useState('Mon, Wed, Fri');
  const [batchClassroom, setBatchClassroom] = useState('Room 101');
  const [batchFaculty, setBatchFaculty] = useState('Er. R. K. Verma');
  const [batchCapacity, setBatchCapacity] = useState(35);

  useEffect(() => {
    loadCoursesAndBatches();
    loadStudents();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName || !courseStandard) return;

    await addCourse({
      code: courseCode || `CRS-${Date.now().toString().slice(-4)}`,
      name: courseName,
      standard: courseStandard,
      stream: courseStream,
      subjects: courseSubjects.split(',').map((s) => s.trim()).filter(Boolean),
      durationMonths: Number(courseDuration) || 12,
      totalFee: Number(courseFee) || 0,
      admissionFee: Math.round((Number(courseFee) || 0) * 0.2),
      installmentCount: Number(courseInstallments) || 1,
      isActive: true
    });

    setIsAddCourseModalOpen(false);
    setCourseName('');
    setCourseCode('');
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName) return;

    const selectedCourse = courses.find((c) => c.id === batchCourseId) || courses[0];

    await addBatch({
      name: batchName,
      courseId: selectedCourse?.id || '',
      courseName: selectedCourse?.name || 'General Course',
      standard: batchStandard,
      timing: batchTiming,
      days: batchDays.split(',').map((d) => d.trim()).filter(Boolean),
      classroom: batchClassroom,
      facultyName: batchFaculty,
      maxCapacity: Number(batchCapacity) || 40,
      currentStrength: 0,
      academicYear: '2026-2027',
      isActive: true
    });

    setIsAddBatchModalOpen(false);
    setBatchName('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#C88A35]" />
            Courses & Batches Scheduling
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure subjects, academic fee structures, classroom schedules and teacher allocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-stone-100 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'batches' ? 'bg-[#14213D] text-[#E0A96D] shadow-xs' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Batches ({batches.length})
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'courses' ? 'bg-[#14213D] text-[#E0A96D] shadow-xs' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Courses ({courses.length})
            </button>
          </div>

          {activeTab === 'batches' ? (
            <button
              onClick={() => {
                setBatchCourseId(courses[0]?.id || '');
                setIsAddBatchModalOpen(true);
              }}
              className="px-3.5 py-2 bg-[#C88A35] hover:bg-[#B37929] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Batch
            </button>
          ) : (
            <button
              onClick={() => setIsAddCourseModalOpen(true)}
              className="px-3.5 py-2 bg-[#C88A35] hover:bg-[#B37929] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </button>
          )}
        </div>
      </div>

      {/* BATCHES VIEW */}
      {activeTab === 'batches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {batches.map((batch) => {
            const enrolledStudents = students.filter((s) => s.batchIds.includes(batch.id));
            const occupancyPct = Math.round((enrolledStudents.length / (batch.maxCapacity || 40)) * 100);

            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:border-emerald-300 transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {batch.standard}
                      </span>
                      <h3 className="font-bold text-gray-900 text-base mt-1.5">{batch.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{batch.courseName}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete batch "${batch.name}"?`)) deleteBatch(batch.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Batch Details List */}
                  <div className="space-y-2 mt-4 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{batch.timing}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {batch.days.map((day) => (
                          <span key={day} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>Faculty: <strong>{batch.facultyName || 'TBD'}</strong></span>
                    </div>
                    {batch.classroom && (
                      <div className="text-[11px] text-gray-400 pl-6">
                        Classroom: {batch.classroom}
                      </div>
                    )}
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-gray-500">Students Enrolled</span>
                    <span className="font-mono font-bold text-gray-800">
                      {enrolledStudents.length} / {batch.maxCapacity}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        occupancyPct > 90 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, occupancyPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COURSES VIEW */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">
                      {course.code}
                    </span>
                    <h3 className="font-bold text-gray-900 text-base mt-1.5">{course.name}</h3>
                    <span className="text-xs text-gray-500">{course.standard} • {course.stream}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete course "${course.name}"?`)) deleteCourse(course.id);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {course.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{course.description}</p>
                )}

                {/* Subjects tags */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {course.subjects.map((sub) => (
                    <span key={sub} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200/60">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fee and installment metrics */}
              <div className="pt-3 border-t border-gray-100 bg-gray-50/60 -mx-5 -mb-5 p-4 rounded-b-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Standard Fee</span>
                  <span className="font-mono text-base font-bold text-emerald-800">
                    ₹{course.totalFee.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase">Installments</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {course.installmentCount} Partitions ({course.durationMonths} Mo)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE COURSE MODAL */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-bold text-sm">Add New Academic Course</h3>
              <button onClick={() => setIsAddCourseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Course Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Class 10 - Mathematics & Science"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Class / Standard *</label>
                  <select
                    value={courseStandard}
                    onChange={(e) => setCourseStandard(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-800"
                    required
                  >
                    {SUPPORTED_STANDARDS.map((std) => (
                      <option key={std} value={std}>
                        {std}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Stream / Category</label>
                  <input
                    type="text"
                    value={courseStream}
                    onChange={(e) => setCourseStream(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Subjects (Comma separated)</label>
                <input
                  type="text"
                  value={courseSubjects}
                  onChange={(e) => setCourseSubjects(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Total Course Fee (₹) *</label>
                  <input
                    type="number"
                    value={courseFee}
                    onChange={(e) => setCourseFee(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">No. of Installments</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={courseInstallments}
                    onChange={(e) => setCourseInstallments(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCourseModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BATCH MODAL */}
      {isAddBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-bold text-sm">Schedule New Batch</h3>
              <button onClick={() => setIsAddBatchModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Batch Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Class 10 Alpha Morning"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Associated Course *</label>
                <select
                  value={batchCourseId}
                  onChange={(e) => setBatchCourseId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.standard})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Timings (e.g. 7 AM - 9 AM)</label>
                  <input
                    type="text"
                    value={batchTiming}
                    onChange={(e) => setBatchTiming(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Days (e.g. Mon, Wed, Fri)</label>
                  <input
                    type="text"
                    value={batchDays}
                    onChange={(e) => setBatchDays(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Assigned Faculty / Teacher</label>
                  <input
                    type="text"
                    value={batchFaculty}
                    onChange={(e) => setBatchFaculty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Maximum Student Capacity</label>
                  <input
                    type="number"
                    value={batchCapacity}
                    onChange={(e) => setBatchCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBatchModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
                >
                  Schedule Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
