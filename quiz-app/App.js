import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator
} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);

const DB = 'quiz-app.db';
const openDB = async () => SQLite.openDatabase({ name: DB, location: 'default' });
const rowsToArray = (rs) => { const a = []; for (let i = 0; i < rs.rows.length; i++) a.push(rs.rows.item(i)); return a; };

const QUIZZES = [
  {
    id: 'general',
    title: 'General Knowledge',
    description: 'Test your knowledge across various topics',
    questions: [
      { question: 'What is the capital of France?', options: ['London', 'Paris', 'Berlin', 'Madrid'], answer: 1 },
      { question: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2 },
      { question: 'What is the largest planet in our solar system?', options: ['Earth', 'Mars', 'Jupiter', 'Saturn'], answer: 2 },
      { question: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], answer: 2 },
      { question: 'What is the chemical symbol for water?', options: ['H2O', 'CO2', 'NaCl', 'O2'], answer: 0 },
      { question: 'Which country is known as the Land of the Rising Sun?', options: ['China', 'South Korea', 'Japan', 'Thailand'], answer: 2 },
      { question: 'What is the speed of light approximately?', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '100,000 km/s'], answer: 0 },
      { question: 'Who wrote "Romeo and Juliet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], answer: 1 },
      { question: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], answer: 2 },
      { question: 'Which element has the atomic number 1?', options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], answer: 1 },
    ]
  },
  {
    id: 'science',
    title: 'Science & Nature',
    description: 'Dive into the wonders of science',
    questions: [
      { question: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'], answer: 1 },
      { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], answer: 2 },
      { question: 'What is the boiling point of water at sea level?', options: ['90 C', '100 C', '110 C', '120 C'], answer: 1 },
      { question: 'What type of animal is a Komodo dragon?', options: ['Snake', 'Lizard', 'Crocodile', 'Turtle'], answer: 1 },
      { question: 'How many bones are in the adult human body?', options: ['106', '206', '306', '406'], answer: 1 },
      { question: 'What is the hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Platinum'], answer: 2 },
      { question: 'What planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], answer: 2 },
      { question: 'What is the chemical formula for table salt?', options: ['NaCl', 'KCl', 'CaCl', 'MgCl'], answer: 0 },
    ]
  },
  {
    id: 'history',
    title: 'History',
    description: 'Travel through time with history questions',
    questions: [
      { question: 'In what year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 2 },
      { question: 'Who was the first President of the United States?', options: ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'], answer: 2 },
      { question: 'Which ancient civilization built the pyramids?', options: ['Romans', 'Greeks', 'Egyptians', 'Mesopotamians'], answer: 2 },
      { question: 'What year did the Titanic sink?', options: ['1910', '1912', '1914', '1916'], answer: 1 },
      { question: 'Who discovered America in 1492?', options: ['Vasco da Gama', 'Ferdinand Magellan', 'Christopher Columbus', 'Amerigo Vespucci'], answer: 2 },
      { question: 'The French Revolution began in which year?', options: ['1776', '1789', '1799', '1804'], answer: 1 },
      { question: 'Who was the first woman to win a Nobel Prize?', options: ['Marie Curie', 'Rosalind Franklin', 'Eleanor Roosevelt', 'Jane Addams'], answer: 0 },
    ]
  },
  {
    id: 'tech',
    title: 'Technology',
    description: 'Test your tech knowledge',
    questions: [
      { question: 'What does HTML stand for?', options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyper Transfer Markup Language'], answer: 0 },
      { question: 'Who co-founded Apple Inc.?', options: ['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Jeff Bezos'], answer: 1 },
      { question: 'What does CPU stand for?', options: ['Central Process Unit', 'Computer Personal Unit', 'Central Processing Unit', 'Computer Processing Utility'], answer: 2 },
      { question: 'In what year was the first iPhone released?', options: ['2005', '2006', '2007', '2008'], answer: 2 },
      { question: 'What programming language is known as the "language of the web"?', options: ['Python', 'Java', 'JavaScript', 'C++'], answer: 2 },
      { question: 'What does URL stand for?', options: ['Uniform Resource Locator', 'Universal Reference Link', 'United Resource Link', 'Uniform Reference Locator'], answer: 0 },
    ]
  },
];

const getQuizById = (id) => QUIZZES.find(q => q.id === id);

export default function App() {
  const [screen, setScreen] = useState('home');
  const [selectedQuizId, setSelectedQuizId] = useState('general');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const d = await openDB();
        setDb(d);
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS quiz_history (id INTEGER PRIMARY KEY AUTOINCREMENT, quizId TEXT, quizTitle TEXT, score INTEGER, total INTEGER, date TEXT)'
        );
        const [rows] = await d.executeSql('SELECT * FROM quiz_history ORDER BY date DESC LIMIT 10');
        setHistory(rowsToArray(rows));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startQuiz = (quizId) => {
    setSelectedQuizId(quizId);
    setCurrentQIndex(0);
    setScore(0);
    setAnswers([]);
    setShowResult(false);
    setScreen('quiz');
  };

  const selectOption = (index) => {
    const quiz = getQuizById(selectedQuizId);
    const question = quiz.questions[currentQIndex];
    const isCorrect = index === question.answer;
    if (isCorrect) setScore(s => s + 1);
    setAnswers(a => [...a, { questionIndex: currentQIndex, selected: index, correct: isCorrect }]);
  };

  const nextQuestion = async () => {
    const quiz = getQuizById(selectedQuizId);
    if (currentQIndex < quiz.questions.length - 1) {
      setCurrentQIndex(i => i + 1);
    } else {
      if (db) {
        const quiz = getQuizById(selectedQuizId);
        await db.executeSql(
          'INSERT INTO quiz_history (quizId, quizTitle, score, total, date) VALUES (?, ?, ?, ?, ?)',
          [selectedQuizId, quiz.title, score, quiz.questions.length, new Date().toISOString()]
        );
        await refreshHistory();
      }
      setShowResult(true);
      setScreen('result');
    }
  };

  const restartQuiz = () => {
    setCurrentQIndex(0);
    setScore(0);
    setAnswers([]);
    setShowResult(false);
    setScreen('quiz');
  };

  const goHome = () => {
    setScreen('home');
    setSelectedQuizId('general');
    setCurrentQIndex(0);
    setScore(0);
    setAnswers([]);
    setShowResult(false);
    refreshHistory();
  };

  const refreshHistory = useCallback(async () => {
    if (!db) return;
    const [rows] = await db.executeSql('SELECT * FROM quiz_history ORDER BY date DESC LIMIT 10');
    setHistory(rowsToArray(rows));
  }, [db]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200EE" />
      </SafeAreaView>
    );
  }

  const currentQuiz = getQuizById(selectedQuizId);
  const progress = currentQuiz ? (currentQIndex / currentQuiz.questions.length * 100) : 0;

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quiz App</Text>
          <TouchableOpacity onPress={refreshHistory}>
            <Text style={styles.refreshBtn}>\u21BB</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Choose a Quiz</Text>
          { QUIZZES.map(quiz => (
            <TouchableOpacity
              key={quiz.id}
              style={styles.quizCard}
              onPress={() => startQuiz(quiz.id)}
              activeOpacity={0.7}
            >
              <View style={styles.quizCardRow}>
                <View>
                  <Text style={styles.quizTitle}>{ quiz.title }</Text>
                  <Text style={styles.quizDesc}>{ quiz.questions.length } questions</Text>
                </View>
                <Text style={styles.playIcon}>\u25B6</Text>
              </View>
              <Text style={styles.quizSubtitle}>{ quiz.description }</Text>
            </TouchableOpacity>
          ))}

          { history.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionTitle}>Recent Results</Text>
              { history.map(h => (
                <View key={h.id} style={styles.histRow}>
                  <View>
                    <Text style={styles.histQuiz}>{ h.quizTitle }</Text>
                    <Text style={styles.histDetail}>
                      { new Date(h.date).toLocaleDateString() } \u2022 { h.score }/{ h.total }
                    </Text>
                  </View>
                  <Text style={[
                    styles.histPct,
                    (h.score / h.total) >= 0.7 ? styles.pctGood :
                    (h.score / h.total) >= 0.4 ? styles.pctOk : styles.pctBad
                  ]}>
                    { Math.round(h.score / h.total * 100) }%
                  </Text>
                </View>
              ))}
            </View>
          )}

          { history.length === 0 && (
            <View style={styles.noHist}>
              <Text style={styles.noHistIcon}>\uD83D\uDCDD</Text>
              <Text style={styles.noHistText}>Complete a quiz to see your history here</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'quiz') {
    const question = currentQuiz?.questions[currentQIndex];
    if (!question) return null;

    const answered = answers.find(a => a.questionIndex === currentQIndex);
    const showFeedback = answered !== undefined;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

        <View style={styles.quizHeader}>
          <TouchableOpacity onPress={goHome}>
            <Text style={styles.backBtn}>\u2190 Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={styles.qProgress}>
            { currentQIndex + 1 }/{ currentQuiz.questions.length }
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${ progress }%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.quizScroll}>
          <View style={styles.qCard}>
            <Text style={styles.qNum}>Question { currentQIndex + 1 }</Text>
            <Text style={styles.qText}>{ question.question }</Text>
          </View>

          { question.options.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 16,
                marginBottom: 10,
                borderWidth: 2,
                borderColor: showFeedback && answered.selected === idx
                  ? (idx === question.answer ? '#4CAF50' : '#F44336')
                  : '#e0e0e0',
                opacity: showFeedback && answered.selected === idx ? 0.9 : 1
              }}
              onPress={() => selectOption(idx)}
              disabled={showFeedback}
              activeOpacity={0.6}
            >
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: showFeedback && answered.selected === idx
                  ? (idx === question.answer ? '#4CAF50' : '#F44336')
                  : '#6200EE',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12
              }}>
                <Text style={{
                  color: showFeedback && answered.selected === idx ? '#fff' : '#fff',
                  fontWeight: 'bold',
                  fontSize: 14
                }}>
                  { String.fromCharCode(65 + idx) }
                </Text>
              </View>
              <Text style={{
                flex: 1,
                fontSize: 16,
                color: '#333',
                fontWeight: showFeedback && answered.selected === idx ? 'bold' : 'normal'
              }}>
                { opt }
              </Text>
              { showFeedback && answered.selected === idx && (
                <Text style={{
                  fontSize: 20,
                  color: idx === question.answer ? '#4CAF50' : '#F44336'
                }}>
                  { idx === question.answer ? '\u2713' : '\u2715' }
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={{
              backgroundColor: showFeedback ? '#6200EE' : '#bdbdbd',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 48,
              opacity: showFeedback ? 1 : 0.5
            }}
            onPress={nextQuestion}
            disabled={!showFeedback}
          >
            <Text style={{
              color: showFeedback ? '#fff' : '#888',
              fontSize: 16,
              fontWeight: 'bold'
            }}>
              { currentQIndex < currentQuiz.questions.length - 1 ? 'Next \u2192' : 'See Results' }
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'result') {
    const total = currentQuiz.questions.length;
    const pct = Math.round((score / total) * 100);
    const isPassing = pct >= 70;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

        <ScrollView contentContainerStyle={styles.resultScroll}>
          <View style={styles.resultCard}>
            <Text style={styles.resultEmoji}>{ isPassing ? '\uD83C\uDF89' : '\uD83D\uDCAA' }</Text>
            <Text style={[styles.resultPct, isPassing ? styles.resultPctGood : styles.resultPctOk]}>
              { pct }%
            </Text>
            <Text style={styles.resultScore}>
              { score } out of { total } correct
            </Text>
            <View style={styles.resultBar}>
              <View style={[styles.resultBarFill, { width: `${ pct }%`, backgroundColor: isPassing ? '#4CAF50' : '#FF9800' }]} />
            </View>
          </View>

          <Text style={styles.reviewTitle}>Answer Review</Text>
          { answers.map((a, idx) => {
            const q = currentQuiz.questions[a.questionIndex];
            return (
              <View key={idx} style={styles.reviewRow}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: a.correct ? '#E8F5E9' : '#FFEBEE',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10
                }}>
                  <Text style={{ fontSize: 14, color: a.correct ? '#4CAF50' : '#F44336' }}>
                    { a.correct ? '\u2713' : '\u2715' }
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewQ, { fontSize: 13, color: '#333' }]}>{ q.question }</Text>
                  <Text style={[styles.reviewA, { fontSize: 12, color: '#888', marginTop: 2 }]}>
                    Your answer: { q.options[a.selected] }
                    { !a.correct ? ` \u2014 Correct: ${ q.options[q.answer] }` : '' }
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={styles.resultBtnPrimary}
            onPress={restartQuiz}
          >
            <Text style={styles.resultBtnText}>\uD83D\uDD04 Retry Quiz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resultBtnSecondary}
            onPress={goHome}
          >
            <Text style={styles.resultBtnTextSecondary}>\uD83C\uDFE0 Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#6200EE'
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  refreshBtn: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  scrollContent: { padding: 16, flexGrow: 1 },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12
  },
  quizCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6200EE'
  },
  quizCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  quizTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  quizDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  playIcon: { fontSize: 24, color: '#6200EE' },
  quizSubtitle: {
    fontSize: 13, color: '#aaa', marginTop: 6, fontStyle: 'italic'
  },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6
  },
  histQuiz: { fontSize: 14, fontWeight: '600', color: '#333' },
  histDetail: { fontSize: 12, color: '#888', marginTop: 2 },
  histPct: { fontSize: 16, fontWeight: 'bold' },
  pctGood: { color: '#4CAF50' },
  pctOk: { color: '#FF9800' },
  pctBad: { color: '#F44336' },
  noHist: { marginTop: 24, alignItems: 'center' },
  noHistIcon: { fontSize: 40, marginBottom: 8 },
  noHistText: { fontSize: 14, color: '#888' },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#6200EE'
  },
  backBtn: { color: '#fff', fontSize: 16 },
  qProgress: { color: '#fff', fontSize: 13 },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 2
  },
  quizScroll: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center'
  },
  qCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    marginBottom: 20
  },
  qNum: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  qText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 28
  },
  bottomBar: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  resultScroll: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center'
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    elevation: 6,
    marginBottom: 24
  },
  resultEmoji: { fontSize: 72, marginBottom: 8 },
  resultPct: {
    fontSize: 28,
    fontWeight: 'bold'
  },
  resultPctGood: { color: '#4CAF50' },
  resultPctOk: { color: '#FF9800' },
  resultScore: {
    fontSize: 16,
    color: '#888',
    marginTop: 4
  },
  resultBar: {
    width: 120,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden'
  },
  resultBarFill: {
    height: '100%',
    borderRadius: 4
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center'
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8
  },
  reviewQ: {
    fontSize: 13,
    color: '#333',
    flex: 1
  },
  reviewA: {
    fontSize: 12,
    color: '#888',
    marginTop: 2
  },
  resultActions: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  resultBtnPrimary: {
    backgroundColor: '#6200EE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 10
  },
  resultBtnSecondary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#6200EE'
  },
  resultBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultBtnTextSecondary: { color: '#6200EE', fontSize: 16, fontWeight: 'bold' }
});
