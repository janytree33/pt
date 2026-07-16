// ============================================================
// supabase_client.js - Supabase 클라우드 연동 모듈
// ============================================================

// 고객님의 Supabase 프로젝트 접속 정보
const SUPABASE_URL = 'https://ykddsnxsfnvzpihzhklk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZGRzbnhzZm52enBpaHpoa2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODY2NDIsImV4cCI6MjA5OTQ2MjY0Mn0.FUwJmQenivUhORHO-2JQIT6Z6mkOH7upiew2bsh5MRA';

// Supabase 클라이언트를 전역(window)에 등록
// window.supabase 는 CDN 스크립트가 먼저 로드한 라이브러리
const _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 암호화에 사용할 비밀 키 (AES 방식)
const ENCRYPTION_KEY = 'chloe_secret_diet_key_2026!@#$';

// ============================================================
// ChloeDB - 앱 전체에서 사용하는 클라우드 연동 객체
// window.ChloeDB 로 전역 등록하여 어디서든 접근 가능
// ============================================================
window.ChloeDB = {

  // ─── 암호화 / 복호화 ─────────────────────────────────────

  /** 데이터를 AES로 암호화합니다. */
  encryptData: function(data) {
    try {
      const jsonStr = JSON.stringify(data);
      return CryptoJS.AES.encrypt(jsonStr, ENCRYPTION_KEY).toString();
    } catch (e) {
      console.error('암호화 실패:', e);
      return null;
    }
  },

  /** 암호화된 문자열을 원래 객체로 복호화합니다. */
  decryptData: function(encryptedText) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (e) {
      console.error('복호화 실패:', e);
      return null;
    }
  },

  // ─── 인증(로그인/가입) ────────────────────────────────────

  /** 이메일 + 비밀번호로 로그인합니다. */
  login: async function(email, password) {
    const { data, error } = await _supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });
    return { data, error };
  },

  /** 이메일 + 비밀번호로 회원가입합니다. */
  signUp: async function(email, password) {
    const { data, error } = await _supabaseClient.auth.signUp({
      email: email,
      password: password,
    });
    return { data, error };
  },

  /** 로그아웃합니다. */
  logout: async function() {
    const { error } = await _supabaseClient.auth.signOut();
    return { error };
  },

  /** 현재 로그인 세션을 가져옵니다. */
  getSession: async function() {
    const { data, error } = await _supabaseClient.auth.getSession();
    return { session: data.session, error };
  },

  // ─── 데이터 저장/불러오기 ────────────────────────────────

  /** 사용자 프로필 저장 */
  saveProfile: async function(userId, profileData) {
    const encrypted = this.encryptData(profileData);
    const { error } = await _supabaseClient
      .from('profiles')
      .upsert({ id: userId, encrypted_data: encrypted, updated_at: new Date() });
    return { error };
  },

  /** 사용자 프로필 불러오기 */
  getProfile: async function(userId) {
    const { data, error } = await _supabaseClient
      .from('profiles')
      .select('encrypted_data')
      .eq('id', userId)
      .single();
    if (error || !data) return { data: null, error };
    return { data: this.decryptData(data.encrypted_data), error: null };
  },

  /** 먹기록(Diary) 저장 */
  saveDiary: async function(userId, dateStr, diaryData) {
    const encrypted = this.encryptData(diaryData);
    const { error } = await _supabaseClient
      .from('diaries')
      .upsert(
        { user_id: userId, date_str: dateStr, encrypted_data: encrypted, updated_at: new Date() },
        { onConflict: 'user_id, date_str' }
      );
    return { error };
  },

  /** 먹기록(Diary) 불러오기 */
  getDiary: async function(userId, dateStr) {
    const { data, error } = await _supabaseClient
      .from('diaries')
      .select('encrypted_data')
      .eq('user_id', userId)
      .eq('date_str', dateStr)
      .single();
    if (error || !data) return { data: null, error };
    return { data: this.decryptData(data.encrypted_data), error: null };
  },

  /** 즐겨찾기 저장 */
  saveFavorite: async function(userId, favoriteData) {
    const encrypted = this.encryptData(favoriteData);
    const { data, error } = await _supabaseClient
      .from('favorites')
      .insert({ user_id: userId, encrypted_data: encrypted })
      .select('id')
      .single();
    return { data, error };
  },

  /** 즐겨찾기 목록 불러오기 */
  getFavorites: async function(userId) {
    const { data, error } = await _supabaseClient
      .from('favorites')
      .select('id, encrypted_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return { data: [], error };

    const favorites = data.map(item => ({
      id: item.id,
      ...this.decryptData(item.encrypted_data)
    }));
    return { data: favorites, error: null };
  },

  /** 즐겨찾기 삭제 */
  deleteFavorite: async function(userId, favoriteId) {
    const { error } = await _supabaseClient
      .from('favorites')
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', userId);
    return { error };
  }

};

console.log('✅ ChloeDB (Supabase 클라이언트) 로드 완료!');
