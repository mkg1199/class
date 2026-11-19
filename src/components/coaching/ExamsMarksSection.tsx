import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Smartphone,
  X,
  FileSpreadsheet,
  Trophy,
  Sparkles
} from 'lucide-react';
import { useCourseStore } from '../../store/useCourseStore';
import { useStudentStore } from '../../store/useStudentStore';
import { useExamStore } from '../../store/useExamStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Exam, ExamScore } from '../../types';
import { sendExamScoreWhatsApp } from '../../lib/coachingWhatsApp';

export function ExamsMarksSection() {
  const { batches, loadCoursesAndBatches } = useCourseStore();
  const { students, loadStudents } = useStudentStore();
  const { exams, examScores, loadExamsAndScores, createExam, deleteExam, saveExamScores, getScoresForExam } = useExamStore();
  const { shopProfile } = useSettingsStore();

  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);
  const [selectedExamForMarks, setSelectedExamForMarks] = useState<Exam | null>(null);
  const [selectedScoreForReport, setSelectedScoreForReport] = useState<{ exam: Exam; score: ExamScore } | null>(null);

  // New Exam Form
  const [examTitle, setExamTitle] = useState('');
  const [examBatchId, setExamBatchId] = useState('');
  const [examSubject, setExamSubject] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxMarks, setMaxMarks] = useState(50);
  const [passingMarks, setPassingMarks] = useState(20);
  const [syllabus, setSyllabus] = useState('');

  // Marks Entry Form state
  const [marksInputs, setMarksInputs] = useState<
    Record<string, { marksObtained: number; isAbsent: boolean; remarks: string }>
  >({});

  useEffect(() => {
    loadCoursesAndBatches();
    loadStudents();
    loadExamsAndScores();
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle || !examBatchId || !examSubject) return;

    const batch = batches.find((b) => b.id === examBatchId);

    await createExam({
      title: examTitle,
      batchId: examBatchId,
      batchName: batch ? batch.name : 'General Batch',
      subject: examSubject,
      examDate,
      maxMarks: Number(maxMarks) || 50,
      passingMarks: Number(passingMarks) || 20,
      syllabus,
      academicYear: '2026-2027'
    });

    setIsAddExamModalOpen(false);
    setExamTitle('');
    setExamSubject('');
    setSyllabus('');
  };

  const openMarksEntryModal = (exam: Exam) => {
    setSelectedExamForMarks(exam);
    const existingScores = getScoresForExam(exam.id);
    const batchStudents = students.filter((s) => s.batchIds.includes(exam.batchId));

    const initialInputs: Record<string, { marksObtained: number; isAbsent: boolean; remarks: string }> = {};

    batchStudents.forEach((student) => {
      const existing = existingScores.find((sc) => sc.studentId === student.id);
      if (existing) {
        initialInputs[student.id] = {
          marksObtained: existing.marksObtained,
          isAbsent: existing.isAbsent,
          remarks: existing.remarks || ''
        };
      } else {
        initialInputs[student.id] = {
          marksObtained: 0,
          isAbsent: false,
          remarks: ''
        };
      }
    });

    setMarksInputs(initialInputs);
  };

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForMarks) return;

    const batchStudents = students.filter((s) => s.batchIds.includes(selectedExamForMarks.batchId));

    const scoreData = batchStudents.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      rollNo: s.rollNo,
      marksObtained: Number(marksInputs[s.id]?.marksObtained) || 0,
      isAbsent: !!marksInputs[s.id]?.isAbsent,
      remarks: marksInputs[s.id]?.remarks || ''
    }));

    await saveExamScores(selectedExamForMarks.id, scoreData);
    setSelectedExamForMarks(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-600" />
            Exams, Test Series & Performance
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Schedule mock exams, enter batch test scores, compute automatic ranks and generate printable report cards
          </p>
        </div>

        <button
          onClick={() => {
            setExamBatchId(batches[0]?.id || '');
            setIsAddExamModalOpen(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Schedule New Test / Exam
        </button>
      </div>

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {exams.map((exam) => {
          const scores = getScoresForExam(exam.id);
          const topScore = scores.length > 0 ? Math.max(...scores.map((s) => (s.isAbsent ? 0 : s.marksObtained))) : null;
          const avgScore =
            scores.length > 0
              ? Math.round(
                  scores.reduce((acc, curr) => acc + (curr.isAbsent ? 0 : curr.marksObtained), 0) /
                    scores.filter((s) => !s.isAbsent).length || 1
                )
              : null;

          return (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {exam.subject}
                    </span>
                    <h3 className="font-bold text-gray-900 text-base mt-1.5">{exam.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{exam.batchName}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete exam "${exam.title}"?`)) deleteExam(exam.id);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{exam.examDate}</span>
                  </div>
                  <div className="font-mono">
                    Max: <strong>{exam.maxMarks} M</strong>
                  </div>
                </div>

                {/* Score Stats Badge */}
                {scores.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400 text-[10px] block">BATCH HIGHEST</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {topScore} / {exam.maxMarks}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">BATCH AVERAGE</span>
                      <span className="font-mono font-bold text-gray-800 text-sm">{avgScore} M</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => openMarksEntryModal(exam)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {scores.length > 0 ? 'Edit Marks' : 'Enter Marks'}
                </button>

                {scores.length > 0 && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {scores.length} Scored
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SCHEDULE EXAM MODAL */}
      {isAddExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-bold text-sm">Schedule Test / Exam</h3>
              <button onClick={() => setIsAddExamModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Test Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Unit Test 2: Laws of Motion & Friction"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Batch *</label>
                  <select
                    value={examBatchId}
                    onChange={(e) => setExamBatchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.standard})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Subject *</label>
                  <input
                    type="text"
                    placeholder="e.g. Physics"
                    value={examSubject}
                    onChange={(e) => setExamSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Exam Date</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Max Marks *</label>
                  <input
                    type="number"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Passing Marks</label>
                  <input
                    type="number"
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Syllabus / Chapters Included</label>
                <textarea
                  rows={2}
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  placeholder="e.g. NCERT Chapter 4 & 5 with derivations and HC Verma numericals"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddExamModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
                >
                  Schedule Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARKS ENTRY MODAL */}
      {selectedExamForMarks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h3 className="font-bold text-base">{selectedExamForMarks.title}</h3>
                <p className="text-xs text-slate-300">
                  {selectedExamForMarks.subject} • Max Marks: {selectedExamForMarks.maxMarks} • {selectedExamForMarks.batchName}
                </p>
              </div>
              <button
                onClick={() => setSelectedExamForMarks(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMarks} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Roll</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Absent?</th>
                      <th className="py-2.5 px-3">Marks Obtained (/{selectedExamForMarks.maxMarks})</th>
                      <th className="py-2.5 px-3">Teacher Remarks</th>
                      <th className="py-2.5 px-3 text-right">Report Card</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students
                      .filter((s) => s.batchIds.includes(selectedExamForMarks.batchId))
                      .map((student) => {
                        const isAbsent = !!marksInputs[student.id]?.isAbsent;
                        const marks = marksInputs[student.id]?.marksObtained || 0;
                        const remarks = marksInputs[student.id]?.remarks || '';

                        const scoreObj = examScores.find(
                          (sc) => sc.examId === selectedExamForMarks.id && sc.studentId === student.id
                        );

                        return (
                          <tr key={student.id} className="hover:bg-gray-50/70">
                            <td className="py-2.5 px-3 font-mono font-bold text-gray-700">
                              {student.rollNo || '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-gray-900 block">{student.name}</span>
                              <span className="font-mono text-gray-400 text-[10px]">{student.enrollmentNo}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                checked={isAbsent}
                                onChange={(e) =>
                                  setMarksInputs((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      isAbsent: e.target.checked
                                    }
                                  }))
                                }
                                className="w-4 h-4 text-red-600 rounded"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min={0}
                                max={selectedExamForMarks.maxMarks}
                                disabled={isAbsent}
                                value={isAbsent ? '' : marks}
                                onChange={(e) =>
                                  setMarksInputs((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      marksObtained: Number(e.target.value) || 0
                                    }
                                  }))
                                }
                                placeholder={isAbsent ? 'Absent' : '0'}
                                className="w-24 px-2.5 py-1 border border-gray-300 rounded-lg font-mono font-bold text-emerald-800 disabled:bg-gray-100"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                placeholder="Optional remark"
                                value={remarks}
                                onChange={(e) =>
                                  setMarksInputs((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      remarks: e.target.value
                                    }
                                  }))
                                }
                                className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {scoreObj && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedScoreForReport({
                                      exam: selectedExamForMarks,
                                      score: scoreObj
                                    })
                                  }
                                  className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg"
                                  title="Print Report Card"
                                >
                                  <Award className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedExamForMarks(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save & Compute Ranks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT REPORT CARD PREVIEW MODAL */}
      {selectedScoreForReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                Student Test Performance Report
              </h3>
              <button
                onClick={() => setSelectedScoreForReport(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Official Report Card Body */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-slate-50/50 space-y-4 printable-report">
              <div className="text-center pb-3 border-b border-emerald-600">
                <h4 className="font-black text-lg text-slate-900 uppercase">
                  {shopProfile.shopName && !shopProfile.shopName.toLowerCase().includes('retail')
                    ? shopProfile.shopName
                    : 'WebRajya Tuition'}
                </h4>
                <p className="text-[10px] text-emerald-800 font-bold uppercase">{shopProfile.tagline}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-900 font-bold text-xs rounded-md uppercase tracking-wider border border-emerald-200">
                  PROGRESS REPORT CARD
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 block text-[10px]">STUDENT NAME</span>
                  <span className="font-bold text-gray-900">{selectedScoreForReport.score.studentName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">ROLL NO / ENROLLMENT</span>
                  <span className="font-mono font-bold text-gray-900">
                    {selectedScoreForReport.score.rollNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">TEST TITLE</span>
                  <span className="font-medium text-gray-800">{selectedScoreForReport.exam.title}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">EXAM DATE</span>
                  <span className="font-medium text-gray-800">{selectedScoreForReport.exam.examDate}</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-700 text-white rounded-xl text-center space-y-1">
                <span className="text-xs text-emerald-200 font-medium uppercase">Marks Obtained</span>
                <div className="font-mono text-3xl font-black">
                  {selectedScoreForReport.score.isAbsent
                    ? 'ABSENT'
                    : `${selectedScoreForReport.score.marksObtained} / ${selectedScoreForReport.exam.maxMarks}`}
                </div>
                <div className="flex justify-center gap-4 text-xs pt-2 text-emerald-100">
                  <span>Percentage: <strong>{selectedScoreForReport.score.percentage}%</strong></span>
                  <span>Batch Rank: <strong>#{selectedScoreForReport.score.rank || 'N/A'}</strong></span>
                  <span>Grade: <strong>{selectedScoreForReport.score.grade}</strong></span>
                </div>
              </div>

              {selectedScoreForReport.score.remarks && (
                <div className="text-xs bg-white p-3 rounded-xl border border-gray-200">
                  <span className="text-gray-400 block text-[10px]">FACULTY REMARKS</span>
                  <span className="text-gray-800 italic font-medium">{selectedScoreForReport.score.remarks}</span>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-400">
                <span>WebRajya Academic Assessment Cell</span>
                <div className="text-center">
                  <div className="h-6 border-b border-gray-400 w-24 mb-0.5"></div>
                  <span className="text-gray-600 font-medium">Head of Department</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const student = students.find((s) => s.id === selectedScoreForReport.score.studentId);
                  if (student) {
                    sendExamScoreWhatsApp(
                      selectedScoreForReport.exam,
                      selectedScoreForReport.score,
                      student.parentMobile,
                      shopProfile
                    );
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Send on Parent WhatsApp
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
