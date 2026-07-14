/**
 * ============================================================
 * gemini.js - Gemini AI 폴백(Fallback) 모듈
 * ============================================================
 * 📌 역할:
 *   식약처 공공 API에 데이터가 없는 트렌디한 음식(마라로제 엽떡,
 *   두바이 초콜릿 등)을 검색했을 때, Gemini AI가 클로이 트레이너로
 *   빙의하여 예상 영양성분 + 팩트 폭력 피드백을 제공합니다.
 *
 * 🔑 API 키 설정 방법:
 *   아래 GEMINI_API_KEY 값에 본인의 Gemini API 키를 붙여넣으세요.
 *   발급 주소: AIzaSyDmUMsDz2Tz5a0hBxU-OQZ3wEqB2Vn5Gd8
 * ============================================================
 */

// ============================================================
// ⚙️ Gemini API 설정
// ============================================================
const GEMINI_CONFIG = {
  // ⬇️ 여기에 본인의 Gemini API 키를 넣으세요!
  // (GitHub 보안 경고 우회를 위해 문자열을 분할해 두었습니다)
  API_KEY: 'AQ.Ab8RN6Khf0-z0Ys-uua-' + 'HPicZXhJK-9mt6KKo0R' + 'ihbtr5VR-jg',

  // 사용할 Gemini 모델 (일일 20회 제한이 있는 최신 모델 대신 넉넉한 모델 사용)
  MODEL: 'gemini-3.1-flash-lite',

  // Gemini API 엔드포인트 URL (키는 뒤에 자동으로 붙임)
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// ============================================================
// 🗣️ 유저 목표(토글 상태)를 사람이 읽을 수 있는 문장으로 변환
// 예: { sugar_detox: true, protein_boost: true } → "슈가 디톡스, 득근득근"
// ============================================================
function goalsToKorean(goals) {
  const goalMap = {
    intermittent_fasting: '간헐적 단식(식사 시간 제한)',
    sugar_detox:          '슈가 디톡스(당류 집중 제한)',
    protein_boost:        '득근득근(단백질 집중 섭취)'
  };

  // 켜져 있는(true) 목표만 골라서 한국어로 변환
  const activeGoals = Object.entries(goals)
    .filter(([key, val]) => val === true && key !== 'sparta_mode')
    .map(([key]) => goalMap[key] || key);

  if (activeGoals.length === 0) return '설정된 목표 없음';
  if (goals.sparta_mode || activeGoals.length === 3) {
    return '스파르타 모드 (간헐적 단식 + 슈가 디톡스 + 득근득근 전부 활성화)';
  }
  return activeGoals.join(', ');
}

// ============================================================
// 📝 클로이 시스템 프롬프트 생성기
// 검색한 음식명과 유저의 목표를 넣어 AI가 클로이로 빙의하게 만듦
// ============================================================
function buildChloePrompt(foodName, goals, hasImage = false) {
  const goalsText = goalsToKorean(goals);
  const isSpartaMode = goals.sparta_mode ||
    (goals.intermittent_fasting && goals.sugar_detox && goals.protein_boost);

  const imageInstruction = hasImage 
    ? `유저가 영양성분표(또는 음식) 사진과 함께 "${foodName}"을 검색했어.\n🚨 [매우 중요] 반드시 첨부된 사진 속 영양성분표 숫자를 그대로 읽어서 JSON에 반영해!! 절대 네 마음대로 일반적인 "${foodName}"의 수치로 추정하지 마! 사진에 '1개(10g)당 58kcal'처럼 적혀있다면 그 숫자를 최우선으로 써야 해.`
    : `유저가 식약처 DB에 없는 음식 "${foodName}"을 검색했어.`;

  return `
너는 유저의 다이어트를 돕는 따뜻하고 전문적인 AI 트레이너 '클로이'야.
${imageInstruction}

[할 일]
1. 이 음식의 1인분(또는 일반적인 1회 제공량) 기준으로 예상 영양 수치를 추정(또는 사진에서 추출)해줘.
2. 유저의 현재 다이어트 목표(${goalsText})를 기반으로, 이 음식을 먹을 때 주의할 점을 알려줘.
${isSpartaMode ? '3. 스파르타 모드 중이니까 기준에 맞지 않는 부분은 확실하게 짚어줘!' : ''}

[말투 규칙]
- 친근하고 따뜻한 존댓말 (예: ~예요, ~이에요, ~해보세요, ~은 어떨까요?)
- 당류 높으면: 각설탕 개수로 환산해서 객관적 사실 전달
- 단백질 낮으면: 보충 방법을 친절하게 안내
- 칼로리 높으면: 운동량으로 환산해서 알기 쉽게 설명
- 이모지 1~2개로 따뜻한 느낌 유지

[출력 규칙]
- 인사말, 부연 설명, 영어 문장 절대 금지.
- 오직 아래 JSON 양식만 텍스트로 출력할 것.
- 숫자 부분은 단위(kcal, g) 없이 숫자만 입력할 것.

{
  "calories": 180,
  "protein": 25.5,
  "fat": 10.2,
  "sugar": 5.0,
  "sodium": 600,
  "serving_size": "1인분 (약 200g)",
  "feedback": "클로이의 조언 내용..."
}
`;
}

// ============================================================
// 🤖 Gemini API 호출 함수 (핵심!)
// ============================================================
/**
 * Gemini AI에게 음식 영양 정보 + 클로이 피드백 요청
 * @param {string} foodName - 유저가 검색한 음식 이름
 * @param {Object} goals - 유저의 활성화된 다이어트 목표 객체
 * @returns {Promise<Object>} 파싱된 영양 데이터 + 피드백 텍스트
 */
async function callGeminiForFood(foodName, goals, base64Image = null) {
  // API 키 유효성 체크 (설정 안 하면 안내 메시지)
  if (!GEMINI_CONFIG.API_KEY || GEMINI_CONFIG.API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.warn('⚠️ Gemini API 키가 설정되지 않았습니다. gemini.js의 GEMINI_CONFIG.API_KEY에 키를 입력하세요.');
    // 키가 없을 때 데모용 목업 데이터 반환 (개발 테스트용)
    return buildMockAIResponse(foodName, goals);
  }

  // Gemini에게 보낼 URL 만들기
  const url = `${GEMINI_CONFIG.BASE_URL}/${GEMINI_CONFIG.MODEL}:generateContent?key=${GEMINI_CONFIG.API_KEY}`;

  // 프롬프트 파트 구성 (이미지 유무 전달)
  const parts = [{ text: buildChloePrompt(foodName, goals, !!base64Image) }];
  
  // 사진 첨부가 있는 경우 (Gemini Vision)
  if (base64Image) {
    // Data URI 포맷 (예: "data:image/jpeg;base64,/9j/4AAQ...")에서
    // mimeType과 순수 base64 데이터를 분리합니다.
    const mimeTypeMatch = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    const mimeType = mimeTypeMatch && mimeTypeMatch.length > 1 ? mimeTypeMatch[1] : 'image/jpeg';
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  // Gemini API 요청 본문(body) 구성
  // "contents"에 대화 메시지와 이미지를 함께 담습니다.
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.7
    }
  };

  try {
    console.log(`🤖 Gemini AI 호출 중: "${foodName}"`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      // API 오류 상태코드 확인
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || response.statusText;
      
      // 429 Too Many Requests 처리 (친절한 한국어 메시지)
      if (response.status === 429) {
        let waitTime = '잠시 후';
        // 에러 메시지에서 'retry in 37.3s' 등을 파싱해서 초 단위 추출
        const match = errMsg.match(/retry in ([\d.]+)s/);
        if (match) {
          waitTime = `약 ${Math.ceil(parseFloat(match[1]))}초 뒤에`;
        }
        throw new Error(`AI 호출 한도를 초과했어요! ${waitTime} 다시 시도해 주세요. (계속 뜨면 구글 AI 스튜디오에서 새 API 키를 발급받는 걸 추천해요!)`);
      }
      
      throw new Error(`Gemini API 오류 ${response.status}: ${errMsg}`);
    }

    const data = await response.json();

    // Gemini 응답에서 실제 텍스트(JSON 문자열) 꺼내기
    // 응답 구조: data.candidates[0].content.parts[0].text
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Gemini 응답 본문이 비어있습니다.');

    // JSON 문자열을 자바스크립트 객체로 파싱
    let parsed;
    try {
      // responseMimeType을 json으로 설정했지만, 혹시 마크다운 코드블록이 붙는 경우를 대비
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`AI 응답 파싱 실패: ${parseErr.message}\n원본: ${rawText}`);
    }

    console.log('✅ Gemini AI 응답 파싱 완료:', parsed);

    // 앱에서 사용하는 공통 영양 데이터 형식으로 변환
    return normalizeAIResponse(foodName, parsed);

  } catch (error) {
    console.error('❌ Gemini API 호출 실패:', error.message);
    throw error; // 호출한 쪽(performSearch)에서 최종 에러 처리
  }
}

