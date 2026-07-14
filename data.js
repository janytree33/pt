/**
 * ============================================================
 * data.js - 클로이 앱 데이터 저장소 모듈
 * ============================================================
 * 📌 역할: 유저 정보와 식단 기록을 로컬스토리지에 저장/읽기
 * 
 * ⚡ 중요: 나중에 Supabase로 전환할 때 이 파일만 수정하면 됩니다!
 *    - saveUserProfile() → Supabase INSERT/UPDATE 로 교체
 *    - getDiaryEntries() → Supabase SELECT 로 교체
 * ============================================================
 */

// 로컬스토리지에서 사용할 키(Key) 이름들을 한 곳에 모아둠
// (나중에 Supabase 테이블명으로 바꾸기 편하도록)
const STORAGE_KEYS = {
  USER_PROFILE: 'chloe_user_profile',   // 유저 목표 설정
  DIARY: 'chloe_diary',                  // 날짜별 식단 기록
  SEARCH_HISTORY: 'chloe_search_history' // 최근 검색 기록
};

// ============================================================
// 🔧 유틸리티: UUID 생성기 (각 기록에 고유 ID를 붙여주는 함수)
// 마치 도서관 책마다 고유 번호를 붙이는 것처럼!
// ============================================================
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================
// 👤 유저 프로필 관련 함수들
// ============================================================

/**
 * 유저 프로필 저장하기
 * @param {Object} profileData - 저장할 프로필 데이터
 * 
 * 저장되는 JSON 구조 예시:
 * {
 *   "version": "1.0.0",
 *   "created_at": "2026-07-14T10:00:00+09:00",
 *   "goals": {
 *     "intermittent_fasting": false, // 간헐적 단식
 *     "sugar_detox": true,           // 슈가 디톡스
 *     "protein_boost": false         // 득근득근
 *   },
 *   "sparta_mode": false,            // 3가지 모두 켜면 true
 *   "fasting_window": {
 *     "start_hour": 20,              // 단식 시작 시간 (오후 8시)
 *     "end_hour": 12                 // 식사 시작 시간 (낮 12시)
 *   }
 * }
 */
function saveUserProfile(profileData) {
  try {
    // 데이터에 버전과 저장 시간을 자동으로 추가
    const dataToSave = {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      ...profileData // 전달받은 데이터를 펼쳐서 합침
    };
    // JSON.stringify: 자바스크립트 객체를 문자열로 변환 (로컬스토리지는 문자열만 저장 가능)
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(dataToSave));
    console.log('✅ 유저 프로필 저장 완료:', dataToSave);
    return { success: true, data: dataToSave };
  } catch (error) {
    console.error('❌ 프로필 저장 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 유저 프로필 불러오기
 * @returns {Object|null} 저장된 프로필 데이터, 없으면 기본값 반환
 */
function getUserProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!saved) {
      // 처음 사용하는 유저라면 기본값 반환
      return {
        version: '1.0.0',
        goals: {
          intermittent_fasting: false,
          sugar_detox: false,
          protein_boost: false
        },
        nutrition_targets: {
          calories: 1750,
          protein: 100,
          fat: 70,
          sugar: 25
        },
        sparta_mode: false,
        fasting_window: { start_hour: 20, end_hour: 12 },
        is_new_user: true // 처음 접속한 유저임을 표시
      };
    }
    // JSON.parse: 문자열을 다시 자바스크립트 객체로 변환
    let profile = JSON.parse(saved);
    // 기존 유저 데이터에 nutrition_targets가 없으면 추가
    if (!profile.nutrition_targets) {
      profile.nutrition_targets = { calories: 1750, protein: 100, fat: 70, sugar: 25 };
    }
    return profile;
  } catch (error) {
    console.error('❌ 프로필 불러오기 실패:', error);
    return null;
  }
}

/**
 * 목표(토글) 상태만 업데이트하기
 * @param {string} goalKey - 'intermittent_fasting' | 'sugar_detox' | 'protein_boost'
 * @param {boolean} value - true(켜기) | false(끄기)
 */
