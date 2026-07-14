/**
 * ============================================================
 * feedback.js - 클로이 트레이너 피드백 생성 로직
 * ============================================================
 * 📌 역할: 유저의 활성화된 목표(토글)와 음식 영양 데이터를 바탕으로
 *         클로이 트레이너의 맞춤형 피드백 메시지와 스티커를 생성
 *
 * 🎯 8가지 조합 분기:
 *   목표 3개(간헐적단식, 슈가디톡스, 득근득근)가 각각 ON/OFF 가능
 *   → 2³ = 8가지 경우의 수
 *
 * 💬 말투 원칙: 친근하고 따뜻한 존댓말
 *   - 팩트는 팩트대로 정확하게
 *   - 단호하지만 응원하는 뉘앙스
 * ============================================================
 */

// ============================================================
// 📊 기준값 정의 (클로이의 판단 기준)
// ============================================================
const THRESHOLDS = {
  SUGAR_WARNING: 10,     // 당류 10g 초과 시 경고 (세계보건기구 1회 권장량 기준)
  SUGAR_DANGER: 25,      // 당류 25g 초과 시 위험 (하루 권장량 절반)
  PROTEIN_GOOD: 20,      // 단백질 20g 이상이면 OK
  PROTEIN_LOW: 10,       // 단백질 10g 미만이면 부족
  CALORIE_HIGH: 600,     // 1회 식사 600kcal 초과 시 높음
  SODIUM_HIGH: 1000,     // 나트륨 1000mg 초과 시 주의
  SPARTA_SUGAR: 5,       // 스파르타 모드: 당류 5g 초과도 허용 불가
  SPARTA_PROTEIN: 25     // 스파르타 모드: 단백질 25g 이상 필수
};

// ============================================================
// 🏷️ 스티커 자동 부여 함수
// 유저의 목표 달성 여부에 따라 스티커가 자동으로 붙음
// ============================================================
function generateStickers(nutrition, goals) {
  const stickers = [];
  const sugar = nutrition.AMT_NUM7;
  const protein = nutrition.AMT_NUM3;
  const calories = nutrition.AMT_NUM1;

  // 🥗 슈가 디톡스 성공 스티커
  if (goals.sugar_detox && sugar <= THRESHOLDS.SUGAR_WARNING) {
    stickers.push({ emoji: '🥗', label: '당류 방어 성공!' });
  }

  // 💪 단백질 충족 스티커
  if (goals.protein_boost && protein >= THRESHOLDS.PROTEIN_GOOD) {
    stickers.push({ emoji: '💪', label: '단백질 충전 완료!' });
  }

  // ⚠️ 당류 초과 경고 스티커
  if (goals.sugar_detox && sugar > THRESHOLDS.SUGAR_WARNING) {
    stickers.push({ emoji: '⚠️', label: '당류 초과 주의!' });
  }

  // 🔥 스파르타 모드 + 모든 기준 통과
  if (goals.sparta_mode && sugar <= THRESHOLDS.SPARTA_SUGAR && protein >= THRESHOLDS.SPARTA_PROTEIN) {
    stickers.push({ emoji: '🏆', label: '스파르타 완벽 통과!' });
  }

  // 🎯 칼로리 조절 성공
  if (calories > 0 && calories <= THRESHOLDS.CALORIE_HIGH) {
    stickers.push({ emoji: '🎯', label: '칼로리 조절 굿!' });
  }

  // 아무 스티커도 없으면 기본 스티커
  if (stickers.length === 0) {
    stickers.push({ emoji: '📝', label: '기록 완료' });
  }

  return stickers;
}

// ============================================================
// 💬 클로이 피드백 메시지 생성 함수 (핵심 로직)
//
// if-else 분기 구조 설명:
//   1. 먼저 '스파르타 모드(3개 모두 ON)' 체크
//   2. 그 다음 2개 조합 체크
//   3. 마지막으로 1개 단독 체크
//   4. 아무것도 안 켰으면 기본 메시지
// ============================================================

