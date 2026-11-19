import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  BookOpen,
  Award,
  MoreVertical,
  Edit,
  Trash2,
  IdCard,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Printer
} from 'lucide-react';
import { useStudentStore } from '../../store/useStudentStore';
import { useCourseStore } from '../../store/useCourseStore';
import { useFeeStore } from '../../store/useFeeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Student, Gender, AcademicBoard, SUPPORTED_STANDARDS } from '../../types';

export function StudentsSection() {
  const { students, loadStudents, addStudent, updateStudent, deleteStudent, generateNextEnrollmentNo } = useStudentStore();
  const { courses, batches, loadCoursesAndBatches } = useCourseStore();
  const { createFeePlanForStudent } = useFeeStore();
  const { shopProfile } = useSettingsStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Modals state
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Admission Form State
  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [standard, setStandard] = useState('Class 10');
  const [stream, setStream] = useState('Foundation');
  const [schoolName, setSchoolName] = useState('');
  const [board, setBoard] = useState<AcademicBoard>('CBSE');
  const [fatherName, setFatherName] = useState('');
  const [parentMobile, setParentMobile] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [scholarshipPct, setScholarshipPct] = useState<number>(0);
  const [scholarshipReason, setScholarshipReason] = useState<string>('');

  useEffect(() => {
    loadStudents();
    loadCoursesAndBatches();
  }, []);

  const openNewAdmission = async () => {
    const nextNo = await generateNextEnrollmentNo();
    setEnrollmentNo(nextNo);
    setName('');
    setRollNo('');
    setGender('male');
    setDob('');
    setSchoolName('');
    setFatherName('');
    setParentMobile('');
    setWhatsappNumber('');
    setEmail('');
    setAddress('');
    setSelectedBatchIds([]);
    setSelectedCourseId(courses[0]?.id || '');
    setScholarshipPct(0);
    setScholarshipReason('');
    setIsAdmissionModalOpen(true);
  };

  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !parentMobile || !standard) return;

    try {
      const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
      const totalBaseFee = selectedCourse ? selectedCourse.totalFee : 0;
      const discount = Math.round((totalBaseFee * scholarshipPct) / 100);
      const netAssigned = totalBaseFee - discount;

      const newStudent = await addStudent({
        enrollmentNo,
        name,
        rollNo,
        gender,
        dob,
        bloodGroup,
        standard,
        stream,
        schoolName,
        board,
        fatherName,
        parentMobile,
        whatsappNumber: whatsappNumber || parentMobile,
        email,
        address,
        joiningDate: new Date().toISOString().split('T')[0],
        batchIds: selectedBatchIds,
        status: 'active',
        discountScholarshipPct: scholarshipPct,
        totalFeeAssigned: netAssigned,
        totalFeePaid: 0,
        feeBalanceDue: netAssigned
      });

      // Automatically create their fee plan if course selected
      if (selectedCourse) {
        await createFeePlanForStudent(newStudent, selectedCourse, scholarshipPct, scholarshipReason);
      }

      setIsAdmissionModalOpen(false);
    } catch (err: any) {
      alert('Error admitting student: ' + err?.message);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !searchTerm.trim() ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.enrollmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.rollNo && s.rollNo.includes(searchTerm)) ||
        s.parentMobile.includes(searchTerm);

      const matchStandard = selectedStandard === 'all' || s.standard === selectedStandard;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchSearch && matchStandard && matchStatus;
    });
  }, [students, searchTerm, selectedStandard, statusFilter]);

  const allStandards = useMemo(() => {
    return [...SUPPORTED_STANDARDS];
  }, []);

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C88A35]" />
            Student Directory & Admissions
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Total Enrolled: {students.filter((s) => s.status === 'active').length} Active Students
          </p>
        </div>

        <button
          onClick={openNewAdmission}
          className="px-4 py-2.5 bg-[#C88A35] hover:bg-[#B37929] active:scale-98 text-white rounded-xl font-semibold shadow-xs shadow-[#C88A35]/20 flex items-center gap-2 transition-all cursor-pointer text-sm"
        >
          <UserPlus className="w-4 h-4" />
          New Admission
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          {(['active', 'all', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#14213D] text-[#E0A96D] shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab}
            </button>
          ))}

          {/* Standard Filter Dropdown */}
          <select
            value={selectedStandard}
            onChange={(e) => setSelectedStandard(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Standards / Classes</option>
            {allStandards.map((std) => (
              <option key={std} value={std}>
                {std}
              </option>
            ))}
          </select>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search student by name, phone, roll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Students Data Table (Desktop) / Cards (Mobile) */}
      {/* Mobile Card List View (< md) */}
      <div className="md:hidden space-y-3">
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">
            No students found matching your search.
          </div>
        ) : (
          filteredStudents.map((student) => {
            const hasDue = (student.feeBalanceDue || 0) > 0;

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-800 font-bold flex items-center justify-center text-base border border-emerald-500/30">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{student.name}</h3>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono mt-0.5">
                        <span className="text-emerald-700 font-bold">{student.standard}</span>
                        <span>•</span>
                        <span>{student.enrollmentNo}</span>
                        {student.rollNo && <span>• Roll: {student.rollNo}</span>}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                      hasDue ? 'bg-red-50 text-red-700 border border-red-200/60' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                    }`}
                  >
                    {hasDue ? `Due ₹${(student.feeBalanceDue || 0).toLocaleString('en-IN')}` : 'Cleared ✓'}
                  </span>
                </div>

                {/* Parent info & school */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                  <span className="truncate max-w-[180px]">{student.schoolName || student.fatherName || 'Guardian'}</span>
                  <span className="font-mono text-gray-700">{student.parentMobile}</span>
                </div>

                {/* 1-Tap Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <a
                    href={`tel:${student.parentMobile}`}
                    className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    Call
                  </a>
                  <a
                    href={`https://wa.me/91${student.parentMobile.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-200"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    WhatsApp
                  </a>
                  <button
                    onClick={() => setSelectedStudentForIdCard(student)}
                    className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    <IdCard className="w-3.5 h-3.5 text-purple-600" />
                    ID Card
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button on Mobile for + New Admission */}
      <div className="md:hidden fixed bottom-20 right-4 z-30">
        <button
          onClick={openNewAdmission}
          className="w-14 h-14 rounded-2xl bg-[#C88A35] hover:bg-[#B37929] text-white shadow-xl shadow-[#C88A35]/30 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          title="New Student Admission"
        >
          <UserPlus className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Data Table (hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Student Name & ID</th>
                <th className="py-3 px-3">Class & School</th>
                <th className="py-3 px-3">Parent Contact</th>
                <th className="py-3 px-3">Fee Status</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-[#FAF7F0] transition-colors">
                    {/* Student Name & ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#14213D] text-[#E0A96D] font-bold flex items-center justify-center text-sm border border-[#C88A35]/30">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-stone-900 text-sm block">{student.name}</span>
                          <span className="font-mono text-[10px] text-stone-400">
                            {student.enrollmentNo} {student.rollNo && `• Roll: ${student.rollNo}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Class & School */}
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-stone-800 block">{student.standard}</span>
                      <span className="text-stone-400 text-[10px] truncate max-w-[150px] block">
                        {student.schoolName || student.stream || 'N/A'}
                      </span>
                    </td>

                    {/* Parent Contact */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 text-stone-700 font-mono">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{student.parentMobile}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 block">{student.fatherName || 'Guardian'}</span>
                    </td>

                    {/* Fee Status */}
                    <td className="py-3.5 px-3">
                      <div className="font-mono font-bold text-xs">
                        {(student.feeBalanceDue || 0) <= 0 ? (
                          <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] border border-emerald-200">
                            CLEARED
                          </span>
                        ) : (
                          <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md text-[10px] border border-red-200">
                            DUE: ₹{(student.feeBalanceDue || 0).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        Paid: ₹{(student.totalFeePaid || 0).toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase ${
                          student.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedStudentForIdCard(student)}
                          className="p-1.5 hover:bg-[#FAF7F0] text-[#C88A35] rounded-lg transition-colors cursor-pointer"
                          title="Print Student ID Card"
                        >
                          <IdCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete student ${student.name}?`)) {
                              deleteStudent(student.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW ADMISSION MODAL */}
      {isAdmissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#0A1220] flex items-center justify-between bg-[#14213D] text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#E0A96D]" />
                <h3 className="font-bold text-base">New Student Admission</h3>
              </div>
              <button
                onClick={() => setIsAdmissionModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdmissionSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Section 1: Academic & Identification */}
              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3 border-b border-gray-200 pb-1">
                  1. Academic Details & ID
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Enrollment ID *</label>
                    <input
                      type="text"
                      value={enrollmentNo}
                      onChange={(e) => setEnrollmentNo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-bold bg-gray-50 text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Standard / Class *</label>
                    <select
                      value={standard}
                      onChange={(e) => setStandard(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-800"
                    >
                      {SUPPORTED_STANDARDS.map((std) => (
                        <option key={std} value={std}>
                          {std}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Roll Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 01"
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Student Personal Info */}
              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3 border-b border-gray-200 pb-1">
                  2. Student Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-gray-700 font-medium mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-800"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">School Name</label>
                    <input
                      type="text"
                      placeholder="e.g. DPS School"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Board</label>
                    <select
                      value={board}
                      onChange={(e) => setBoard(e.target.value as AcademicBoard)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-800"
                    >
                      <option value="CBSE">CBSE</option>
                      <option value="ICSE">ICSE</option>
                      <option value="State Board">State Board</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Blood Group</label>
                    <input
                      type="text"
                      placeholder="e.g. B+"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Parent & Communication */}
              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3 border-b border-gray-200 pb-1">
                  3. Parent & Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Father / Guardian Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Sharma"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Parent Mobile *</label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      value={parentMobile}
                      onChange={(e) => setParentMobile(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      placeholder="Defaults to parent mobile"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Course, Batch & Fee Plan */}
              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3 border-b border-gray-200 pb-1">
                  4. Course & Fee Allocation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Enrolling Course</label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-800"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (₹{c.totalFee.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Scholarship / Merit Concession (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scholarshipPct}
                      onChange={(e) => setScholarshipPct(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdmissionModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT ID CARD MODAL */}
      {selectedStudentForIdCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <IdCard className="w-4 h-4 text-emerald-600" />
                Student Identity Card
              </h3>
              <button
                onClick={() => setSelectedStudentForIdCard(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable ID Card Container */}
            <div className="border-2 border-emerald-600 rounded-2xl overflow-hidden shadow-md bg-white text-gray-800 p-5 relative">
              {/* Header */}
              <div className="text-center pb-3 border-b-2 border-emerald-600">
                <h4 className="font-black text-sm uppercase tracking-tight text-slate-900">
                  {shopProfile.shopName && !shopProfile.shopName.toLowerCase().includes('retail') ? shopProfile.shopName : 'WebRajya Tuition'}
                </h4>
                <p className="text-[9px] text-emerald-700 font-bold uppercase">{shopProfile.tagline}</p>
                <p className="text-[9px] text-gray-500 font-mono mt-0.5">{shopProfile.phone}</p>
              </div>

              {/* Photo & Main Details */}
              <div className="flex gap-4 items-center my-4">
                <div className="w-20 h-24 bg-gray-100 border border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 shrink-0">
                  <Users className="w-8 h-8 opacity-40 mb-1" />
                  <span className="text-[8px]">Photo</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-gray-900 text-sm">{selectedStudentForIdCard.name}</div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    ID: <strong className="text-emerald-800">{selectedStudentForIdCard.enrollmentNo}</strong>
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Class: <span className="font-medium text-gray-900">{selectedStudentForIdCard.standard}</span>
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Roll: <span className="font-mono">{selectedStudentForIdCard.rollNo || 'N/A'}</span> • Blood: {selectedStudentForIdCard.bloodGroup || 'B+'}
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    Parent: {selectedStudentForIdCard.parentMobile}
                  </div>
                </div>
              </div>

              {/* Barcode & Footer */}
              <div className="pt-2 border-t border-dashed border-gray-300 flex items-center justify-between">
                <div className="text-[8px] text-gray-400 font-mono">
                  VALID: 2026-2027<br />
                  Emergency: {shopProfile.phone}
                </div>
                <div className="text-right">
                  <div className="h-6 border-b border-gray-400 w-20 mb-0.5"></div>
                  <span className="text-[8px] text-gray-500 block">Director Signature</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print ID Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
