import { FeeReceipt, Student, AttendanceRecord, Exam, ExamScore, ShopProfile } from '../types';

export function sendFeeReceiptWhatsApp(receipt: FeeReceipt, profile: ShopProfile) {
  const cleanPhone = (receipt.parentMobile || '').replace(/\D/g, '');
  const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const instituteName = profile.shopName && !profile.shopName.toLowerCase().includes('retail') ? profile.shopName : 'WebRajya Tuition';
  const installmentText = receipt.installmentTitles.join(', ') || 'Fee Installment';

  const text = `🎓 *${instituteName.toUpperCase()}*
*FEE PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━
📄 *Receipt No:* ${receipt.receiptNumber}
📅 *Date:* ${receipt.paymentDate} (${receipt.paymentTime || ''})
👨‍🎓 *Student:* ${receipt.studentName}
🆔 *Enrollment No:* ${receipt.enrollmentNo}
📚 *Standard/Class:* ${receipt.standard}
💳 *Installment:* ${installmentText}
━━━━━━━━━━━━━━━━━━━━
💵 *Amount Paid:* ₹${receipt.netReceived.toLocaleString('en-IN')}
💰 *Payment Mode:* ${receipt.paymentMode.toUpperCase()} ${receipt.transactionRef ? `(${receipt.transactionRef})` : ''}
⚠️ *Remaining Due:* ₹${receipt.balanceRemaining.toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━
Thank you for your payment. For queries, call ${profile.phone || ''}.`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${targetPhone}?text=${encoded}`, '_blank');
}

export function sendFeeDueReminderWhatsApp(student: Student, dueAmount: number, dueDate: string, profile: ShopProfile) {
  const cleanPhone = (student.parentMobile || '').replace(/\D/g, '');
  const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const instituteName = profile.shopName && !profile.shopName.toLowerCase().includes('retail') ? profile.shopName : 'WebRajya Tuition';

  const text = `🔔 *FEES REMINDER NOTICE*
*${instituteName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━
Dear Parent / Guardian of *${student.name}* (ID: ${student.enrollmentNo}),

This is a gentle reminder that the upcoming fee installment of *₹${dueAmount.toLocaleString('en-IN')}* for *${student.standard}* is due on *${dueDate}*.

Kindly clear the outstanding dues to ensure uninterrupted classes, test series, and study materials.

*Bank / UPI Payment Details:*
📲 UPI ID: *${profile.upiId || 'apexacademy@upi'}*
🏦 Account: *${profile.accountNo || ''}* (IFSC: *${profile.ifscCode || ''}*)

If already paid, please ignore this notice.
Contact: ${profile.phone || ''}`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${targetPhone}?text=${encoded}`, '_blank');
}

export function sendAbsentAlertWhatsApp(attendance: AttendanceRecord, parentMobile: string, profile: ShopProfile) {
  const cleanPhone = parentMobile.replace(/\D/g, '');
  const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const instituteName = profile.shopName && !profile.shopName.toLowerCase().includes('retail') ? profile.shopName : 'WebRajya Tuition';

  const text = `⚠️ *ATTENDANCE ALERT*
*${instituteName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━
Dear Parent,
Your child *${attendance.studentName}* (Roll No: ${attendance.rollNo || 'N/A'}) was marked *ABSENT* in today's class on *${attendance.date}*.

*Batch:* ${attendance.batchName}

Regular attendance is mandatory for academic progress. If this absence was unplanned, please contact the institute office immediately at ${profile.phone || ''}.`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${targetPhone}?text=${encoded}`, '_blank');
}

export function sendExamScoreWhatsApp(exam: Exam, score: ExamScore, parentMobile: string, profile: ShopProfile) {
  const cleanPhone = parentMobile.replace(/\D/g, '');
  const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const instituteName = profile.shopName && !profile.shopName.toLowerCase().includes('retail') ? profile.shopName : 'WebRajya Tuition';

  const statusText = score.isAbsent ? 'ABSENT' : `${score.marksObtained} / ${exam.maxMarks} (${score.percentage}%)`;

  const text = `📊 *TEST PERFORMANCE REPORT*
*${instituteName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━
Dear Parent,
Here are the test results for *${score.studentName}*:

📝 *Test Name:* ${exam.title}
📚 *Subject:* ${exam.subject}
📅 *Exam Date:* ${exam.examDate}
━━━━━━━━━━━━━━━━━━━━
🎯 *Score Obtained:* ${statusText}
🏆 *Batch Rank:* ${score.rank ? `#${score.rank}` : 'N/A'}
🎖️ *Grade:* ${score.grade || 'N/A'}
${score.remarks ? `💬 *Faculty Remarks:* ${score.remarks}` : ''}
━━━━━━━━━━━━━━━━━━━━
We encourage you to review their preparation. For mentorship discussion, contact ${profile.phone || ''}.`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${targetPhone}?text=${encoded}`, '_blank');
}
