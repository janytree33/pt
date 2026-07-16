/**
 * ============================================================
 * data.js - 클로이 앱 데이터 저장소 모듈 (로컬 우선 + 클라우드 동기화)
 * ============================================================
 * 📌 역할: 유저 정보와 식단 기록을 로컬스토리지에 빠르게 저장/읽기
 *          동시에 백그라운드에서 Supabase 클라우드와 동기화
 * ============================================================
 */

const STORAGE_KEYS = {
  USER_PROFILE: 'chloe_user_profile',
  DIARY: 'chloe_diary',
  SEARCH_HISTORY: 'chloe_search_history',
  FAVORITES: 'chloe_favorites', // 즐겨찾기(메모리) 추가
  CURRENT_USER_ID: 'chloe_current_user_id' // 로그인된 유저 ID
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getCurrentUserId() {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
}

// ============================================================
// 🔄 Supabase 클라우드 동기화 로직 (백그라운드)
// ============================================================

/**
 * 로그인 직후, Supabase에서 모든 데이터를 긁어와 로컬스토리지 덮어쓰기
 */
async function syncFromSupabase(userId) {
  if (!userId || !window.ChloeDB) return false;
  
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
    
    // 1. 프로필 동기화
    const { data: profile } = await ChloeDB.getProfile(userId);
    if (profile) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    }
    
    // 2. 다이어리 동기화 (임시로 최근 달만 가져올 수도 있지만, 일단 다 가져옴 - 실무에선 최적화 필요)
    // 현재는 로컬스토리지를 덮어쓰기 위해 모든 데이터를 가져오는 구조를 상정
    // MVP버전이므로 올해 데이터만 가져오는 예시:
    const yearMonth = new Date().getFullYear().toString();
    const { data: diaries } = await ChloeDB.getDiariesByMonth(userId, yearMonth);
    if (diaries && diaries.length > 0) {
      const entries = diaries.map(d => d.diaryData);
      localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    }
    
    // 3. 즐겨찾기 동기화
    const { data: favorites } = await ChloeDB.getFavorites(userId);
    if (favorites) {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    }
    
    return true;
  } catch (e) {
    console.error('동기화 실패:', e);
    return false;
  }
}

/**
 * 로그아웃 시 로컬 데이터 초기화
 */
function handleLogout() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  window.location.reload();
}

// ============================================================
// 👤 유저 프로필 관련 함수들
// ============================================================

function saveUserProfile(profileData) {
  try {
    const dataToSave = {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      ...profileData
    };
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(dataToSave));
    
    // 백그라운드 동기화
    const uid = getCurrentUserId();
    if (uid && window.ChloeDB) {
      ChloeDB.saveProfile(uid, dataToSave).catch(console.error);
    }
    
    return { success: true, data: dataToSave };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getUserProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!saved) {
      return {
        version: '1.0.0',
        goals: { intermittent_fasting: false, sugar_detox: false, protein_boost: false },
        nutrition_targets: { calories: 1750, protein: 100, fat: 70, sugar: 25 },
        sparta_mode: false,
        fasting_window: { start_hour: 20, end_hour: 12 },
        is_new_user: true
      };
    }
    let profile = JSON.parse(saved);
    if (!profile.nutrition_targets) profile.nutrition_targets = { calories: 1750, protein: 100, fat: 70, sugar: 25 };
    return profile;
  } catch (error) {
    return null;
  }
}

function updateGoal(goalKey, value) {
  const profile = getUserProfile();
  profile.goals[goalKey] = value;
  profile.sparta_mode = Object.values(profile.goals).every(v => v === true);
  return saveUserProfile(profile);
}

// ============================================================
// 📖 식단 일기(다이어리) 관련 함수들
// ============================================================

function getDiaryEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DIARY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

function getDiaryByDate(dateStr) {
  const entries = getDiaryEntries();
  return entries.find(entry => entry.date === dateStr) || null;
}

