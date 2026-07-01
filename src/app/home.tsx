import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, LayoutAnimation, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { getToken, getUser, logout } from '@/lib/auth';
import { Palette, Radius, Shadow } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DrawingItem = { id: string; title: string; createdAt: string; updatedAt: string; thumbnail?: string | null; room?: string; starred?: boolean };

export default function HomeScreen() {
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace('/login');
    const user = await getUser();
    if (user) setUserEmail(user.email);
    try {
      const data = await api.listDrawings(token);
      setDrawings(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
    animateIn();
  }, [animateIn]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await logout();
    router.replace('/login');
  };

  const confirmDelete = (id: string) => {
    LayoutAnimation.configureNext({ duration: 250, create: { type: 'easeInEaseOut', property: 'opacity' }, update: { type: 'easeInEaseOut' }, delete: { type: 'easeInEaseOut', duration: 200 } });
    setDrawings((p) => p.filter((d) => d.id !== id));
  };

  const initials = userEmail ? userEmail[0].toUpperCase() : '?';

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setRoomLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const r = await api.createRoom(token, roomName.trim() || '');
      setCreatedCode(r.code);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create room');
      setRoomLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setRoomLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const r = await api.joinRoom(token, joinCode.trim());
      setShowJoin(false);
      setJoinCode('');
      setRoomLoading(false);
      router.push(`/canvas?room=${r.code}`);
    } catch (e: any) {
      Alert.alert('Room not found', e.message || 'Check the code and try again');
      setRoomLoading(false);
    }
  };

  const renderCard = (item: DrawingItem) => (
    <Pressable
      key={item.id}
      style={styles.card}
      onPress={() => router.push(`/canvas?id=${item.id}`)}
      onLongPress={() => {
        const tokenPromise = getToken();
        tokenPromise.then((token) => {
          if (!token) return;
          api.deleteDrawing(token, item.id).then(() => confirmDelete(item.id)).catch(() => {});
        });
      }}
    >
      <View style={styles.cardPreview}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <Text style={styles.cardEmoji}>🎨</Text>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{new Date(item.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          {item.room ? <Text style={styles.cardRoom}>#{item.room}</Text> : null}
        </View>
      </View>
      <Pressable onPress={async () => {
        const token = await getToken();
        if (!token) return;
        try { await api.saveDrawing(token, { starred: !item.starred }, item.id); item.starred = !item.starred; setDrawings((prev) => prev.map(d => d.id === item.id ? { ...d, starred: !d.starred } : d)); } catch {}
      }} style={styles.starBtn}>
        <Text style={[styles.starIcon, item.starred && styles.starActive]}>{item.starred ? '★' : '☆'}</Text>
      </Pressable>
      <View style={styles.cardArrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={styles.loaderPulse}>
            <Text style={styles.loaderIcon}>🎨</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.email}>{userEmail}</Text>
          </View>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.cardsRow}>
        <Animated.View style={[styles.cardSection, styles.cardSolo, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Pressable onPress={() => router.push('/canvas')} style={styles.cardSectionInner}>
            <Text style={styles.cardSectionIcon}>✏️</Text>
            <Text style={styles.cardSectionTitle}>Solo</Text>
            <Text style={styles.cardSectionSub}>Draw on your own</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={[styles.cardSection, styles.cardCreate, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Pressable onPress={() => { setRoomName(''); setCreatedCode(null); setShowCreate(true); }} style={styles.cardSectionInner}>
            <Text style={styles.cardSectionIcon}>🏠</Text>
            <Text style={styles.cardSectionTitle}>Create</Text>
            <Text style={styles.cardSectionSub}>Create a room</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={[styles.cardSection, styles.cardJoin, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Pressable onPress={() => { setJoinCode(''); setShowJoin(true); }} style={styles.cardSectionInner}>
            <Text style={styles.cardSectionIcon}>🚪</Text>
            <Text style={styles.cardSectionTitle}>Join</Text>
            <Text style={styles.cardSectionSub}>Enter room code</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gallery</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionCount}>{drawings.length}</Text>
        </View>
      </View>

      {drawings.length === 0 ? (
        <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>🎨</Text>
          </View>
          <Text style={styles.emptyTitle}>No drawings yet</Text>
          <Text style={styles.emptySub}>Tap the button above to start your first masterpiece</Text>
        </Animated.View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Palette.purple} />}
        >
          {drawings.map((item) => renderCard(item))}
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => { setShowCreate(false); setCreatedCode(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {createdCode ? (
              <>
                <Text style={styles.modalEmoji}>🎉</Text>
                <Text style={styles.modalTitle}>Room Created!</Text>
                <Text style={styles.modalSub}>Share this code with friends</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{createdCode}</Text>
                </View>
                <Pressable style={styles.modalBtn} onPress={() => { setShowCreate(false); setCreatedCode(null); router.push(`/canvas?room=${createdCode}`); }}>
                  <Text style={styles.modalBtnText}>Start Drawing</Text>
                </Pressable>
                <Pressable style={styles.modalBtnSecondary} onPress={() => { setShowCreate(false); setCreatedCode(null); }}>
                  <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalEmoji}>🏠</Text>
                <Text style={styles.modalTitle}>Create a Room</Text>
                <Text style={styles.modalSub}>Give your room a name (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={roomName}
                  onChangeText={setRoomName}
                  placeholder="e.g. Art Club"
                  placeholderTextColor={Palette.textMuted}
                  autoFocus
                />
                <Pressable style={[styles.modalBtn, roomLoading && { opacity: 0.6 }]} onPress={handleCreateRoom} disabled={roomLoading}>
                  <Text style={styles.modalBtnText}>{roomLoading ? 'Creating...' : 'Generate Code'}</Text>
                </Pressable>
                <Pressable style={styles.modalBtnSecondary} onPress={() => setShowCreate(false)}>
                  <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showJoin} transparent animationType="fade" onRequestClose={() => setShowJoin(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalEmoji}>🚪</Text>
            <Text style={styles.modalTitle}>Join a Room</Text>
            <Text style={styles.modalSub}>Enter the room code to join</Text>
            <TextInput
              style={[styles.modalInput, { textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: '800' }]}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="XK92MN"
              placeholderTextColor={Palette.textMuted}
              autoFocus
              maxLength={6}
              autoCapitalize="characters"
            />
            <Pressable style={[styles.modalBtn, roomLoading && { opacity: 0.6 }]} onPress={handleJoinRoom} disabled={roomLoading}>
              <Text style={styles.modalBtnText}>{roomLoading ? 'Joining...' : 'Join Room'}</Text>
            </Pressable>
            <Pressable style={styles.modalBtnSecondary} onPress={() => setShowJoin(false)}>
              <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderPulse: { width: 64, height: 64, borderRadius: 32, backgroundColor: Palette.offWhite, alignItems: 'center', justifyContent: 'center', ...Shadow.lg },
  loaderIcon: { fontSize: 28 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Palette.cardWhite,
    borderBottomWidth: 1, borderBottomColor: Palette.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Palette.purple, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  greeting: { fontSize: 11, color: Palette.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  email: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.sm, backgroundColor: Palette.offWhite },
  logoutText: { fontWeight: '600', color: Palette.error, fontSize: 13 },

  cardsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 8, gap: 10,
  },
  cardSection: {
    flex: 1, borderRadius: Radius.xl, overflow: 'hidden',
    ...Shadow.md,
  },
  cardSectionInner: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 },
  cardSectionIcon: { fontSize: 28 },
  cardSectionTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 6, letterSpacing: -0.3 },
  cardSectionSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cardSolo: { backgroundColor: Palette.purple },
  cardCreate: { backgroundColor: Palette.teal },
  cardJoin: { backgroundColor: Palette.coral },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Palette.textPrimary, letterSpacing: -0.3 },
  sectionBadge: {
    backgroundColor: Palette.purple + '20', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Radius.full,
  },
  sectionCount: { fontSize: 12, fontWeight: '700', color: Palette.purple },

  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },

  card: {
    backgroundColor: Palette.cardWhite, borderRadius: Radius.lg, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...Shadow.sm,
  },
  cardPreview: { width: 64, height: 64, backgroundColor: Palette.offWhite, alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: 64, height: 64 },
  cardEmoji: { fontSize: 24 },
  cardInfo: { flex: 1, justifyContent: 'center', paddingRight: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cardDate: { fontSize: 12, color: Palette.textMuted },
  cardRoom: { fontSize: 10, fontWeight: '700', color: Palette.purple, backgroundColor: Palette.purple + '15', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  starBtn: { paddingHorizontal: 8, paddingVertical: 10 },
  starIcon: { fontSize: 20, color: Palette.textMuted },
  starActive: { color: Palette.amber },
  cardArrow: { paddingRight: 14 },
  arrowText: { fontSize: 22, color: Palette.textMuted, fontWeight: '300' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.purple + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary, letterSpacing: -0.3 },
  emptySub: { fontSize: 14, color: Palette.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modal: { backgroundColor: Palette.cardWhite, borderRadius: Radius.xl, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalEmoji: { fontSize: 36, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Palette.textPrimary, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: Palette.textSecondary, marginTop: 4, marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: Palette.offWhite, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: Palette.border, color: Palette.textPrimary, width: '100%', marginBottom: 16 },
  modalBtn: { backgroundColor: Palette.purple, borderRadius: Radius.md, paddingVertical: 13, paddingHorizontal: 32, alignItems: 'center', width: '100%', ...Shadow.sm },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalBtnSecondary: { marginTop: 10, paddingVertical: 8 },
  modalBtnTextSecondary: { color: Palette.textSecondary, fontSize: 14, fontWeight: '600' },
  codeBox: { backgroundColor: Palette.offWhite, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 14, marginBottom: 20, borderWidth: 2, borderColor: Palette.purple + '30', borderStyle: 'dashed' },
  codeText: { fontSize: 28, fontWeight: '800', color: Palette.purple, letterSpacing: 8 },
});
