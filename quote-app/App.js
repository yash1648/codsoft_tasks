import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity,
  ScrollView, Share, FlatList, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);

const DB = 'quote-app.db';
const openDB = async () => SQLite.openDatabase({ name: DB, location: 'default' });
const rowsToArray = (rs) => { const a = []; for (let i = 0; i < rs.rows.length; i++) a.push(rs.rows.item(i)); return a; };

const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Our greatest glory is not in never falling, but in rising every time we fall.', author: 'Nelson Mandela' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  { text: 'What you get by achieving your goals is not as important as what you become.', author: 'Zig Ziglar' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Your time is limited, so don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
  { text: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky' },
  { text: 'Be the change you wish to see in the world.', author: 'Mahatma Gandhi' },
  { text: 'Chaos is a ladder.', author: 'Petyr Baelish' },
];

const getTodaySeed = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

const getQuoteOfDay = () => {
  const seed = getTodaySeed();
  return QUOTES[seed % QUOTES.length];
};

export default function App() {
  const [currentQuote, setCurrentQuote] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await openDB();
        setDb(d);
        await d.executeSql(
          'CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, author TEXT, savedAt TEXT)'
        );
        const [rows] = await d.executeSql('SELECT * FROM favorites ORDER BY savedAt DESC');
        setFavorites(rowsToArray(rows));
        setCurrentQuote(getQuoteOfDay());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFavorite = useCallback(async (quote) => {
    if (!db) return;
    const exists = favorites.find(f => f.text === quote.text && f.author === quote.author);
    if (exists) {
      await db.executeSql('DELETE FROM favorites WHERE text = ? AND author = ?', [quote.text, quote.author]);
      setFavorites(favorites.filter(f => !(f.text === quote.text && f.author === quote.author)));
    } else {
      await db.executeSql(
        'INSERT INTO favorites (text, author, savedAt) VALUES (?, ?, ?)',
        [quote.text, quote.author, new Date().toISOString()]
      );
      setFavorites([...favorites, { ...quote, savedAt: new Date().toISOString() }]);
    }
  }, [db, favorites]);

  const shareQuote = async () => {
    if (!currentQuote) return;
    try {
      await Share.share(
        { message: `“${currentQuote.text}” — ${currentQuote.author}`, title: 'Quote of the Day' }
      );
    } catch (e) {
      Alert.alert('Share failed', e.message);
    }
  };

  const removeFavorite = async (fav) => {
    if (!db) return;
    await db.executeSql('DELETE FROM favorites WHERE id = ?', [fav.id]);
    setFavorites(favorites.filter(f => f.id !== fav.id));
  };

  const isFavorited = (quote) => {
    return favorites.some(f => f.text === quote.text && f.author === quote.author);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200EE" />
        <Text style={{ marginTop: 12, color: '#888' }}>Loading Quote of the Day...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quote of the Day</Text>
        <TouchableOpacity onPress={() => setShowFavorites(true)}>
          <View style={[styles.heartBtn, favorites.length > 0 && styles.heartBtnFilled]}>
            <Text style={[styles.heartText, favorites.length > 0 && styles.heartTextFilled]}>♥</Text>
            <Text style={[styles.heartCount, favorites.length > 0 && styles.heartCountFilled]}>{ favorites.length }</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        { currentQuote && (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>
              "\u201c{ currentQuote.text }\u201d"
            </Text>
            <View style={styles.quoteFooter}>
              <Text style={styles.quoteAuthor}>\u2014 { currentQuote.author }</Text>
              <Text style={styles.quoteDate}>
                { new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
              </Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => setCurrentQuote(getQuoteOfDay())}
          >
            <Text style={styles.actionBtnText}>🔄 New Quote</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={shareQuote}
          >
            <Text style={styles.actionBtnTextSecondary}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtnSecondary,
              isFavorited(currentQuote) && styles.actionBtnFavorited
            ]}
            onPress={() => currentQuote && toggleFavorite(currentQuote)}
          >
            <Text style={[
              styles.actionBtnTextSecondary,
              isFavorited(currentQuote) && styles.actionBtnTextFavorited
            ]}>
              { isFavorited(currentQuote) ? '♥ Saved' : '♡ Save' }
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>
          Today's seed: { getTodaySeed() } • { QUOTES.length } quotes in collection
        </Text>
      </ScrollView>

      {/* Favorites Modal */}
      <Modal visible={showFavorites} transparent animationType="slide" onRequestClose={() => setShowFavorites(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>♥ Favorite Quotes</Text>
              <TouchableOpacity onPress={() => setShowFavorites(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            { favorites.length === 0 ? (
              <View style={styles.emptyFavs}>
                <Text style={styles.emptyFavsIcon}>💔</Text>
                <Text style={styles.emptyFavsText}>No favorites yet</Text>
                <Text style={styles.emptyFavsSub}>Tap the ♡ button to save quotes</Text>
              </View>
            ) : (
              <FlatList
                data={favorites}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.favItem}>
                    <Text style={styles.favText}>"\u201c{ item.text }\u201d"</Text>
                    <Text style={styles.favAuthor}>\u2014 { item.author }</Text>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeFavorite(item)}
                    >
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
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
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, padding: 6, paddingRight: 10
  },
  heartBtnFilled: { backgroundColor: '#fff' },
  heartText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  heartTextFilled: { color: '#6200EE' },
  heartCount: { color: '#fff', fontSize: 14 },
  heartCountFilled: { color: '#6200EE' },
  scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center' },
  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginHorizontal: 16
  },
  quoteText: {
    fontSize: 40,
    color: '#6200EE',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 52,
    marginBottom: 8
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#eee'
  },
  quoteAuthor: { fontSize: 16, color: '#888', fontWeight: '600' },
  quoteDate: { fontSize: 12, color: '#aaa' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 16
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#6200EE',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center'
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6200EE'
  },
  actionBtnFavorited: {
    backgroundColor: '#F44336',
    borderColor: '#F44336'
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  actionBtnTextSecondary: { color: '#6200EE', fontSize: 15, fontWeight: 'bold' },
  actionBtnTextFavorited: { color: '#fff' },
  footnote: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeBtn: { fontSize: 24, color: '#999' },
  emptyFavs: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyFavsIcon: { fontSize: 48, marginBottom: 12 },
  emptyFavsText: { fontSize: 16, color: '#888' },
  emptyFavsSub: { fontSize: 14, color: '#aaa', marginTop: 4 },
  favItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10
  },
  favText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#333',
    marginBottom: 4,
    lineHeight: 22
  },
  favAuthor: { fontSize: 13, color: '#888', fontWeight: '600' },
  removeBtn: { alignSelf: 'flex-end', marginTop: 8, padding: 4 },
  removeBtnText: { color: '#F44336', fontSize: 12 }
});
