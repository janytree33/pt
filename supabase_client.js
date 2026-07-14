const SUPABASE_URL = 'https://ykddsnxsfnvzpihzhklk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZGRzbnhzZm52enBpaHpoa2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODY2NDIsImV4cCI6MjA5OTQ2MjY0Mn0.FUwJmQenivUhORHO-2JQIT6Z6mkOH7upiew2bsh5MRA';

// Supabase 클라이언트 초기화
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// AES 암호화를 위한 고정 시크릿 키 (실제 서비스에서는 서버 환경변수로 관리해야 하지만 프론트엔드 환경이므로 난수화된 키 사용)
const ENCRYPTION_KEY = 'chloe_secret_diet_key_2026!@#$';

const ChloeDB = {
  /**
   * 데이터를 AES로 암호화합니다.
   * @param {Object} data 
   * @returns {string} 암호화된 문자열
   */
  encryptData: function(data) {
    try {
      const jsonStr = JSON.stringify(data);
      return CryptoJS.AES.encrypt(jsonStr, ENCRYPTION_KEY).toString();
    } catch (e) {
      console.error('암호화 실패:', e);
      return null;
    }
  },

  /**
   * AES 암호화된 문자열을 복호화합니다.
   * @param {string} encryptedText 
   * @returns {Object} 복호화된 JSON 객체
   */
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

  /**
   * 로그인 (이메일/비밀번호)
   */
  login: async function(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    return { data, error };
  },

  /**
   * 회원가입 (이메일/비밀번호)
   */
  signUp: async function(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    return { data, error };
  },

  /**
   * 로그아웃
   */
  logout: async function() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * 현재 로그인된 유저 세션 가져오기
   */
  getSession: async function() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },

  /**
   * 유저 프로필 저장
   */
  saveProfile: async function(userId, profileData) {
    const encrypted = this.encryptData(profileData);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, encrypted_data: encrypted, updated_at: new Date() });
    return { error };
  },

  /**
   * 유저 프로필 불러오기
   */
  getProfile: async function(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('encrypted_data')
      .eq('id', userId)
      .single();
    if (error || !data) return { data: null, error };
    return { data: this.decryptData(data.encrypted_data), error: null };
  },

  /**
   * 먹기록(Diary) 저장
   */
  saveDiary: async function(userId, dateStr, diaryData) {
    const encrypted = this.encryptData(diaryData);
    const { error } = await supabase
      .from('diaries')
      .upsert(
        { user_id: userId, date_str: dateStr, encrypted_data: encrypted, updated_at: new Date() },
        { onConflict: 'user_id, date_str' }
      );
    return { error };
  },

  /**
   * 먹기록(Diary) 불러오기
   */
  getDiary: async function(userId, dateStr) {
    const { data, error } = await supabase
      .from('diaries')
      .select('encrypted_data')
      .eq('user_id', userId)
      .eq('date_str', dateStr)
      .single();
    if (error || !data) return { data: null, error };
    return { data: this.decryptData(data.encrypted_data), error: null };
  },

  /**
   * 즐겨찾기(Favorites) 저장
   */
  saveFavorite: async function(userId, favoriteData) {
    const encrypted = this.encryptData(favoriteData);
    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, encrypted_data: encrypted })
      .select('id')
      .single();
    return { data, error };
  },

  /**
   * 즐겨찾기 목록 불러오기
   */
  getFavorites: async function(userId) {
    const { data, error } = await supabase
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

  /**
   * 즐겨찾기 삭제
   */
  deleteFavorite: async function(userId, favoriteId) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', userId);
    return { error };
  }
};