function updateGoal(goalKey, value) {
  const profile = getUserProfile();
  profile.goals[goalKey] = value;
  
  // 3가지 목표가 모두 켜져 있으면 스파르타 모드 자동 활성화!
  const allGoalsActive = Object.values(profile.goals).every(v => v === true);
  profile.sparta_mode = allGoalsActive;
  
  return saveUserProfile(profile);
}

// ============================================================
// 📖 식단 일기(다이어리) 관련 함수들
// ============================================================

/**
 * 전체 식단 기록 불러오기
 * @returns {Array} 날짜별 식단 기록 배열
 */
function getDiaryEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DIARY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('❌ 다이어리 불러오기 실패:', error);
    return [];
  }
}

/**
 * 특정 날짜의 식단 기록 불러오기
 * @param {string} dateStr - 'YYYY-MM-DD' 형식 날짜
 * @returns {Object|null} 해당 날짜 기록
 */
function getDiaryByDate(dateStr) {
  const entries = getDiaryEntries();
  return entries.find(entry => entry.date === dateStr) || null;
}

/**
 * 식단 기록 추가하기 (식사 1개 추가)
 * @param {string} dateStr - 날짜 'YYYY-MM-DD'
 * @param {Object} mealData - 식사 데이터 (API 응답 + 사진 + 메모)
 * @param {Array} stickers - 자동 부여된 스티커 목록
 */
