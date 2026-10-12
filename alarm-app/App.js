import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity,
  TextInput, ScrollView, Alert, FlatList, Modal, ActivityIndicator,
  Platform, Switch, KeyboardAvoidingView
} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);

const DB = 'alarm-app.db';
const openDB = async () => SQLite.openDatabase({ name: DB, location: 'default' });
const rowsToArray = (rs) => { const a = []; for (let i = 0; i < rs.rows.length; i++) a.push(rs.rows.item(i)); return a; };

const ALARM_TONES = [
  { name: 'Classic Bell', value: 'bell' },
  { name: 'Digital Beep', value: 'beep' },
  { name: 'Gentle Chime', value: 'chime' },
  { name: 'Radio Tune', value: 'radio' },
];

export default function App() {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [showSetAlarm, setShowSetAlarm] = useState(false);

  const [alarmHour, setAlarmHour] = useState('08');
  const [alarmMinute, setAlarmMinute] = useState('00');
  const [alarmAmPm, setAlarmAmPm] = useState('AM');
  const [alarmTone, setAlarmTone] = useState('bell');
  const [alarmLabel, setAlarmLabel] = useState('');

  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await openDB();
        setDb(d);
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS alarms (id INTEGER PRIMARY KEY AUTOINCREMENT, hour TEXT, minute TEXT, amPm TEXT, tone TEXT, label TEXT, enabled INTEGER DEFAULT 1, createdAt TEXT)'
        );
        const [rows] = await d.executeSql('SELECT * FROM alarms ORDER BY hour, minute');
        setAlarms(rowsToArray(rows));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      setCurrentTime(`${ h12 }:${ m } ${ ampm }`);
      setCurrentDate(now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }));
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Check alarms periodically
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;

      for (const a of alarms) {
        if (a.enabled && a.hour === String(h12).padStart(2, '0') && a.minute === String(m).padStart(2, '0') && a.amPm === ampm) {
          Alert.alert(
            'Alarm!',
            a.label ? `${ a.label } — ${ a.hour }:${ a.minute } ${ a.amPm }` : `${ a.hour }:${ a.minute } ${ a.amPm }`,
            [
                { text: 'Snooze', onPress: () => Alert.alert('Snoozed', 'Snoozed for 5 minutes') },
                { text: 'Dismiss', style: 'destructive' }
              ]
          );
        }
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [currentTime, alarms]);

  const refresh = useCallback(async () => {
    if (!db) return;
    const [rows] = await db.executeSql('SELECT * FROM alarms ORDER BY hour, minute');
    setAlarms(rowsToArray(rows));
  }, [db]);

  const addAlarm = async () => {
    if (!alarmHour || !alarmMinute) { Alert.alert('Error', 'Please set a time'); return; }
    if (!db) return;
    await db.executeSql(
      'INSERT INTO alarms (hour, minute, amPm, tone, label, enabled, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [alarmHour.padStart(2, '0'), alarmMinute.padStart(2, '0'), alarmAmPm, alarmTone, alarmLabel.trim(), new Date().toISOString()]
    );
    setAlarmHour('08'); setAlarmMinute('00'); setAlarmAmPm('AM'); setAlarmTone('bell'); setAlarmLabel('');
    setShowSetAlarm(false);
    await refresh();
  };

  const toggleAlarm = async (alarm) => {
    if (!db) return;
    await db.executeSql(
      'UPDATE alarms SET enabled = CASE WHEN enabled = 0 THEN 1 ELSE 0 END WHERE id = ?',
      [alarm.id]
    );
    await refresh();
  };

  const deleteAlarm = (alarm) => {
    Alert.alert('Delete Alarm', 'Remove this alarm?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (!db) return;
            await db.executeSql('DELETE FROM alarms WHERE id = ?', [alarm.id]);
            await refresh();
          }
        }
      ]);
  };

  const formatTime = (h, m, ampm) => {
    const hour = parseInt(h, 10);
    const minute = parseInt(m, 10);
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${ h12 }:${ String(minute).padStart(2, '0') } ${ ampm }`;
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200EE" />
      </SafeAreaView>
    );
  }

  const enabledCount = alarms.filter(a => a.enabled).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Clock display */}
      <View style={styles.clockSection}>
        <Text style={styles.clockTime}>{ currentTime }</Text>
        <Text style={styles.clockDate}>{ currentDate }</Text>

        <View style={styles.clockStats}>
          <View style={styles.clockStat}>
            <Text style={styles.clockStatNum}>{ enabledCount }</Text>
            <Text style={styles.clockStatLabel}>Active Alarms</Text>
          </View>
          <View style={styles.clockStat}>
            <Text style={styles.clockStatNum}>{ alarms.length }</Text>
            <Text style={styles.clockStatLabel}>Total Set</Text>
          </View>
        </View>
      </View>

      {/* Add button */}
      <View style={{ padding: 16, alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.addAlarmBtn}
          onPress={() => setShowSetAlarm(true)}
        >
          <Text style={styles.addAlarmText}>+ Set New Alarm</Text>
        </TouchableOpacity>
      </View>

      {/* Alarm list */}
      <FlatList
        data={alarms}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>\uD83D\uDD40</Text>
            <Text style={styles.emptyText}>No alarms set</Text>
            <Text style={styles.emptySub}>Tap + to add your first alarm</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.alarmRow}>
            <Switch
              value={!!item.enabled}
              onValueChange={() => toggleAlarm(item)}
              trackColor={{ false: '#ccc', true: '#6200EE' }}
              thumbColor="#fff"
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.alarmTime}>{ formatTime(item.hour, item.minute, item.amPm) }</Text>
              { item.label ? (
                <Text style={styles.alarmLabel}>{ item.label }</Text>
              ) : null}
              <View style={styles.alarmToneRow}>
                <Text style={styles.alarmToneLabel}>Tone:</Text>
                <Text style={styles.alarmToneValue}>
                  { ALARM_TONES.find(t => t.value === item.tone)?.name ?? item.tone }
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deleteAlarm(item)}
            >
              <Text style={styles.deleteBtnText}>\u2715</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Set Alarm Modal */}
      <Modal visible={showSetAlarm} transparent animationType="slide" onRequestClose={() => setShowSetAlarm(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ backgroundColor: 'transparent' }}
          >
            <View style={styles.setModal}>
              <View style={styles.setModalHeader}>
                <Text style={styles.setModalTitle}>Set Alarm</Text>
                <TouchableOpacity onPress={() => setShowSetAlarm(false)}>
                  <Text style={styles.closeBtn}>\u2715</Text>
                </TouchableOpacity>
              </View>

              {/* Time display */}
              <View style={{ marginTop: 20, alignItems: 'center' }}>
                <Text style={styles.setTimeDisplay}>
                  { alarmHour }:{ alarmMinute } { alarmAmPm }
                </Text>
              </View>

              {/* Time picker buttons */}
              <View style={styles.timePickerRow}>
                {/* Hour picker */}
                <View style={styles.timePickerGroup}>
                  <TouchableOpacity
                    style={styles.timePickerBtn}
                    onPress={() => setAlarmHour(String(Math.max(1, parseInt(alarmHour, 10) - 1)).padStart(2, '0'))}
                  >
                    <Text style={styles.timePickerBtnText}>\u2212</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={alarmHour}
                    onChangeText={setAlarmHour}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.timePickerBtn}
                    onPress={() => setAlarmHour(String(Math.min(12, parseInt(alarmHour, 10) + 1)).padStart(2, '0'))}
                  >
                    <Text style={styles.timePickerBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Separator */}
                <Text style={styles.timeSeparator}>:</Text>

                {/* Minute picker */}
                <View style={styles.timePickerGroup}>
                  <TouchableOpacity
                    style={styles.timePickerBtn}
                    onPress={() => setAlarmMinute(String(Math.max(0, parseInt(alarmMinute, 10) - 5)).padStart(2, '0'))}
                  >
                    <Text style={styles.timePickerBtnText}>\u2212</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={alarmMinute}
                    onChangeText={setAlarmMinute}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.timePickerBtn}
                    onPress={() => setAlarmMinute(String(Math.min(55, parseInt(alarmMinute, 10) + 5)).padStart(2, '0'))}
                  >
                    <Text style={styles.timePickerBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* AM/PM */}
                <View style={styles.ampmGroup}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, alarmAmPm === 'AM' && styles.ampmBtnActive]}
                    onPress={() => setAlarmAmPm('AM')}
                  >
                    <Text style={[styles.ampmText, alarmAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, alarmAmPm === 'PM' && styles.ampmBtnActive]}
                    onPress={() => setAlarmAmPm('PM')}
                  >
                    <Text style={[styles.ampmText, alarmAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Label */}
              <TextInput
                style={styles.setInput}
                placeholder="Label (optional) \u2014 e.g. Wake up"
                value={alarmLabel}
                onChangeText={setAlarmLabel}
                placeholderTextColor="#bbb"
              />

              {/* Tone selector */}
              <Text style={styles.tonelabel}>Alarm Sound</Text>
              <View style={styles.tonerow}>
                { ALARM_TONES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      backgroundColor: alarmTone === t.value ? '#6200EE' : '#f0f0f0',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: alarmTone === t.value ? '#6200EE' : '#ddd'
                    }}
                    onPress={() => setAlarmTone(t.value)}
                  >
                    <Text style={{
                      color: alarmTone === t.value ? '#fff' : '#666',
                      fontSize: 14,
                      fontWeight: '600'
                    }}>
                      { t.name }
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.setBtn}
                onPress={addAlarm}
              >
                <Text style={styles.setBtnText}>Set Alarm</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  clockSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#6200EE'
  },
  clockTime: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2
  },
  clockDate: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8
  },
  clockStats: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 24
  },
  clockStat: { alignItems: 'center' },
  clockStatNum: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff'
  },
  clockStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)'
  },
  addAlarmBtn: {
    backgroundColor: '#6200EE',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5
  },
  addAlarmText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#888' },
  emptySub: { fontSize: 14, color: '#aaa', marginTop: 4 },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    padding: 14,
    borderRadius: 12,
    elevation: 2
  },
  alarmTime: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  alarmLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  alarmToneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4
  },
  alarmToneLabel: { fontSize: 11, color: '#aaa' },
  alarmToneValue: { fontSize: 11, color: '#666', fontWeight: '600' },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 8
  },
  deleteBtnText: { color: '#F44336', fontSize: 16 },
  setModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%'
  },
  setModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  setModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  closeBtn: { fontSize: 28, color: '#999' },
  setTimeDisplay: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6200EE',
    letterSpacing: 2
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16
  },
  timePickerGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePickerBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#6200EE',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  timePickerBtnText: { color: '#fff', fontSize: 20 },
  timeInput: {
    width: 50,
    height: 50,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#f0f0f0',
    borderRadius: 8
  },
  timeSeparator: { fontSize: 24, color: '#888', paddingHorizontal: 4 },
  ampmGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ampmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20
  },
  ampmBtnActive: { backgroundColor: '#6200EE' },
  ampmText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  ampmTextActive: { color: '#fff' },
  setInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginTop: 24,
    fontSize: 16
  },
  tonelabel: { fontSize: 14, color: '#666', marginTop: 16 },
  tonerow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap'
  },
  setBtn: {
    marginTop: 24,
    backgroundColor: '#6200EE',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center'
  },
  setBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
