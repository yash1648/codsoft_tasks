import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity,
  TextInput, ScrollView, Alert, FlatList, Modal, ActivityIndicator,
  Platform, KeyboardAvoidingView
} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);

const DB = 'todo-app.db';
const openDB = async () => SQLite.openDatabase({ name: DB, location: 'default' });
const rowsToArray = (rs) => { const a = []; for (let i = 0; i < rs.rows.length; i++) a.push(rs.rows.item(i)); return a; };

const PRIORITIES = { low: 0, medium: 1, high: 2 };
const PRIORITY_LABELS = { 0: 'Low', 1: 'Medium', 2: 'High' };
const PRIORITY_COLORS = { 0: '#4CAF50', 1: '#FF9800', 2: '#F44336' };

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await openDB();
        setDb(d);
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, priority INTEGER, dueDate TEXT, completed INTEGER DEFAULT 0, createdAt TEXT)'
        );
        const [rows] = await d.executeSql('SELECT * FROM tasks ORDER BY priority DESC, createdAt DESC');
        setTasks(rowsToArray(rows));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!db) return;
    const [rows] = await db.executeSql('SELECT * FROM tasks ORDER BY priority DESC, createdAt DESC');
    setTasks(rowsToArray(rows));
  }, [db]);

  const addTask = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    if (!db) return;
    const now = new Date().toISOString();
    await db.executeSql(
      'INSERT INTO tasks (title, description, priority, dueDate, completed, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
      [title.trim(), desc.trim(), PRIORITIES[priority], dueDate || null, now]
    );
    setTitle(''); setDesc(''); setPriority('medium'); setDueDate('');
    setShowAdd(false);
    await refresh();
  };

  const updateTask = async () => {
    if (!title.trim() || editingId === null) { Alert.alert('Error', 'Title is required'); return; }
    if (!db) return;
    await db.executeSql(
      'UPDATE tasks SET title=?, description=?, priority=?, dueDate=? WHERE id=?',
      [title.trim(), desc.trim(), PRIORITIES[priority], dueDate || null, editingId]
    );
    setTitle(''); setDesc(''); setPriority('medium'); setDueDate('');
    setShowEdit(false); setEditingId(null);
    await refresh();
  };

  const toggleComplete = async (task) => {
    if (!db) return;
    await db.executeSql(
      'UPDATE tasks SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?',
      [task.id]
    );
    await refresh();
  };

  const deleteTask = (task) => {
    Alert.alert('Delete Task', `"${task.title}"`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (!db) return;
            await db.executeSql('DELETE FROM tasks WHERE id = ?', [task.id]);
            await refresh();
          }
        }
      ]);
  };

  const openEdit = (task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDesc(task.description || '');
    setPriority(Object.keys(PRIORITIES).find(k => PRIORITIES[k] === task.priority) || 'medium');
    setDueDate(task.dueDate || '');
    setShowEdit(true);
  };

  const renderTask = useCallback(({ item }) => (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: item.completed ? '#f0f0f0' : '#fff',
        padding: 12, borderBottomWidth: 1, borderColor: '#eee',
        opacity: item.completed ? 0.6 : 1
      }}
      onPress={() => toggleComplete(item)}
      onLongPress={() => openEdit(item)}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: item.completed ? '#4CAF50' : 'transparent',
              borderWidth: 2, borderColor: item.completed ? '#4CAF50' : '#999'
            }}
          />
          <Text style={{ fontSize: 16, fontWeight: '600', color: item.completed ? '#999' : '#333' }}>
            { item.title }
          </Text>
        </View>
        { item.description ? (
          <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{ item.description }</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <View
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: PRIORITY_COLORS[item.priority]
          }}
        />
        <Text style={{ fontSize: 11, color: '#999' }}>
          { PRIORITY_LABELS[item.priority] ?? 'Low' }
        </Text>
        { item.dueDate ? (
          <Text style={{ fontSize: 11, color: '#666' }}>
            Due: { item.dueDate }
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={{ marginLeft: 8, padding: 6, backgroundColor: '#ff5252', borderRadius: 6 }}
        onPress={() => deleteTask(item)}
      >
        <Text style={{ color: '#fff', fontSize: 14 }}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  ), [db, refresh]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200EE" />
        <Text style={{ marginTop: 12, color: '#888' }}>Loading To-Do List...</Text>
      </SafeAreaView>
    );
  }

  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>To-Do List</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)}>
          <View style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, completed === total && total > 0 && styles.statDone]}>
          <Text style={[styles.statNum, completed === total && total > 0 && styles.statNumDone]}>{ completed }</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{ total }</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Task list */}
      <FlatList
        data={tasks}
        keyExtractor={item => item.id.toString()}
        renderItem={renderTask}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first task</Text>
          </View>
        }
      />

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ backgroundColor: 'transparent' }}
          >
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Task</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Task title *"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#bbb"
              />

              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Description (optional)"
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={3}
                placeholderTextColor="#bbb"
              />

              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {['low', 'medium', 'high'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: priority === p ? '#6200EE' : '#f0f0f0',
                      borderWidth: 1,
                      borderColor: priority === p ? '#6200EE' : '#ddd'
                    }}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={{
                      color: priority === p ? '#fff' : '#666',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      { p.charAt(0).toUpperCase() + p.slice(1) }
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Due date (YYYY-MM-DD)"
                value={dueDate}
                onChangeText={setDueDate}
                placeholderTextColor="#bbb"
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={addTask}
              >
                <Text style={styles.submitBtnText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ backgroundColor: 'transparent' }}
          >
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <TouchableOpacity onPress={() => setShowEdit(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Task title *"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#bbb"
              />

              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Description (optional)"
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={3}
                placeholderTextColor="#bbb"
              />

              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {['low', 'medium', 'high'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: priority === p ? '#6200EE' : '#f0f0f0',
                      borderWidth: 1,
                      borderColor: priority === p ? '#6200EE' : '#ddd'
                    }}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={{
                      color: priority === p ? '#fff' : '#666',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      { p.charAt(0).toUpperCase() + p.slice(1) }
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Due date (YYYY-MM-DD)"
                value={dueDate}
                onChangeText={setDueDate}
                placeholderTextColor="#bbb"
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={updateTask}
              >
                <Text style={styles.submitBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#6200EE'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold'
  },
  addBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    paddingRight: 12
  },
  addBtnText: {
    color: '#6200EE',
    fontWeight: 'bold',
    fontSize: 20
  },
  statsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8
  },
  statDone: {
    backgroundColor: '#E8F5E9'
  },
  statNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200EE'
  },
  statNumDone: {
    color: '#4CAF50'
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyText: {
    fontSize: 18,
    color: '#888'
  },
  emptySub: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  closeBtn: {
    fontSize: 24,
    color: '#999'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    fontSize: 16
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 12
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: '#6200EE',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center'
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
