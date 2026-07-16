/**
 * ============================================================
 * api.js - 식품의약품안전처 API 호출 모듈 (캐싱 기능 추가)
 * ============================================================
 * 📌 역할: 음식 이름으로 식약처 서버에 영양성분 데이터를 요청하고 받아옴
 *
 * ⚡ 캐싱 전략:
 *    1. 검색 시 먼저 로컬 캐시(localStorage) 확인
 *    2. 캐시에 있으면 즉시 반환 (API 호출 없음 → 초고속!)
 *    3. 캐시에 없으면 API 호출 후 결과를 캐시에 저장
 *    4. 캐시 유효기간: 7일 (오래된 데이터 자동 삭제)
 * ============================================================
 */

// 식약처 API 설정값들을 한 곳에 모아둠
const API_CONFIG = {
  BASE_URL: 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02',
  SERVICE_KEY: '668dfc3cbb8b174ba844ef6cc27d6d26b46cf2c99fe460d01b2a62c13a5187f9',
  NUM_OF_ROWS: 10,
  DATA_TYPE: 'json'
};

// CORS 우회 프록시 주소
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// ============================================================
// 🚀 캐시 관련 함수들
// ============================================================

const CACHE_KEY = 'chloe_food_cache';
const CACHE_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

/**
 * 캐시에서 검색 결과 가져오기
 * @param {string} query - 검색어
 * @returns {Array|null} 캐시된 결과 또는 null
 */
function getCachedResult(query) {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache = JSON.parse(cacheStr);
    const key = query.trim().toLowerCase();
    const entry = cache[key];

    if (!entry) return null;

    // 유효기간 확인 (7일 지나면 무효)
    if (Date.now() - entry.timestamp > CACHE_EXPIRE_MS) {
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    console.log(`⚡ 캐시 히트! "${query}" → 즉시 반환`);
    return entry.data;
  } catch (e) {
    return null;
  }
}

/**
 * 검색 결과를 캐시에 저장
 * @param {string} query - 검색어
 * @param {Array} data - 저장할 데이터
 */
function setCachedResult(query, data) {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    const cache = cacheStr ? JSON.parse(cacheStr) : {};
    const key = query.trim().toLowerCase();

    cache[key] = {
      timestamp: Date.now(),
      data: data
    };

    // 캐시 크기 제한: 최대 100개 항목 유지
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      // 가장 오래된 항목 삭제
      const oldest = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
      delete cache[oldest];
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log(`💾 캐시 저장: "${query}"`);
  } catch (e) {
    console.warn('캐시 저장 실패:', e);
  }
}

/**
 * 캐시 전체 목록 가져오기 (자동완성용)
 * @param {string} query - 타이핑 중인 검색어
 * @returns {Array} 캐시에서 일치하는 음식 목록
 */
function searchCache(query) {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return [];

    const cache = JSON.parse(cacheStr);
    const keyword = query.trim().toLowerCase();
    const results = [];

    for (const key in cache) {
      if (key.includes(keyword)) {
        const items = cache[key].data || [];
        items.forEach(item => {
          if (!results.find(r => r.FOOD_NM_KR === item.FOOD_NM_KR)) {
            results.push(item);
          }
        });
      }
    }

    return results.slice(0, 5); // 최대 5개
  } catch (e) {
    return [];
  }
}

// ============================================================
// 🔍 메인 검색 함수 (캐싱 적용)
// ============================================================

/**
 * 식약처 API로 음식 검색하기 (캐싱 포함)
 * @param {string} foodName - 검색할 음식 이름
 * @param {number} page - 페이지 번호 (기본값: 1)
 * @returns {Promise<Array>} 검색 결과 음식 목록
 */
async function searchFood(foodName, page = 1) {
  if (!foodName || foodName.trim() === '') return [];

  // ⚡ 1. 먼저 캐시 확인 (page=1일 때만)
  if (page === 1) {
    const cached = getCachedResult(foodName);
    if (cached) return cached;
  }

  try {
    const params = new URLSearchParams({
      serviceKey: API_CONFIG.SERVICE_KEY,
      pageNo: page,
      numOfRows: API_CONFIG.NUM_OF_ROWS,
      type: API_CONFIG.DATA_TYPE,
      FOOD_NM_KR: foodName.trim()
    });

    const apiUrl = `${API_CONFIG.BASE_URL}?${params.toString()}`;
    const fullUrl = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;

    console.log('🔍 API 요청:', foodName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(fullUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const items = data?.body?.items || [];

    console.log(`✅ "${foodName}" 검색 결과: ${items.length}개`);

    // 💾 2. 결과를 캐시에 저장 (다음엔 즉시 반환!)
    if (items.length > 0 && page === 1) {
      setCachedResult(foodName, items);
    }

    return items;

  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);

    try {
      return await searchFoodDirect(foodName, page);
    } catch (directError) {
      console.error('❌ 직접 호출도 실패:', directError.message);
      return [];
    }
  }
}

/**
 * 식약처 API 직접 호출 (프록시 없이)
 */
async function searchFoodDirect(foodName, page = 1) {
  const params = new URLSearchParams({
    serviceKey: API_CONFIG.SERVICE_KEY,
    pageNo: page,
    numOfRows: API_CONFIG.NUM_OF_ROWS,
    type: API_CONFIG.DATA_TYPE,
    FOOD_NM_KR: foodName.trim()
  });

  const apiUrl = `${API_CONFIG.BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(apiUrl, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!response.ok) throw new Error(`직접 API 오류: ${response.status}`);

  const data = await response.json();
  const items = data?.body?.items || [];

  if (items.length > 0 && page === 1) {
    setCachedResult(foodName, items);
  }

  return items;
}

/**
 * 영양 데이터 정규화 (숫자로 변환 + 없는 값은 0으로)
 */
function normalizeNutrition(rawItem) {
  return {
    FOOD_NM_KR: rawItem.FOOD_NM_KR || '이름 없음',
    AMT_NUM1:  parseFloat(rawItem.AMT_NUM1)  || 0, // 칼로리 (kcal)
    AMT_NUM3:  parseFloat(rawItem.AMT_NUM3)  || 0, // 단백질 (g)
    AMT_NUM4:  parseFloat(rawItem.AMT_NUM4)  || 0, // 지방 (g)
    AMT_NUM7:  parseFloat(rawItem.AMT_NUM7)  || 0, // 당류 (g)
    AMT_NUM13: parseFloat(rawItem.AMT_NUM13) || 0, // 나트륨 (mg)
    _raw: rawItem
  };
}

/**
 * 당류를 '각설탕 개수'로 변환
 */
function sugarToCubeSugar(sugarGrams) {
  const cubes = Math.round(sugarGrams / 4);
  return cubes > 0 ? `각설탕 ${cubes}개` : '거의 없음';
}

/**
 * 나트륨을 직관적으로 표현
 */
function sodiumToPercent(sodiumMg) {
  const percent = Math.round((sodiumMg / 2000) * 100);
  return `하루 권장량의 ${percent}%`;
}

// 외부에서 사용할 수 있도록 전역 등록
window.ChloeAPI = {
  searchFood,
  normalizeNutrition,
  sugarToCubeSugar,
  sodiumToPercent,
  searchCache,    // ⚡ 자동완성용 캐시 검색
  getCachedResult // 캐시 직접 조회
};