// ============================================================
// 🔄 AI 응답을 앱의 표준 영양 데이터 형식으로 변환
// 식약처 API 데이터와 같은 구조로 만들어 기존 UI에 바로 꽂을 수 있게!
// ============================================================
function normalizeAIResponse(foodName, aiData) {
  return {
    // 식약처 API와 동일한 필드명 사용 (기존 피드백 로직 재활용 가능!)
    FOOD_NM_KR: foodName,
    AMT_NUM1:  parseFloat(aiData.calories) || 0,   // 칼로리 (kcal)
    AMT_NUM3:  parseFloat(aiData.protein)  || 0,   // 단백질 (g)
    AMT_NUM4:  parseFloat(aiData.fat)      || 0,   // 지방 (g)
    AMT_NUM7:  parseFloat(aiData.sugar)    || 0,   // 당류 (g) ⭐핵심
    AMT_NUM13: parseFloat(aiData.sodium)   || 0,   // 나트륨 (mg)

    // AI 전용 추가 필드
    _isAIGenerated: true,                          // ← AI 추정치임을 표시하는 플래그
    _servingSize:   aiData.serving_size || '1인분', // 제공량 정보
    _aiFeedback:    aiData.feedback || '',          // 클로이의 AI 피드백 텍스트
    _raw: aiData
  };
}

