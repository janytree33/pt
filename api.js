/**
 * ============================================================
 * api.js - 식품의약품안전처 API 호출 모듈
 * ============================================================
 * 📌 역할: 음식 이름으로 식약처 서버에 영양성분 데이터를 요청하고 받아옴
 * 
 * ⚠️ CORS 문제 해결:
 *    브라우저에서 직접 외부 API를 호출하면 보안 정책(CORS)으로 막힘.
 *    해결책: allorigins.win 무료 프록시를 통해 우회 호출.
 *    (마치 중간에 심부름꾼을 두는 것처럼!)
 * ============================================================
 */

// 식약처 API 설정값들을 한 곳에 모아둠
const API_CONFIG = {
  BASE_URL: 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02',
  SERVICE_KEY: '668dfc3cbb8b174ba844ef6cc27d6d26b46cf2c99fe460d01b2a62c13a5187f9',
  NUM_OF_ROWS: 10, // 한 번에 최대 10개 결과 받기
  DATA_TYPE: 'json'
};

// CORS 우회 프록시 주소
// 원래 URL 앞에 이 주소를 붙이면 프록시가 대신 요청해서 가져다줌
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * 식약처 API로 음식 검색하기
 * @param {string} foodName - 검색할 음식 이름 (예: "닭가슴살")
 * @param {number} page - 페이지 번호 (기본값: 1)
 * @returns {Promise<Array>} 검색 결과 음식 목록
 * 
 * async/await란? 
 *   인터넷에서 데이터를 받아오는 건 시간이 걸립니다.
 *   'await'는 "데이터가 도착할 때까지 여기서 잠깐 기다려!"라는 의미입니다.
 */
async function searchFood(foodName, page = 1) {
  // 검색어가 비어있으면 빈 배열 반환
  if (!foodName || foodName.trim() === '') return [];
  
  try {
    // API에 보낼 주소(URL) 만들기
    // URLSearchParams: 주소 뒤에 붙는 ?key=value 형태의 파라미터를 만들어주는 도구
    const params = new URLSearchParams({
      serviceKey: API_CONFIG.SERVICE_KEY,
      pageNo: page,
      numOfRows: API_CONFIG.NUM_OF_ROWS,
      type: API_CONFIG.DATA_TYPE,
      FOOD_NM_KR: foodName.trim() // 앞뒤 공백 제거
    });
    
    // 최종 API 요청 주소 조합
    const apiUrl = `${API_CONFIG.BASE_URL}?${params.toString()}`;
    const fullUrl = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`; // 프록시 통해 우회
    
    console.log('🔍 API 요청 URL:', apiUrl);
    
    // 타임아웃(5초) 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // fetch: 인터넷에서 데이터 가져오기
    const response = await fetch(fullUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // 응답이 실패했으면 에러 던지기
    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
    }
    
    // 응답 데이터를 JSON으로 파싱 (문자열 → 자바스크립트 객체)
    const data = await response.json();
    
    // 식약처 API 응답 구조에서 실제 음식 목록 꺼내기
    // 데이터가 없는 경우를 대비해 빈 배열 기본값 설정
    const items = data?.body?.items || [];
    
    console.log(`✅ "${foodName}" 검색 결과: ${items.length}개`);
    return items;
    
  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
    
    // 프록시 실패 시 직접 호출 시도 (개발 환경에서 CORS 허용된 경우)
    try {
      return await searchFoodDirect(foodName, page);
    } catch (directError) {
      console.error('❌ 직접 호출도 실패:', directError.message);
      return []; // 빈 배열 반환 (앱이 멈추지 않도록)
    }
  }
}

/**
 * 식약처 API 직접 호출 (프록시 없이)
 * 로컬 개발 서버나 CORS가 허용된 환경에서만 사용 가능
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
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  const response = await fetch(apiUrl, { signal: controller.signal });
  clearTimeout(timeoutId);
  
  if (!response.ok) throw new Error(`직접 API 오류: ${response.status}`);
  
  const data = await response.json();
  return data?.body?.items || [];
}

/**
 * 영양 데이터 정규화 (숫자로 변환 + 없는 값은 0으로)
 * API에서 받아온 데이터가 문자열('15.3')로 올 수도 있어서 숫자로 변환
 * @param {Object} rawItem - API 응답 원본 데이터
 * @returns {Object} 정규화된 영양 데이터
 */
function normalizeNutrition(rawItem) {
  return {
    FOOD_NM_KR: rawItem.FOOD_NM_KR || '이름 없음',
    AMT_NUM1:  parseFloat(rawItem.AMT_NUM1)  || 0, // 칼로리 (kcal)
    AMT_NUM3:  parseFloat(rawItem.AMT_NUM3)  || 0, // 단백질 (g)
    AMT_NUM4:  parseFloat(rawItem.AMT_NUM4)  || 0, // 지방 (g)
    AMT_NUM7:  parseFloat(rawItem.AMT_NUM7)  || 0, // 당류 (g) ⭐핵심 관리 지표
    AMT_NUM13: parseFloat(rawItem.AMT_NUM13) || 0, // 나트륨 (mg)
    // 원본 데이터도 보관 (다른 영양소가 필요할 때를 대비)
    _raw: rawItem
  };
}

/**
 * 당류를 '각설탕 개수'로 변환해주는 함수
 * 각설탕 1개 = 약 4g
 * @param {number} sugarGrams - 당류(g)
 * @returns {string} "각설탕 X개 분량" 문자열
 */
function sugarToCubeSugar(sugarGrams) {
  const cubes = Math.round(sugarGrams / 4);
  return cubes > 0 ? `각설탕 ${cubes}개` : '거의 없음';
}

/**
 * 나트륨을 직관적으로 표현해주는 함수
 * WHO 하루 권장량: 2000mg
 * @param {number} sodiumMg - 나트륨(mg)
 * @returns {string} 퍼센트 표현
 */
function sodiumToPercent(sodiumMg) {
  const percent = Math.round((sodiumMg / 2000) * 100);
  return `하루 권장량의 ${percent}%`;
}

// 외부에서 사용할 수 있도록 내보내기
window.ChloeAPI = {
  searchFood,
  normalizeNutrition,
  sugarToCubeSugar,
  sodiumToPercent
};
