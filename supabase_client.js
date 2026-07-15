const SUPABASE_URL = 'https://ykddsnxsfnvzpihzhklk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZGRzbnhzZm52enBpaHpoa2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODY2NDIsImV4cCI6MjA5OTQ2MjY0Mn0.FUwJmQenivUhORHO-2JQIT6Z6mkOH7upiew2bsh5MRA';

// Supabase 클라이언트 초기화
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// AES ?뷀샇?붾? ?꾪븳 怨좎젙 ?쒗겕由???(?ㅼ젣 ?쒕퉬?ㅼ뿉?쒕뒗 ?쒕쾭 ?섍꼍蹂?섎줈 愿由ы빐???섏?留??꾨줎?몄뿏???섍꼍?대?濡??쒖닔?붾맂 ???ъ슜)
const ENCRYPTION_KEY = 'chloe_secret_diet_key_2026!@#$';

window.ChloeDB = {
  /**
   * ?곗씠?곕? AES濡??뷀샇?뷀빀?덈떎.
   * @param {Object} data 
   * @returns {string} ?뷀샇?붾맂 臾몄옄??   */
  encryptData: function(data) {
    try {
      const jsonStr = JSON.stringify(data);
      return CryptoJS.AES.encrypt(jsonStr, ENCRYPTION_KEY).toString();
    } catch (e) {
      console.error('?뷀샇???ㅽ뙣:', e);
      return null;
    }
  },

  /**
   * AES ?뷀샇?붾맂 臾몄옄?댁쓣 蹂듯샇?뷀빀?덈떎.
   * @param {string} encryptedText 
   * @returns {Object} 蹂듯샇?붾맂 JSON 媛앹껜
   */
  decryptData: function(encryptedText) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (e) {
      console.error('蹂듯샇???ㅽ뙣:', e);
      return null;
    }
  },

  /**
   * 濡쒓렇??(?대찓??鍮꾨?踰덊샇)
   */
  login: async function(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    return { data, error };
  },

  /**
   * ?뚯썝媛??(?대찓??鍮꾨?踰덊샇)
   */
  signUp: async function(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    return { data, error };
  },

  /**
   * 濡쒓렇?꾩썐
   */
  logout: async function() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * ?꾩옱 濡쒓렇?몃맂 ?좎? ?몄뀡 媛?몄삤湲?   */
  getSession: async function() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },

  /**
   * ?좎? ?꾨줈?????   */
  saveProfile: async function(userId, profileData) {
    const encrypted = this.encryptData(profileData);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, encrypted_data: encrypted, updated_at: new Date() });
    return { error };
  },

  /**
   * ?좎? ?꾨줈??遺덈윭?ㅺ린
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
   * 癒밴린濡?Diary) ???   */
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
   * 癒밴린濡?Diary) 遺덈윭?ㅺ린
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
   * 利먭꺼李얘린(Favorites) ???   */
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
   * 利먭꺼李얘린 紐⑸줉 遺덈윭?ㅺ린
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
   * 利먭꺼李얘린 ??젣
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