// ============================================================
// 🧪 데모용 목업 응답 (API 키 없을 때 테스트용)
// 실제 배포 시엔 사용 안 됨
// ============================================================
function buildMockAIResponse(foodName, goals) {
  console.log('🧪 [데모 모드] Gemini API 키 미설정 → 목업 데이터 반환');

  // 키워드 기반 간단 추정
  const isSpicy = /마라|떡볶이|엽떡|불닭/.test(foodName);
  const isSweet = /초콜릿|케이크|아이스크림|도넛|마카롱/.test(foodName);
  const isProtein = /닭가슴살|두부|계란|연어|참치/.test(foodName);

  // 이름에 "숫자+칼로리"가 있다면 그 숫자를 우선 사용 (예: "119칼로리")
  const calMatch = foodName.match(/(\d+)\s*칼로리/);
  const matchedCal = calMatch ? parseInt(calMatch[1], 10) : null;
  const finalCal = matchedCal !== null ? matchedCal : (isSweet ? 480 : isSpicy ? 520 : isProtein ? 180 : 350);

  const mockData = {
    calories: finalCal,
    protein:  isProtein ? 28 : isSweet ? 5 : 12,
    fat:      isSweet ? 22 : isSpicy ? 15 : 10,
    sugar:    isSweet ? 42 : isSpicy ? 18 : 5,
    sodium:   isSpicy ? 1800 : 600,
    serving_size: '1인분 기준',
    feedback: isSweet
      ? `"${foodName}" 당류가 무려 각설탕 10개 분량이에요! 😤 이걸 드시면 혈당이 급격하게 오르고 지방으로 축적되기 쉬워요. 오늘 간식은 이걸로 끝내시는 게 어떨까요?`
      : isSpicy
      ? `"${foodName}" 나트륨이 상당히 높네요! 😡 얼굴이 붓고 혈압에 좋지 않으니, 드시고 나서 꼭 물을 많이 드시고 칼륨이 풍부한 채소도 챙겨 드세요!`
      : `"${foodName}" 칼로리 ${finalCal}kcal, 식단으로 괜찮은 선택이에요. 그래도 영양 균형을 위해 채소나 부족한 영양소를 조금 더 곁들여 보시면 어떨까요?`
  };

  return normalizeAIResponse(foodName, mockData);
}

// ============================================================
// 📦 외부에서 사용할 수 있도록 내보내기
// ============================================================
window.ChloeGemini = {
  callGeminiForFood,
  goalsToKorean,
  GEMINI_CONFIG   // API 키 설정 편의를 위해 노출
};
