export type Role = "admin" | "teacher" | "student";

export type Me = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  nationalId?: string | null;
};

export type ClassInfo = {
  id: number;
  name: string;
  grade: number;
  field: string;
  room?: string | null;
  academicYear?: string;
  studentCount?: number;
  homeroomName?: string | null;
  homeroomTeacherId?: number | null;
  teacherCount?: number;
  homeroom?: string | null;
};

export type SubjectInfo = {
  id: number;
  name: string;
  code: string;
  color: string;
  weeklyHours: number;
};

export type TeachingItem = {
  id: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  teacherId: number;
  teacherName: string;
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  imageUrl?: string | null;
  audience: "all" | "students" | "teachers" | "class";
  isPinned: boolean;
  createdAt: string;
  expiresAt?: string | null;
  authorId?: number;
  authorName: string;
  authorRole?: Role;
  authorColor?: string;
  authorAvatar?: string | null;
  classId: number | null;
  className?: string | null;
};

export type AssignmentItem = {
  id: number;
  title: string;
  description: string;
  imageUrl?: string | null;
  dueAt: string;
  createdAt?: string;
  maxScore: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  teacherId: number;
  teacherName: string;
  submissionCount?: number;
  gradedCount?: number;
  studentCount?: number;
  mySubmissionId?: number | null;
  mySubmissionStatus?: string | null;
  myScore?: string | null;
};

export type SubmissionItem = {
  id: number;
  studentId: number;
  studentName: string;
  studentColor: string;
  studentAvatar?: string | null;
  content: string;
  imageUrl?: string | null;
  status: "submitted" | "late" | "graded";
  score: string | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
};

export type QuizItem = {
  id: number;
  title: string;
  description: string;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  classId: number;
  className: string;
  subjectName: string;
  subjectColor: string;
  teacherName: string;
  questionCount: number;
  maxScore: string;
  attemptCount: number;
  participantCount: number;
  avgPercent: number;
  myAttemptId: number | null;
  myAttemptStatus: string | null;
  myScore: string | null;
};

export type QuizQuestion = {
  id: number;
  orderIndex: number;
  type: "mcq" | "truefalse" | "short";
  prompt: string;
  imageUrl?: string | null;
  options: string[];
  points: string;
  correctAnswer?: string;
};

export type QuizDetail = {
  quiz: {
    id: number;
    teacherId?: number;
    title: string;
    description: string;
    durationMinutes: number;
    startsAt: string;
    endsAt: string;
    isPublished: boolean;
    classId: number;
    className: string;
    subjectName: string;
    subjectColor: string;
    teacherName: string;
  };
  questions: QuizQuestion[];
  attempt: {
    id: number;
    status: "in_progress" | "submitted";
    score: string;
    maxScore: string;
    startedAt: string;
    submittedAt: string | null;
    answers: { questionId: number; answer: string; isCorrect: boolean; awardedPoints: string }[];
  } | null;
  canManage: boolean;
  isOpen: boolean;
  leaderboard: {
    studentName: string;
    studentColor?: string;
    studentAvatar?: string | null;
    score: string;
    maxScore: string;
    submittedAt: string | null;
    status: string;
  }[];
};

export type MessageItem = {
  id: number;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  senderId: number;
  senderName?: string;
  senderColor?: string;
  senderAvatar?: string | null;
  senderRole?: Role;
  mine: boolean;
  readAt?: string | null;
};

export type Thread = {
  peerId: number;
  peerName: string;
  peerColor: string;
  peerAvatar?: string | null;
  lastMessage: string;
  hasImage?: boolean;
  lastAt: string;
  unreadCount?: number;
};

export type RosterEntry = {
  studentId: number;
  fullName: string;
  avatarColor: string;
  avatarUrl?: string | null;
  username: string;
  status: "present" | "absent" | "late" | "excused" | null;
  note: string | null;
  attendanceId: number | null;
};