function saveDiaryToCloud(dateStr, todayEntry) {
  const uid = getCurrentUserId();
  if (uid && window.ChloeDB) {
    ChloeDB.saveDiary(uid, dateStr, todayEntry).catch(console.error);
  }
}

function addMealEntry(dateStr, mealData, stickers = []) {
  try {
    const entries = getDiaryEntries();
    let todayEntry = entries.find(e => e.date === dateStr);
    
    if (!todayEntry) {
      todayEntry = {
        id: generateUUID(), date: dateStr, meals: [],
        daily_totals: { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 },
        chloe_comment: ''
      };
      entries.push(todayEntry);
    }
    
    const newMeal = {
      meal_id: generateUUID(),
      food_name: mealData.FOOD_NM_KR || '이름 없음',
      meal_type: mealData.meal_type || '식사',
      api_data: {
        FOOD_NM_KR: mealData.FOOD_NM_KR,
        AMT_NUM1: parseFloat(mealData.AMT_NUM1) || 0,
        AMT_NUM3: parseFloat(mealData.AMT_NUM3) || 0,
        AMT_NUM4: parseFloat(mealData.AMT_NUM4) || 0,
        AMT_NUM7: parseFloat(mealData.AMT_NUM7) || 0,
        AMT_NUM13: parseFloat(mealData.AMT_NUM13) || 0,
        _basketItems: mealData._basketItems || null // 바스켓 병합 데이터 보존
      },
      logged_at: new Date().toISOString(),
      photo_base64: mealData.photo_base64 || null,
      note: mealData.note || '',
      stickers: stickers
    };
    
    todayEntry.meals.push(newMeal);
    
    if (!todayEntry.is_custom_order) {
      const MEAL_ORDER = { '아침': 1, '아침간식': 2, '점심': 3, '점심간식': 4, '저녁': 5, '저녁간식': 6 };
      todayEntry.meals.sort((a, b) => {
        const orderA = MEAL_ORDER[a.meal_type] || 99;
        const orderB = MEAL_ORDER[b.meal_type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.logged_at) - new Date(b.logged_at);
      });
    }
    
    todayEntry.daily_totals = calculateDailyTotals(todayEntry.meals);
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    
    saveDiaryToCloud(dateStr, todayEntry);
    
    return { success: true, meal: newMeal };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteMealEntry(dateStr, mealId) {
  try {
    const entries = getDiaryEntries();
    const todayEntry = entries.find(e => e.date === dateStr);
    if (!todayEntry) return { success: false, error: '해당 날짜 기록 없음' };
    
    todayEntry.meals = todayEntry.meals.filter(m => m.meal_id !== mealId);
    todayEntry.daily_totals = calculateDailyTotals(todayEntry.meals);
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    
    saveDiaryToCloud(dateStr, todayEntry);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateMealType(dateStr, mealId, newType) {
  try {
    const entries = getDiaryEntries();
    const todayEntry = entries.find(e => e.date === dateStr);
    if (!todayEntry) return { success: false, error: '해당 날짜 기록 없음' };
    
    const meal = todayEntry.meals.find(m => m.meal_id === mealId);
    if (!meal) return { success: false, error: '해당 식단 없음' };
    
    meal.meal_type = newType;
    
    // 식사 순서 재정렬 (사용자가 임의 순서를 바꾸지 않았다면)
    if (!todayEntry.is_custom_order) {
      const MEAL_ORDER = { '아침': 1, '아침간식': 2, '점심': 3, '점심간식': 4, '저녁': 5, '저녁간식': 6 };
      todayEntry.meals.sort((a, b) => {
        const orderA = MEAL_ORDER[a.meal_type] || 99;
        const orderB = MEAL_ORDER[b.meal_type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.logged_at) - new Date(b.logged_at);
      });
    }
    
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    saveDiaryToCloud(dateStr, todayEntry);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateMealOrder(dateStr, mealIds) {
  try {
    const entries = getDiaryEntries();
    const todayEntry = entries.find(e => e.date === dateStr);
    if (!todayEntry) return { success: false };
    
    const orderedMeals = [];
    mealIds.forEach(id => {
      const meal = todayEntry.meals.find(m => m.meal_id === id);
      if (meal) orderedMeals.push(meal);
    });
    
    todayEntry.meals.forEach(m => {
      if (!orderedMeals.includes(m)) orderedMeals.push(m);
    });
    
    todayEntry.meals = orderedMeals;
    todayEntry.is_custom_order = true;
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    
    saveDiaryToCloud(dateStr, todayEntry);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function calculateDailyTotals(meals) {
  return meals.reduce((acc, meal) => {
    return {
      calories: Math.round((acc.calories + (meal.api_data.AMT_NUM1 || 0)) * 10) / 10,
      protein:  Math.round((acc.protein  + (meal.api_data.AMT_NUM3 || 0)) * 10) / 10,
      fat:      Math.round((acc.fat      + (meal.api_data.AMT_NUM4 || 0)) * 10) / 10,
      sugar:    Math.round((acc.sugar    + (meal.api_data.AMT_NUM7 || 0)) * 10) / 10,
      sodium:   Math.round((acc.sodium   + (meal.api_data.AMT_NUM13|| 0)) * 10) / 10
    };
  }, { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 });
}

// ============================================================
// ⭐ 즐겨찾기(자주 먹는 메뉴) 관련 함수들
// ============================================================

function getFavorites() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

function saveFavorite(favoriteData) {
  try {
    const favorites = getFavorites();
    // 중복 방지 (이름이 같으면 건너뜀)
    if (favorites.find(f => f.FOOD_NM_KR === favoriteData.FOOD_NM_KR)) {
      return { success: false, error: '이미 즐겨찾기에 있습니다.' };
    }
    
    // 임시 ID (클라우드 저장시 교체됨)
    favoriteData.id = generateUUID(); 
    favorites.unshift(favoriteData);
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));

    // 클라우드 동기화
    const uid = getCurrentUserId();
    if (uid && window.ChloeDB) {
      ChloeDB.saveFavorite(uid, favoriteData).then(({data}) => {
        if (data && data.id) {
          // 서버 발급 ID로 교체
          const idx = favorites.findIndex(f => f.id === favoriteData.id);
          if (idx !== -1) {
            favorites[idx].id = data.id;
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
          }
        }
      });
    }

    return { success: true, data: favoriteData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function removeFavorite(favoriteId) {
  try {
    let favorites = getFavorites();
    favorites = favorites.filter(f => f.id !== favoriteId);
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));

    const uid = getCurrentUserId();
    if (uid && window.ChloeDB) {
      ChloeDB.deleteFavorite(uid, favoriteId).catch(console.error);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 🔍 검색 기록 관련 함수들
// ============================================================

function saveSearchHistory(keyword) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    let history = saved ? JSON.parse(saved) : [];
    history = history.filter(k => k !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
  } catch (error) {}
}

function deleteSearchHistory(keyword) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    if (!saved) return;
    let history = JSON.parse(saved);
    history = history.filter(k => k !== keyword);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
  } catch (error) {}
}

function getSearchHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    const history = saved ? JSON.parse(saved) : [];
    return history.filter(item => item && item.trim() !== '');
  } catch (error) {
    return [];
  }
}

function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

// ============================================================
// 📦 외부에서 사용할 수 있도록 내보내기
// ============================================================
window.ChloeData = {
  saveUserProfile, getUserProfile, updateGoal,
  getDiaryEntries, getDiaryByDate, addMealEntry, deleteMealEntry, updateMealType, updateMealOrder,
  getFavorites, saveFavorite, removeFavorite, // 즐겨찾기 API 추가
  getSearchHistory, saveSearchHistory, deleteSearchHistory,
  clearAllData, generateUUID,
  syncFromSupabase, handleLogout, getCurrentUserId // Supabase 인증 관련
};
