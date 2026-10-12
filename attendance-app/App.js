import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity,
  TextInput, ScrollView, Alert, FlatList, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);

const DB = 'attendance-app.db';
const openDB = async () => SQLite.openDatabase({ name: DB, location: 'default' });
const rowsToArray = (rs) => { const a = []; for (let i = 0; i < rs.rows.length; i++) a.push(rs.rows.item(i)); return a; };

export default function App() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseStudents, setCourseStudents] = useState([]);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [instructorCourses, setInstructorCourses] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0 });

  useEffect(() => {
    (async () => {
      try {
        const d = await openDB();
        setDb(d);
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT, createdAt TEXT)'
        );
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, instructorId INTEGER, createdAt TEXT)'
        );
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, courseId INTEGER, studentId INTEGER, date TEXT, status TEXT, recordedAt TEXT)'
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async () => {
    if (!email.trim() || !password.trim()) { Alert.alert('Error', 'Please fill in all fields'); return; }
    if (!db) return;
    const [rows] = await db.executeSql(
      'SELECT * FROM users WHERE email = ? AND password = ?',
      [email.trim(), password]
    );
    if (rows.rows.length === 0) {
      Alert.alert('Login Failed', 'Invalid email or password');
      return;
    }
    const u = rows.rows.item(0);
    setUser({ id: u.id, name: u.name, role: u.role, email: u.email });
    setEmail(''); setPassword('');
    if (u.role === 'student') {
      const [cr] = await db.executeSql(
        'SELECT c.* FROM courses c INNER JOIN users u ON u.id = c.instructorId ORDER BY c.name'
      );
      setCourses(rowsToArray(cr));
    } else {
      const [cr] = await db.executeSql(
        'SELECT * FROM courses WHERE instructorId = ? ORDER BY name',
        [u.id]
      );
      setInstructorCourses(rowsToArray(cr));
    }
  };

  const register = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!db) return;
    try {
      await db.executeSql(
        'INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), email.trim(), password, role, new Date().toISOString()]
      );
      Alert.alert('Success', 'Account created! Please login.');
      setIsRegister(false);
      setEmail(''); setPassword(''); setName(''); setRole('student');
    } catch (e) {
      Alert.alert('Error', 'Email may already be registered');
    }
  };

  const logout = () => {
    setUser(null);
    setCourses([]);
    setInstructorCourses([]);
    setSelectedCourse(null);
  };

  const addCourse = async () => {
    if (!courseName.trim() || !user) { Alert.alert('Error', 'Course name is required'); return; }
    if (!db) return;
    await db.executeSql(
      'INSERT INTO courses (name, instructorId, createdAt) VALUES (?, ?, ?)',
      [courseName.trim(), user.id, new Date().toISOString()]
    );
    setCourseName('');
    setShowAddCourse(false);
    const [cr] = await db.executeSql(
      'SELECT * FROM courses WHERE instructorId = ? ORDER BY name',
      [user.id]
    );
    setInstructorCourses(rowsToArray(cr));
  };

  const selectCourse = async (course) => {
    setSelectedCourse(course);
    if (!db) return;
    const [rows] = await db.executeSql(
      'SELECT id, name, email FROM users WHERE role = ?',
      ['student']
    );
    setCourseStudents(rowsToArray(rows));
    setStats(await getStats(course));
  };

  const markAttendance = async (studentId, status) => {
    if (!db || !selectedCourse) return;
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await db.executeSql(
      'SELECT * FROM attendance WHERE courseId = ? AND studentId = ? AND date = ?',
      [selectedCourse.id, studentId, today]
    );
    if (existing.rows.length > 0) {
      await db.executeSql(
        'UPDATE attendance SET status = ?, recordedAt = ? WHERE courseId = ? AND studentId = ? AND date = ?',
        [status, new Date().toISOString(), selectedCourse.id, studentId, today]
      );
    } else {
      await db.executeSql(
        'INSERT INTO attendance (courseId, studentId, date, status, recordedAt) VALUES (?, ?, ?, ?, ?)',
        [selectedCourse.id, studentId, today, status, new Date().toISOString()]
      );
    }
    Alert.alert('Done', `Marked ${ status === 'present' ? 'Present' : 'Absent' }`);
    setStats(await getStats());
  };

  const getTodayStatus = async (studentId) => {
    if (!db || !selectedCourse) return null;
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await db.executeSql(
      'SELECT status FROM attendance WHERE courseId = ? AND studentId = ? AND date = ?',
      [selectedCourse.id, studentId, today]
    );
    return rows.rows.length > 0 ? rows.rows.item(0).status : null;
  };

  const getStats = async (course = selectedCourse) => {
    if (!db || !course) return { present: 0, absent: 0 };
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await db.executeSql(
      "SELECT status, COUNT(*) as cnt FROM attendance WHERE courseId = ? AND date = ? GROUP BY status",
      [course.id, today]
    );
    let present = 0, absent = 0;
    rowsToArray(rows).forEach(r => {
      if (r.status === 'present') present = r.cnt;
      else if (r.status === 'absent') absent = r.cnt;
    });
    return { present, absent };
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200EE" />
      </SafeAreaView>
    );
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── Auth screen ──
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authLogo}>
            <Text style={styles.logoEmoji}>\uD83D\uDCDA</Text>
            <Text style={styles.logoTitle}>University Attendance</Text>
            <Text style={styles.logoSub}>Track attendance seamlessly</Text>
          </View>

          <TouchableOpacity
            style={[styles.toggleBtn, isRegister && styles.toggleBtnActive]}
            onPress={() => setIsRegister(true)}
          >
            <Text style={[styles.toggleText, isRegister && styles.toggleTextActive]}>
              { isRegister ? '\u2713 Have an account? Login' : 'Create Account' }
            </Text>
          </TouchableOpacity>

          <View style={styles.authCard}>
            { isRegister ? (
              <>
                <Text style={styles.formTitle}>Register</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#bbb"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#bbb"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholderTextColor="#bbb"
                />
                <Text style={styles.roleLabel}>I am a:</Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'student' && styles.roleBtnActive]}
                    onPress={() => setRole('student')}
                  >
                    <Text style={[styles.roleText, role === 'student' && styles.roleTextActive]}>Student</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'instructor' && styles.roleBtnActive]}
                    onPress={() => setRole('instructor')}
                  >
                    <Text style={[styles.roleText, role === 'instructor' && styles.roleTextActive]}>Instructor</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.submitBtn} onPress={register}>
                  <Text style={styles.submitText}>Register</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.formTitle}>Login</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#bbb"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholderTextColor="#bbb"
                />
                <TouchableOpacity style={styles.submitBtn} onPress={login}>
                  <Text style={styles.submitText}>Login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Student dashboard ──
  if (user.role === 'student') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.dashHeader}>
          <View>
            <Text style={styles.dashSubtext}>Welcome back</Text>
            <Text style={styles.dashName}>{ user.name }</Text>
          </View>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Your Courses</Text>
          { courses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>\uD83D\uDCDA</Text>
              <Text style={styles.emptyText}>No courses enrolled yet</Text>
              <Text style={styles.emptySub}>Contact your instructor to get enrolled</Text>
            </View>
          ) : (
            courses.map((course, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.courseCard}
                onPress={() => selectCourse(course)}
                activeOpacity={0.7}
              >
                <View style={styles.courseCardRow}>
                  <View style={styles.courseIcon}>
                    <Text style={styles.courseIconEmoji}>\uD83D\uDCDA</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{ course.name }</Text>
                    <Text style={styles.courseHint}>Tap to mark your attendance</Text>
                  </View>
                  <Text style={styles.arrowRight}>\u2192</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <Modal visible={!!selectedCourse} transparent animationType="slide" onRequestClose={() => setSelectedCourse(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={styles.studentModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  { selectedCourse?.name } \u2014 Mark Attendance
                </Text>
                <TouchableOpacity onPress={() => setSelectedCourse(null)}>
                  <Text style={styles.closeBtn}>\u2715</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>{ today }</Text>
              <Text style={styles.modalQuestion}>How are you attending today?</Text>
              <View style={styles.markButtons}>
                <TouchableOpacity
                  style={styles.markPresent}
                  onPress={() => {
                    if (!selectedCourse) return;
                    markAttendance(user.id, 'present');
                    setSelectedCourse(null);
                  }}
                >
                  <Text style={styles.markEmoji}>\u2705</Text>
                  <Text style={styles.markText}>Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.markAbsent}
                  onPress={() => {
                    if (!selectedCourse) return;
                    markAttendance(user.id, 'absent');
                    setSelectedCourse(null);
                  }}
                >
                  <Text style={styles.markEmoji}>\u274C</Text>
                  <Text style={[styles.markText, styles.markTextAbsent]}>Absent</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalNote}>
                Your attendance will be recorded for { selectedCourse?.name }
              </Text>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Instructor dashboard ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.dashHeader}>
        <View>
          <Text style={styles.dashSubtext}>Instructor</Text>
          <Text style={styles.dashName}>{ user.name }</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.addCourseBtn}
          onPress={() => setShowAddCourse(true)}
        >
          <Text style={styles.addCourseText}>+ Add New Course</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Your Courses</Text>
        { instructorCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>\uD83D\uDCCB</Text>
            <Text style={styles.emptyText}>No courses created yet</Text>
            <Text style={styles.emptySub}>Tap + to create your first course</Text>
          </View>
        ) : (
          instructorCourses.map(course => (
            <View key={course.id} style={styles.courseCard}>
              <TouchableOpacity
                style={styles.courseCardRow}
                onPress={() => selectCourse(course)}
                activeOpacity={0.7}
              >
                <View style={styles.courseIcon}>
                  <Text style={styles.courseIconEmoji}>\uD83D\uDD2C</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{ course.name }</Text>
                  <Text style={styles.courseHint}>Tap to manage attendance</Text>
                </View>
                <Text style={styles.arrowRight}>\u2192</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        { selectedCourse && (
          <View style={styles.attendanceCard}>
            <View style={styles.attHeader}>
              <Text style={styles.attTitle}>
                { selectedCourse.name } \u2014 Today's Attendance
              </Text>
              <TouchableOpacity onPress={() => setSelectedCourse(null)}>
                <Text style={styles.closeSmall}>\u2715 Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.attDate}>{ today }</Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, styles.presentNum]}>
                  { stats.present }
                </Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, styles.absentNum]}>
                  { stats.absent }
                </Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, styles.totalNum]}>
                  { courseStudents.length }
                </Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            <Text style={styles.studentsTitle}>Students ({ courseStudents.length })</Text>
            { courseStudents.map(student => (
              <View key={student.id} style={styles.studentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{ student.name }</Text>
                  <Text style={styles.studentEmail}>{ student.email }</Text>
                </View>
                <View style={styles.markBtns}>
                  <TouchableOpacity
                    style={styles.markP}
                    onPress={() => markAttendance(student.id, 'present')}
                  >
                    <Text style={styles.markPText}>P</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.markA}
                    onPress={() => markAttendance(student.id, 'absent')}
                  >
                    <Text style={styles.markAText}>A</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            { courseStudents.length === 0 && (
              <Text style={styles.noStudents}>
                No students registered in the system yet. Students must register first.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddCourse} transparent animationType="slide" onRequestClose={() => setShowAddCourse(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={styles.courseModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Course</Text>
              <TouchableOpacity onPress={() => setShowAddCourse(false)}>
                <Text style={styles.closeBtn}>\u2715</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Course Name \u2014 e.g. CS 101: Intro to Programming"
              value={courseName}
              onChangeText={setCourseName}
              placeholderTextColor="#bbb"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={addCourse}>
              <Text style={styles.submitText}>Create Course</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  authLogo: { alignItems: 'center', marginBottom: 32 },
  logoEmoji: { fontSize: 56, marginBottom: 8 },
  logoTitle: {
    fontSize: 26, fontWeight: 'bold', color: '#6200EE', textAlign: 'center'
  },
  logoSub: {
    fontSize: 14, color: '#888', marginTop: 4, textAlign: 'center'
  },
  toggleBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 20
  },
  toggleBtnActive: { backgroundColor: '#6200EE' },
  toggleText: {
    color: '#6200EE', fontSize: 14, fontWeight: 'bold'
  },
  toggleTextActive: { color: '#fff' },
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    elevation: 2
  },
  formTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12
  },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, fontSize: 16, marginBottom: 10
  },
  roleLabel: { fontSize: 14, color: '#666', marginBottom: 6 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleBtn: {
    flex: 1, padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8, borderWidth: 1, borderColor: '#ddd'
  },
  roleBtnActive: { backgroundColor: '#6200EE', borderColor: '#6200EE' },
  roleText: {
    color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 14
  },
  roleTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#6200EE',
    borderRadius: 10, padding: 14, alignItems: 'center'
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#6200EE'
  },
  dashSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  dashName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  logoutText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  scrollContent: { padding: 16, flexGrow: 1 },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#888' },
  emptySub: { fontSize: 14, color: '#aaa', marginTop: 4 },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    elevation: 2
  },
  courseCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  courseIcon: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center'
  },
  courseIconEmoji: { fontSize: 20 },
  courseName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  courseHint: { fontSize: 13, color: '#888', marginTop: 2 },
  arrowRight: { fontSize: 18, color: '#6200EE' },
  addCourseBtn: {
    backgroundColor: '#6200EE',
    borderRadius: 12, padding: 14,
    marginBottom: 16, alignItems: 'center'
  },
  addCourseText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  attendanceCard: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2
  },
  attHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  attTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  closeSmall: { color: '#999', fontSize: 14 },
  attDate: { fontSize: 13, color: '#888', marginBottom: 12 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 10
  },
  statNum: {
    fontSize: 24, fontWeight: 'bold'
  },
  presentNum: { color: '#4CAF50' },
  absentNum: { color: '#F44336' },
  totalNum: { color: '#2196F3' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  studentsTitle: {
    fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee'
  },
  studentName: { fontSize: 15, fontWeight: '600', color: '#333' },
  studentEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  markBtns: { flexDirection: 'row', gap: 6 },
  markP: {
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: '#4CAF50',
    borderRadius: 6
  },
  markA: {
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: '#F44336',
    borderRadius: 6
  },
  markPText: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold' },
  markAText: { color: '#F44336', fontSize: 12, fontWeight: 'bold' },
  noStudents: {
    fontSize: 14, color: '#888', textAlign: 'center', marginTop: 12
  },
  courseModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeBtn: { fontSize: 24, color: '#999' },
  studentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%'
  },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 12, textAlign: 'center' },
  modalQuestion: { fontSize: 14, color: '#666', marginBottom: 8 },
  markButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  markPresent: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50'
  },
  markAbsent: {
    flex: 1,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F44336'
  },
  markEmoji: { fontSize: 32 },
  markText: {
    fontSize: 15, fontWeight: 'bold', color: '#4CAF50',
    marginTop: 4, textAlign: 'center'
  },
  markTextAbsent: { color: '#F44336' },
  modalNote: {
    fontSize: 12, color: '#aaa', textAlign: 'center'
  }
});