function addMealEntry(dateStr, mealData, stickers = []) {
  try {
    const entries = getDiaryEntries();
    
    // 오늘 날짜 기록이 이미 있는지 찾기
    let todayEntry = entries.find(e => e.date === dateStr);
    
    // 오늘 날짜 기록이 없으면 새로 만들기
    if (!todayEntry) {
      todayEntry = {
        id: generateUUID(),
        date: dateStr,
        meals: [],
        daily_totals: { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 },
        chloe_comment: ''
      };
      entries.push(todayEntry);
    }
    
    // 새 식사 기록 객체 만들기
    const newMeal = {
      meal_id: generateUUID(),
      food_name: mealData.FOOD_NM_KR || '이름 없음',
      meal_type: mealData.meal_type || '식사', // 추가됨
      api_data: {
        FOOD_NM_KR: mealData.FOOD_NM_KR,
        AMT_NUM1: parseFloat(mealData.AMT_NUM1) || 0,  // 칼로리
        AMT_NUM3: parseFloat(mealData.AMT_NUM3) || 0,  // 단백질
        AMT_NUM4: parseFloat(mealData.AMT_NUM4) || 0,  // 지방
        AMT_NUM7: parseFloat(mealData.AMT_NUM7) || 0,  // 당류 ⭐핵심
        AMT_NUM13: parseFloat(mealData.AMT_NUM13) || 0 // 나트륨
      },
      logged_at: new Date().toISOString(),
      photo_base64: mealData.photo_base64 || null, // 사진 (Base64 인코딩)
      note: mealData.note || '',
      stickers: stickers
    };
    
    // 오늘 식사 목록에 추가
    todayEntry.meals.push(newMeal);
    
    // 사용자가 직접 순서를 바꾸지 않았다면 지정된 순서대로 정렬
    if (!todayEntry.is_custom_order) {
      const MEAL_ORDER = { '아침': 1, '아침간식': 2, '점심': 3, '점심간식': 4, '저녁': 5, '저녁간식': 6 };
      todayEntry.meals.sort((a, b) => {
        const orderA = MEAL_ORDER[a.meal_type] || 99;
        const orderB = MEAL_ORDER[b.meal_type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.logged_at) - new Date(b.logged_at);
      });
    }
    
    // 오늘 하루 영양소 합계 다시 계산
    todayEntry.daily_totals = calculateDailyTotals(todayEntry.meals);
    
    // 전체 목록 저장
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    console.log('✅ 식단 기록 저장 완료:', newMeal);
    return { success: true, meal: newMeal };
  } catch (error) {
    console.error('❌ 식단 기록 저장 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 특정 식사 기록 삭제하기
 * @param {string} dateStr - 날짜
 * @param {string} mealId - 삭제할 식사의 고유 ID
 */
function deleteMealEntry(dateStr, mealId) {
  try {
    const entries = getDiaryEntries();
    const todayEntry = entries.find(e => e.date === dateStr);
    if (!todayEntry) return { success: false, error: '해당 날짜 기록 없음' };
    
    // 해당 meal_id를 제외하고 필터링 (삭제 효과)
    todayEntry.meals = todayEntry.meals.filter(m => m.meal_id !== mealId);
    todayEntry.daily_totals = calculateDailyTotals(todayEntry.meals);
    
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 드래그 앤 드롭으로 변경된 식사 순서 저장하기
 * @param {string} dateStr - 날짜
 * @param {Array} mealIds - 변경된 순서대로 정렬된 meal_id 배열
 */
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
    
    // 혹시 누락된 식사가 있다면 끝에 추가
    todayEntry.meals.forEach(m => {
      if (!orderedMeals.includes(m)) orderedMeals.push(m);
    });
    
    todayEntry.meals = orderedMeals;
    todayEntry.is_custom_order = true; // 커스텀 정렬 플래그 켬
    
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(entries));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 하루 영양소 합계 계산하기 (내부 함수)
 * @param {Array} meals - 식사 기록 배열
 * @returns {Object} 합계 영양소 객체
 */
function calculateDailyTotals(meals) {
  return meals.reduce((acc, meal) => {
    return {
      calories: Math.round((acc.calories + (meal.api_data.AMT_NUM1 || 0)) * 10) / 10,
      protein:  Math.round((acc.protein  + (meal.api_data.AMT_NUM3 || 0)) * 10) / 10,
      fat:      Math.round((acc.fat      + (meal.api_data.AMT_NUM4 || 0)) * 10) / 10,
      sugar:    Math.round((acc.sugar    + (meal.api_data.AMT_NUM7 || 0)) * 10) / 10,
      sodium:   Math.round((acc.sodium   + (meal.api_data.AMT_NUM13|| 0)) * 10) / 10
    };
  }, { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 }); // 초기값
}

// ============================================================
// 🔍 검색 기록 관련 함수들
// ============================================================

/**
 * 최근 검색어 저장 (최대 10개 유지)
 * @param {string} keyword - 검색어
 */
function saveSearchHistory(keyword) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    let history = saved ? JSON.parse(saved) : [];
    
    // 중복 제거: 이미 있는 검색어는 맨 앞으로 이동
    history = history.filter(k => k !== keyword);
    history.unshift(keyword); // 맨 앞에 추가
    
    // 최대 10개만 유지
    if (history.length > 10) history = history.slice(0, 10);
    
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('❌ 검색 기록 저장 실패:', error);
  }
}

/**
 * 최근 검색어 개별 삭제
 * @param {string} keyword - 삭제할 검색어
 */
function deleteSearchHistory(keyword) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    if (!saved) return;
    
    let history = JSON.parse(saved);
    history = history.filter(k => k !== keyword);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('❌ 검색 기록 삭제 실패:', error);
  }
}

/**
 * 최근 검색어 목록 가져오기
 * @returns {Array} 검색어 배열
 */
function getSearchHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    const history = saved ? JSON.parse(saved) : [];
    // 기존에 버그로 들어갔던 빈 문자열 히스토리를 걸러냅니다.
    return history.filter(item => item && item.trim() !== '');
  } catch (error) {
    return [];
  }
}

/**
 * 모든 데이터 초기화 (리셋)
 * ⚠️ 주의: 이 함수를 실행하면 모든 기록이 삭제됩니다!
 */
function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  console.log('🗑️ 모든 클로이 앱 데이터가 삭제되었습니다.');
}

// ============================================================
// 📦 외부에서 사용할 수 있도록 내보내기 (모듈 exports)
// ============================================================
window.ChloeData = {
  saveUserProfile,
  getUserProfile,
  updateGoal,
  getDiaryEntries,
  getDiaryByDate,
  addMealEntry,
  deleteMealEntry,
  updateMealOrder,
  getSearchHistory,
  saveSearchHistory,
  deleteSearchHistory,
  clearAllData,
  generateUUID
};
