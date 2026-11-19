-- ============================================================================
-- WebRajya Tuition — Coaching Class & Institute ERP Schema
-- Migration: 20261117000001_coaching_class_schema.sql
-- Compatible with Supabase PostgreSQL (Supports Offline Sync & Realtime)
-- ============================================================================

-- Utility Function: Automated updated_at timestamp handler
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. Students Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    enrollment_no TEXT UNIQUE NOT NULL,
    roll_no TEXT,
    name TEXT NOT NULL,
    gender TEXT,
    dob DATE,
    blood_group TEXT,
    photo_url TEXT,
    standard TEXT NOT NULL,
    stream TEXT,
    school_name TEXT,
    board TEXT,
    father_name TEXT,
    mother_name TEXT,
    parent_mobile TEXT NOT NULL,
    student_mobile TEXT,
    whatsapp_number TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    joining_date DATE DEFAULT CURRENT_DATE,
    batch_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'alumni', 'dropped')),
    discount_scholarship_pct NUMERIC(5,2) DEFAULT 0,
    total_fee_assigned NUMERIC(12,2) DEFAULT 0,
    total_fee_paid NUMERIC(12,2) DEFAULT 0,
    fee_balance_due NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_students_updated_at ON public.students;
CREATE TRIGGER trigger_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Courses Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    standard TEXT NOT NULL,
    stream TEXT,
    description TEXT,
    subjects JSONB DEFAULT '[]'::jsonb,
    duration_months INT DEFAULT 12,
    total_fee NUMERIC(12,2) DEFAULT 0,
    admission_fee NUMERIC(12,2) DEFAULT 0,
    installment_count INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Batches Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    course_id TEXT REFERENCES public.courses(id) ON DELETE SET NULL,
    course_name TEXT,
    name TEXT NOT NULL,
    standard TEXT NOT NULL,
    timing TEXT,
    days JSONB DEFAULT '[]'::jsonb,
    classroom TEXT,
    faculty_name TEXT,
    max_capacity INT DEFAULT 40,
    current_strength INT DEFAULT 0,
    academic_year TEXT DEFAULT '2026-2027',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_batches_updated_at ON public.batches;
CREATE TRIGGER trigger_batches_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Fee Plans Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT,
    enrollment_no TEXT,
    course_id TEXT REFERENCES public.courses(id) ON DELETE SET NULL,
    course_name TEXT,
    standard TEXT,
    total_base_fee NUMERIC(12,2) DEFAULT 0,
    scholarship_discount_amount NUMERIC(12,2) DEFAULT 0,
    scholarship_reason TEXT,
    net_fee_payable NUMERIC(12,2) DEFAULT 0,
    admission_fee NUMERIC(12,2) DEFAULT 0,
    installments JSONB DEFAULT '[]'::jsonb,
    total_paid NUMERIC(12,2) DEFAULT 0,
    balance_due NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'partial', 'pending', 'overdue')),
    academic_year TEXT DEFAULT '2026-2027',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_fee_plans_updated_at ON public.fee_plans;
CREATE TRIGGER trigger_fee_plans_updated_at
BEFORE UPDATE ON public.fee_plans
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Fee Receipts Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_receipts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    receipt_number TEXT UNIQUE NOT NULL,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    enrollment_no TEXT,
    roll_no TEXT,
    student_name TEXT NOT NULL,
    standard TEXT,
    batch_names JSONB DEFAULT '[]'::jsonb,
    parent_name TEXT,
    parent_mobile TEXT,
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_time TEXT,
    installment_ids JSONB DEFAULT '[]'::jsonb,
    installment_titles JSONB DEFAULT '[]'::jsonb,
    base_amount NUMERIC(12,2) DEFAULT 0,
    late_fine NUMERIC(12,2) DEFAULT 0,
    discount_amount NUMERIC(12,2) DEFAULT 0,
    net_received NUMERIC(12,2) NOT NULL,
    balance_remaining NUMERIC(12,2) DEFAULT 0,
    payment_mode TEXT NOT NULL,
    transaction_ref TEXT,
    bank_name TEXT,
    notes TEXT,
    collected_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. Attendance Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    batch_id TEXT REFERENCES public.batches(id) ON DELETE CASCADE,
    batch_name TEXT,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT,
    roll_no TEXT,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks TEXT,
    notified_parent BOOLEAN DEFAULT false,
    marked_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. Exams Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exams (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    batch_id TEXT REFERENCES public.batches(id) ON DELETE CASCADE,
    batch_name TEXT,
    subject TEXT NOT NULL,
    exam_date DATE NOT NULL,
    max_marks NUMERIC(6,2) NOT NULL,
    passing_marks NUMERIC(6,2) DEFAULT 0,
    syllabus TEXT,
    academic_year TEXT DEFAULT '2026-2027',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. Exam Scores Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_scores (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    exam_id TEXT REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT,
    roll_no TEXT,
    marks_obtained NUMERIC(6,2) DEFAULT 0,
    is_absent BOOLEAN DEFAULT false,
    percentage NUMERIC(5,2) DEFAULT 0,
    grade TEXT,
    rank INT,
    remarks TEXT,
    notified_parent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. Coaching Expenses Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coaching_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    category TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_mode TEXT NOT NULL,
    paid_to TEXT,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    time TEXT,
    voucher_no TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_standard ON public.students(standard);
CREATE INDEX IF NOT EXISTS idx_students_mobile ON public.students(parent_mobile);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_batches_course ON public.batches(course_id);
CREATE INDEX IF NOT EXISTS idx_fee_plans_student ON public.fee_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_plans_status ON public.fee_plans(status);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_student ON public.fee_receipts(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_date ON public.fee_receipts(payment_date);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON public.attendance(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_batch ON public.exams(batch_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_exam ON public.exam_scores(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_student ON public.exam_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.coaching_expenses(date);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Configuration
-- ----------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_expenses ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for client offline-first synchronizer
DROP POLICY IF EXISTS "Allow all access to students" ON public.students;
CREATE POLICY "Allow all access to students" ON public.students FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to courses" ON public.courses;
CREATE POLICY "Allow all access to courses" ON public.courses FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to batches" ON public.batches;
CREATE POLICY "Allow all access to batches" ON public.batches FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to fee_plans" ON public.fee_plans;
CREATE POLICY "Allow all access to fee_plans" ON public.fee_plans FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to fee_receipts" ON public.fee_receipts;
CREATE POLICY "Allow all access to fee_receipts" ON public.fee_receipts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to attendance" ON public.attendance;
CREATE POLICY "Allow all access to attendance" ON public.attendance FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to exams" ON public.exams;
CREATE POLICY "Allow all access to exams" ON public.exams FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to exam_scores" ON public.exam_scores;
CREATE POLICY "Allow all access to exam_scores" ON public.exam_scores FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to coaching_expenses" ON public.coaching_expenses;
CREATE POLICY "Allow all access to coaching_expenses" ON public.coaching_expenses FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- Enable Supabase Realtime Publication for Multi-Device Live Sync
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'students'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.students, 
            public.courses, 
            public.batches, 
            public.fee_plans, 
            public.fee_receipts, 
            public.attendance, 
            public.exams, 
            public.exam_scores, 
            public.coaching_expenses;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Skip gracefully if publication is managed externally
END $$;