/**
 * 클로이의 메인 피드백 생성 함수
 * @param {Object} nutrition - 정규화된 영양 데이터 (api.js의 normalizeNutrition 결과)
 * @param {Object} goals - 유저의 목표 설정 { intermittent_fasting, sugar_detox, protein_boost, sparta_mode }
 * @returns {Object} { messages: Array, severity: 'good'|'warning'|'danger', stickers: Array }
 */
function generateFeedback(nutrition, goals) {
  const { AMT_NUM1: cal, AMT_NUM3: protein, AMT_NUM4: fat, AMT_NUM7: sugar, AMT_NUM13: sodium } = nutrition;
  const foodName = nutrition.FOOD_NM_KR;

  // 당류를 각설탕으로 변환 (더 직관적인 표현)
  const sugarCubes = Math.round(sugar / 4);

  let messages = [];
  let severity = 'neutral';

  // ══════════════════════════════════════════
  // 🔥 CASE 1: 스파르타 모드 (3가지 목표 모두 ON)
  // ══════════════════════════════════════════
  if (goals.sparta_mode) {
    const spartaMessages = [];
    let spartaSeverity = 'good';

    const currentHour = new Date().getHours();
    const isInFastingPeriod = currentHour >= 20 || currentHour < 12;

    if (isInFastingPeriod) {
      spartaMessages.push({
        type: 'danger',
        icon: '⏰',
        text: `지금은 ${currentHour}시로 단식 시간이에요. 이 시간에 식사하시면 단식 효과가 사라질 수 있답니다. 물이나 무가당 차로 버텨보시는 건 어떨까요?`
      });
      spartaSeverity = 'danger';
    }

    if (sugar > THRESHOLDS.SPARTA_SUGAR) {
      spartaMessages.push({
        type: 'danger',
        icon: '🍬',
        text: `당류가 ${sugar}g이에요${sugarCubes > 0 ? ` (각설탕 ${sugarCubes}개 분량!)` : ''}. 스파르타 기준인 5g을 초과했어요. 혈당 스파이크가 생기면 지금까지 쌓아온 것들이 흔들릴 수 있으니 신중하게 선택해 주세요!`
      });
      spartaSeverity = 'danger';
    } else {
      spartaMessages.push({
        type: 'good',
        icon: '🥗',
        text: `당류 ${sugar}g — 스파르타 기준을 완벽히 통과했어요! 클로이가 인정합니다 👏`
      });
    }

    if (protein < THRESHOLDS.SPARTA_PROTEIN) {
      spartaMessages.push({
        type: 'warning',
        icon: '🥩',
        text: `단백질이 ${protein}g이에요. 스파르타 수준이라면 한 끼에 최소 25g은 채우셔야 해요. 근육은 단백질 없이는 만들어지지 않아요!`
      });
      if (spartaSeverity !== 'danger') spartaSeverity = 'warning';
    } else {
      spartaMessages.push({
        type: 'good',
        icon: '💪',
        text: `단백질 ${protein}g — 완벽해요! 이 기세로 꾸준히 가시면 분명 좋은 결과가 있을 거예요!`
      });
    }

    if (spartaSeverity === 'good' && !isInFastingPeriod) {
      spartaMessages.push({
        type: 'good',
        icon: '🏆',
        text: `스파르타 모드의 모든 기준을 통과하셨어요! 오늘 하루도 이 기세로 쭉 달려보세요 💪`
      });
    } else if (spartaSeverity === 'danger') {
      spartaMessages.push({
        type: 'danger',
        icon: '🔥',
        text: `오늘은 조금 아쉬운 선택이었어요. 내일은 더 완벽하게 도전해 보시는 건 어떨까요? 클로이가 응원할게요!`
      });
    }

    return {
      messages: spartaMessages,
      severity: spartaSeverity,
      stickers: generateStickers(nutrition, goals),
      mode: 'sparta'
    };
  }

  // ══════════════════════════════════════════
  // 🎯 CASE 2: 슈가 디톡스 + 득근득근 (2개 조합)
  // ══════════════════════════════════════════
  if (goals.sugar_detox && goals.protein_boost && !goals.intermittent_fasting) {
    const msgs = [];
    let sev = 'neutral';

    if (protein >= THRESHOLDS.PROTEIN_GOOD) {
      msgs.push({
        type: 'good',
        icon: '💪',
        text: `단백질이 ${protein}g이나 들어있어요! 근육이 정말 좋아하겠는데요 😊`
      });
    } else {
      msgs.push({
        type: 'warning',
        icon: '🥩',
        text: `단백질이 ${protein}g으로 조금 아쉬워요. 득근득근이 목표시라면 한 끼에 최소 20g은 챙기시는 게 좋아요.`
      });
      sev = 'warning';
    }

    if (sugar > THRESHOLDS.SUGAR_DANGER) {
      msgs.push({
        type: 'danger',
        icon: '🍬',
        text: `그런데 당류가 ${sugar}g이에요 — 각설탕 ${sugarCubes}개 분량이에요! 단백질을 열심히 채워도 혈당이 폭주하면 효과가 반감될 수 있어요. 당류가 낮은 단백질 식품을 선택해 보시는 건 어떨까요?`
      });
      sev = 'danger';
    } else if (sugar > THRESHOLDS.SUGAR_WARNING) {
      msgs.push({
        type: 'warning',
        icon: '🍬',
        text: `당류가 ${sugar}g으로 각설탕 ${sugarCubes}개 분량이에요. 슈가 디톡스 목표와는 조금 멀어졌네요. 다음번엔 더 현명한 선택을 해보세요!`
      });
      if (sev !== 'danger') sev = 'warning';
    } else {
      msgs.push({
        type: 'good',
        icon: '🥗',
        text: `당류 ${sugar}g — 훌륭해요! 혈당 걱정 없이 근육까지 채우는 완벽한 선택이에요 🎉`
      });
    }

    return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'sugar_protein' };
  }

  // ══════════════════════════════════════════
  // ⏰ CASE 3: 간헐적 단식 + 슈가 디톡스 (2개 조합)
  // ══════════════════════════════════════════
  if (goals.intermittent_fasting && goals.sugar_detox && !goals.protein_boost) {
    const msgs = [];
    let sev = 'neutral';
    const currentHour = new Date().getHours();

    if (currentHour >= 20 || currentHour < 12) {
      msgs.push({
        type: 'danger',
        icon: '⏰',
        text: `잠깐요! 지금은 ${currentHour}시로 단식 창 안이에요. 이 시간에 드시면 단식의 효과가 사라질 수 있어요. 조금만 더 버텨보세요!`
      });
      sev = 'danger';
    } else {
      msgs.push({
        type: 'good',
        icon: '⏰',
        text: `식사 허용 시간이에요! 오전 12시~오후 8시 사이에 잘 지키고 계시네요 👍`
      });
    }

    if (sugar > THRESHOLDS.SUGAR_WARNING) {
      msgs.push({
        type: 'danger',
        icon: '🍬',
        text: `그런데 당류가 ${sugar}g, 각설탕 ${sugarCubes}개 분량이에요. 단식 직후에 혈당이 급격히 올라가면 인슐린이 과하게 분비되어 단식 효과가 크게 줄어들 수 있어요.`
      });
      sev = 'danger';
    } else {
      msgs.push({
        type: 'good',
        icon: '🥗',
        text: `당류 ${sugar}g — 깔끔한 선택이에요! 단식 효과를 최대로 살릴 수 있는 이상적인 식단이에요 ✨`
      });
    }

    return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'fasting_sugar' };
  }

  // ══════════════════════════════════════════
  // 🥩 CASE 4: 간헐적 단식 + 득근득근 (2개 조합)
  // ══════════════════════════════════════════
  if (goals.intermittent_fasting && goals.protein_boost && !goals.sugar_detox) {
    const msgs = [];
    let sev = 'neutral';
    const currentHour = new Date().getHours();

    if (currentHour >= 20 || currentHour < 12) {
      msgs.push({
        type: 'danger',
        icon: '⏰',
        text: `지금은 단식 시간이에요. 근육을 키우고 싶은 마음은 충분히 이해하지만, 식사 창 시간을 지키는 것이 더 효과적이에요!`
      });
      sev = 'danger';
    }

    if (protein >= THRESHOLDS.PROTEIN_GOOD) {
      msgs.push({
        type: 'good',
        icon: '💪',
        text: `단백질 ${protein}g — 제한된 식사 창 안에서 단백질을 잘 챙기셨어요! 단식과 근육 만들기, 두 마리 토끼를 잡고 계시네요 👏`
      });
    } else {
      msgs.push({
        type: 'warning',
        icon: '🥩',
        text: `단백질이 ${protein}g이에요. 식사 시간이 짧을수록 먹을 때 단백질을 최대한 챙겨주셔야 해요. 닭가슴살이나 계란을 추가해 보세요!`
      });
      if (sev !== 'danger') sev = 'warning';
    }

    return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'fasting_protein' };
  }

  // ══════════════════════════════════════════
  // 🕐 CASE 5: 간헐적 단식만 ON
  // ══════════════════════════════════════════
  if (goals.intermittent_fasting && !goals.sugar_detox && !goals.protein_boost) {
    const msgs = [];
    let sev = 'neutral';
    const currentHour = new Date().getHours();

    if (currentHour >= 20 || currentHour < 12) {
      msgs.push({
        type: 'danger',
        icon: '⏰',
        text: `지금은 ${currentHour}시로 단식 시간이에요! 단식 시간은 저녁 8시~낮 12시까지예요. 이 시간에는 물이나 무가당 음료로 대신해 주세요 💧`
      });
      sev = 'danger';
    } else {
      msgs.push({
        type: 'good',
        icon: '✅',
        text: `식사 허용 시간이에요! 칼로리 ${cal}kcal로 기록해 두시고, 오후 8시 이후에는 드시지 않도록 주의해 주세요.`
      });
    }

    return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'fasting_only' };
  }

  // ══════════════════════════════════════════
  // 🍬 CASE 6: 슈가 디톡스만 ON
  // ══════════════════════════════════════════
  if (!goals.intermittent_fasting && goals.sugar_detox && !goals.protein_boost) {
    const msgs = [];
    let sev = 'neutral';

    if (sugar > THRESHOLDS.SUGAR_DANGER) {
      msgs.push({
        type: 'danger',
        icon: '🚨',
        text: `당류가 무려 ${sugar}g이에요 — 각설탕 ${sugarCubes}개 분량이에요! 슈가 디톡스 중에 이 정도면 혈당이 크게 흔들릴 수 있어요. 한 번만 다시 생각해 보시는 건 어떨까요?`
      });
      sev = 'danger';
    } else if (sugar > THRESHOLDS.SUGAR_WARNING) {
      msgs.push({
        type: 'warning',
        icon: '⚠️',
        text: `당류 ${sugar}g으로 각설탕 ${sugarCubes}개 분량이에요. 슈가 디톡스 기준인 10g을 살짝 넘었네요. 다음번엔 조금 더 신경 써주세요!`
      });
      sev = 'warning';
    } else {
      msgs.push({
        type: 'good',
        icon: '🎉',
        text: `당류 ${sugar}g — 정말 훌륭한 선택이에요! 혈당 스파이크 없이 지방 연소를 최적화하는 완벽한 식단이에요 🌟`
      });
      sev = 'good';
    }

    if (cal > THRESHOLDS.CALORIE_HIGH) {
      msgs.push({
        type: 'warning',
        icon: '🔥',
        text: `칼로리는 ${cal}kcal로 조금 높은 편이에요. 당류는 잘 잡으셨으니, 전체 열량도 함께 신경 써주시면 더 좋을 것 같아요!`
      });
    }

    return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'sugar_only' };
  }

  // ══════════════════════════════════════════
  // 💪 CASE 7: 득근득근만 ON
  // ══════════════════════════════════════════
  if (!goals.intermittent_fasting && !goals.sugar_detox && goals.protein_boost) {
    const msgs = [];
    let sev = 'neutral';

    if (protein >= THRESHOLDS.PROTEIN_GOOD) {
      msgs.push({
        type: 'good',
        icon: '💪',
        text: `단백질 ${protein}g이에요! 근육이 정말 기뻐하겠는데요 😊 클로이도 엄지 척 드릴게요!`
      });
      sev = 'good';
    } else if (protein >= THRESHOLDS.PROTEIN_LOW) {
      msgs.push({
        type: 'warning',
        icon: '🥩',
        text: `단백질 ${protein}g으로 중간 정도예요. 득근득근이 목표시라면 최소 20g은 드셔야 제대로 된 효과를 볼 수 있어요. 닭가슴살이나 계란을 하나 더 추가해 보시는 건 어떨까요?`
      });
      sev = 'warning';
    } else {
      msgs.push({
        type: 'danger',
        icon: '😮',
        text: `단백질이 ${protein}g이에요. 아쉽게도 이 정도로는 근육 성장에 필요한 양이 많이 부족해요. 오늘 저녁엔 꼭 단백질이 풍부한 음식을 선택해 주세요!`
      });
      sev = 'danger';
    }

    if (fat > 20) {
      msgs.push({
        type: 'warning',
        icon: '🧈',
        text: `지방이 ${fat}g으로 조금 높은 편이에요. 단백질은 잘 챙기셨으니 지방 비율도 함께 확인해 주세요!`
      });
    }

    return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'protein_only' };
  }

  // ══════════════════════════════════════════
  // 😴 CASE 8: 아무 목표도 없음 (기본 분석)
  // ══════════════════════════════════════════
  const msgs = [];
  let sev = 'neutral';

  msgs.push({
    type: 'neutral',
    icon: 'ℹ️',
    text: `"${foodName}" 영양 분석 결과예요! 칼로리 ${cal}kcal, 단백질 ${protein}g, 당류 ${sugar}g이에요.`
  });

  if (sugar > THRESHOLDS.SUGAR_WARNING) {
    msgs.push({
      type: 'warning',
      icon: '💡',
      text: `혈당 스파이크에 주의하세요! 당류가 ${sugar}g이에요. 건강 관리에 관심 있으시다면 홈 탭에서 '슈가 디톡스' 목표를 켜보시는 건 어떨까요?`
    });
    sev = 'warning';
  }

  msgs.push({
    type: 'neutral',
    icon: '🎯',
    text: `더 맞춤형 조언을 받고 싶으시다면 홈 탭에서 다이어트 목표를 설정해 보세요!`
  });

  return { messages: msgs, severity: sev, stickers: generateStickers(nutrition, goals), mode: 'no_goal' };
}

// ============================================================
// 🎨 피드백 심각도에 따른 CSS 클래스 반환
// ============================================================
function getSeverityClass(severity) {
  const classMap = {
    'good': 'feedback-good',
    'warning': 'feedback-warning',
    'danger': 'feedback-danger',
    'neutral': 'feedback-neutral'
  };
  return classMap[severity] || 'feedback-neutral';
}

/**
 * 피드백 심각도에 따른 클로이 표정 이모지
 */
function getChloeMood(severity) {
  const moodMap = {
    'good': '😊',
    'warning': '🤔',
    'danger': '😮',
    'neutral': '💁‍♀️'
  };
  return moodMap[severity] || '💁‍♀️';
}

// 외부에서 사용할 수 있도록 내보내기
window.ChloeFeedback = {
  generateFeedback,
  generateStickers,
  getSeverityClass,
  getChloeMood,
  THRESHOLDS
};
