/**
 * ============================================================
 * app.js - 클로이 앱 메인 로직
 * ============================================================
 * 📌 역할: 모든 탭의 UI 이벤트 처리, 화면 전환, 데이터 연결
 * 
 * 이 파일은 data.js, api.js, feedback.js를 모두 조합해서
 * 실제 화면에 보여주는 '총괄 감독' 역할을 합니다.
 * ============================================================
 */

// ============================================================
// 🌐 전역 상태 (앱 전체에서 공유하는 데이터)
// ============================================================
let appState = {
  currentTab: 'home',           // 현재 활성화된 탭
  selectedFood: null,           // 검색에서 선택된 음식
  searchResults: [],            // 검색 결과 목록
  currentDate: new Date(),      // 캘린더 현재 날짜
  selectedCalDate: getTodayStr(), // 선택된 날짜
  diaryViewMode: 'list',        // 'list' | 'grid' - 먹기록 보기 모드
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  currentBase64Image: null,     // 첨부된 사진 (Base64)
  chatHistory: [],              // 클로이와의 대화 내역
  basket: []                    // 🛒 식단 바스켓 (여러 음식 담기)
};

// 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환
function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

// ============================================================
// ✅ 앱 초기화 (페이지가 로드되면 가장 먼저 실행)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🏋️ 클로이 트레이너 앱 시작!');
  
  initGoalToggles();   // 목표 토글 초기화
  initSearchTab();     // 검색 탭 초기화
  initDiaryTab();      // 먹기록 탭 초기화
  initStatsTab();      // 통계 탭 초기화
  initNavigation();    // 하단 네비게이션 초기화
  initChloeChat();     // 💬 후속 대화 (Chat) 이벤트 초기화
  
  // 로그인 및 즐겨찾기 연동
  initAuth();
  renderFavorites();
  attachFavoriteButton();

  
  renderHomeTab();     // 홈 탭 화면 그리기
});

// ============================================================
// 💬 후속 대화 (Chat) 초기화
// ============================================================
function initChloeChat() {
  const chatInput = document.getElementById('chloe-chat-input');
  const chatSendBtn = document.getElementById('chloe-chat-send-btn');
  const chatMessagesEl = document.getElementById('chloe-chat-messages');

  if (!chatInput || !chatSendBtn || !chatMessagesEl) return;

  const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text || !appState.selectedFood) return;

    // 1. 유저 메시지 렌더링
    chatMessagesEl.insertAdjacentHTML('beforeend', `<div class="chat-bubble user">${text}</div>`);
    chatInput.value = '';
    chatSendBtn.disabled = true;
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // 2. 로딩 애니메이션 렌더링
    const loadingId = 'loading-' + Date.now();
    chatMessagesEl.insertAdjacentHTML('beforeend', `
      <div id="${loadingId}" class="chat-bubble chloe loading">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
    `);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // 3. API 호출
    const profile = ChloeData.getUserProfile();
    const responseText = await ChloeGemini.askChloeChat(
      appState.selectedFood,
      profile.goals,
      appState.chatHistory,
      text
    );

    // 4. 대화 기록 저장
    appState.chatHistory.push({ role: 'user', text });
    appState.chatHistory.push({ role: 'model', text: responseText });

    // 5. 로딩 지우고 답변 렌더링
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    chatMessagesEl.insertAdjacentHTML('beforeend', `<div class="chat-bubble chloe">${responseText}</div>`);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    chatSendBtn.disabled = false;
    chatInput.focus();
  };

  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

// ============================================================
// 📱 탭 네비게이션 초기화
// ============================================================

// ============================================================
// 🔐 로그인 및 즐겨찾기 로직 추가
// ============================================================
async function initAuth() {
  const modal = document.getElementById('login-modal');
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');
  const btnLogin = document.getElementById('btn-login');
  const btnSignup = document.getElementById('btn-signup');
  if(!modal) return;

  const { session } = await ChloeDB.getSession();
  if (session) {
    modal.style.display = 'none';
    const success = await ChloeData.syncFromSupabase(session.user.id);
    if(success) {
      renderHomeTab();
      renderFavorites();
    }
  } else {
    modal.style.display = 'flex';
  }

  btnLogin.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pwd = pwdInput.value.trim();
    if(!email || !pwd) return alert('이메일과 비밀번호를 입력해주세요.');
    const { data, error } = await ChloeDB.login(email, pwd);
    if(error) return alert('로그인 실패: ' + error.message);
    
    await ChloeData.syncFromSupabase(data.user.id);
    modal.style.display = 'none';
    location.reload();
  });

  btnSignup.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pwd = pwdInput.value.trim();
    if(!email || pwd.length < 6) return alert('이메일과 6자리 이상 비밀번호를 입력해주세요.');
    const { data, error } = await ChloeDB.signUp(email, pwd);
    if(error) return alert('가입 실패: ' + error.message);
    alert('가입 성공! 이제 로그인 버튼을 눌러주세요.');
  });
}

function renderFavorites() {
  const favList = document.getElementById('favorites-list');
  if(!favList) return;
  const favs = ChloeData.getFavorites();
  favList.innerHTML = favs.length ? '' : '<span style="font-size:12px;color:var(--gray-500)">아직 즐겨찾기가 없습니다.</span>';
  
  favs.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.innerHTML = '⭐ ' + f.FOOD_NM_KR;
    btn.onclick = () => {
      appState.selectedFood = f;
      renderFeedbackPanel(f, {severity:0, messages:['⭐ 즐겨찾기에서 1초 만에 불러왔습니다!']});
    };
    favList.appendChild(btn);
  });
}

function attachFavoriteButton() {
  const btn = document.getElementById('btn-add-favorite');
  if(btn) {
    btn.onclick = () => {
      if(!appState.selectedFood) return;
      const res = ChloeData.saveFavorite(appState.selectedFood);
      if(res.success) {
        alert('⭐ 즐겨찾기에 추가되었습니다!');
        renderFavorites();
      } else {
        alert(res.error || '추가 실패');
      }
    };
  }
}

function initNavigation() {
  // 하단 네비게이션 버튼들을 모두 찾아서
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      // 클릭된 탭 이름 가져오기 (data-tab 속성)
      const targetTab = this.dataset.tab;
      switchTab(targetTab);
    });
  });
}

/**
 * 탭 전환 함수
 * @param {string} tabName - 'home' | 'search' | 'diary' | 'stats'
 */
function switchTab(tabName) {
  appState.currentTab = tabName;
  
  // 모든 탭 비활성화
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // 선택한 탭 활성화
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  // 탭별 데이터 새로고침
  if (tabName === 'home') renderHomeTab();
  if (tabName === 'diary') renderDiaryTab();
  if (tabName === 'stats') renderStatsTab();
}

// ============================================================
// 🏠 홈 탭 렌더링
// ============================================================
function renderHomeTab() {
  const profile = ChloeData.getUserProfile();
  renderDailySummary(profile);
  updateSparta(profile);
}

/**
 * 오늘의 영양 요약 카드 업데이트
 */
function renderDailySummary(profile) {
  const todayStr = getTodayStr();
  const todayDiary = ChloeData.getDiaryByDate(todayStr);
  const totals = todayDiary?.daily_totals || { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 };
  
  const targets = profile.nutrition_targets || { calories: 1750, protein: 100, fat: 70, sugar: 25 };
  
  // 무조건 당류 25g 이상이면 경고 (고객님 요청)
  const sugarDanger = totals.sugar >= 25;
  
  // 목표치 대비 HTML 생성 함수
  const renderValue = (current, target) => {
    return `${current || 0} <span style="font-size:14px; color:var(--gray-400); font-weight:500;">/ ${target}</span>`;
  };
  
  // setEl 대신 innerHTML 사용
  const elCalories = document.getElementById('today-calories');
  const elProtein = document.getElementById('today-protein');
  const elFat = document.getElementById('today-fat');
  const elSugar = document.getElementById('today-sugar');
  
  if (elCalories) elCalories.innerHTML = renderValue(totals.calories, targets.calories);
  if (elProtein) elProtein.innerHTML = renderValue(totals.protein, targets.protein);
  if (elFat) elFat.innerHTML = renderValue(totals.fat, targets.fat);
  if (elSugar) elSugar.innerHTML = renderValue(totals.sugar, targets.sugar);
  
  // 당류 초과면 빨간색 강조
  const sugarEl = document.getElementById('summary-sugar-item');
  if (sugarEl) {
    sugarEl.classList.toggle('danger-value', sugarDanger);
  }
}

// ============================================================
// 🎛️ 목표 토글 초기화 및 이벤트
// ============================================================
function initGoalToggles() {
  const profile = ChloeData.getUserProfile();
  
  // 저장된 값으로 토글 초기 상태 설정
  setToggle('toggle-fasting', profile.goals.intermittent_fasting);
  setToggle('toggle-sugar', profile.goals.sugar_detox);
  setToggle('toggle-protein', profile.goals.protein_boost);
  
  // 각 토글에 이벤트 리스너 연결
  addToggleListener('toggle-fasting', 'intermittent_fasting');
  addToggleListener('toggle-sugar', 'sugar_detox');
  addToggleListener('toggle-protein', 'protein_boost');
  
  // 스파르타 상태 업데이트
  updateSparta(profile);
}

/**
 * 토글 상태 시각적으로 설정
 */
function setToggle(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = value;
}

/**
 * 토글 이벤트 리스너 추가
 */
function addToggleListener(id, goalKey) {
  const el = document.getElementById(id);
  if (!el) return;
  
  el.addEventListener('change', function() {
    // 로컬스토리지 업데이트
    ChloeData.updateGoal(goalKey, this.checked);
    
    // 스파르타 모드 체크
    const profile = ChloeData.getUserProfile();
    updateSparta(profile);
    
    // 홈 탭 요약 갱신
    renderDailySummary(profile);
    
    // 토스트 메시지 표시
    if (this.checked) {
      const names = {
        'intermittent_fasting': '⏰ 간헐적 단식',
        'sugar_detox': '🍬 슈가 디톡스',
        'protein_boost': '💪 득근득근'
      };
      showToast(`${names[goalKey]} 모드 ON!`, 'success');
    }
  });
}

/**
 * 스파르타 모드 UI 업데이트
 */
function updateSparta(profile) {
  const isSparta = profile.sparta_mode ||
    (profile.goals.intermittent_fasting && profile.goals.sugar_detox && profile.goals.protein_boost);
  
  // 스파르타 알림 배너 표시/숨김
  const spartaAlert = document.getElementById('sparta-alert');
  if (spartaAlert) spartaAlert.classList.toggle('visible', isSparta);
  
  // 헤더의 스파르타 배지 표시/숨김
  const spartaBadge = document.getElementById('sparta-badge');
  if (spartaBadge) spartaBadge.style.display = isSparta ? 'inline-flex' : 'none';
}

// ============================================================
// 🔍 검색 탭 초기화
// ============================================================
function initSearchTab() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  
  if (!searchInput) return;
  
  // 최근 검색어 불러오기
  renderRecentSearches();

  // 📷 사진 첨부 이벤트 처리
  const imageUpload = document.getElementById('image-upload');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const imagePreviewImg = document.getElementById('image-preview-img');
  const imageRemoveBtn = document.getElementById('image-remove-btn');
  
  if (imageUpload) {
    imageUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          appState.currentBase64Image = event.target.result;
          if (imagePreviewImg) imagePreviewImg.src = appState.currentBase64Image;
          if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
          
          // 사진이 첨부되었으므로 검색 버튼을 누르도록 유도 (자동 검색 삭제)
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  if (imageRemoveBtn) {
    imageRemoveBtn.addEventListener('click', function() {
      appState.currentBase64Image = null;
      if (imageUpload) imageUpload.value = '';
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      searchInput.focus();
    });
  }

  // 📋 클립보드 이미지 붙여넣기(Ctrl+V) 지원
  document.addEventListener('paste', function(e) {
    // 탭이 'search'일 때만 동작하도록 제한 (선택 사항이지만 안전함)
    if (document.getElementById('search-tab').style.display === 'none') return;

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function(event) {
          appState.currentBase64Image = event.target.result;
          if (imagePreviewImg) imagePreviewImg.src = appState.currentBase64Image;
          if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
          showToast('✅ 이미지가 클립보드에서 첨부되었습니다.', 'success');
        };
        reader.readAsDataURL(file);
        break; // 첫 번째 이미지만 처리
      }
    }
  });

  // ───────────────────────────────────────────────────────
  // ⌕ 타이핑 자동완성 (isExplicit = false)
  // 　문자 입력 시마다 500ms 디바운스로 API 호출
  // 　⚠️ 이 경로는 검색어 저장 안 함! (히스토리 중복 저장 방지)
  // ───────────────────────────────────────────────────────
  let debounceTimer;
  searchInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    const query = this.value.trim();

    if (query.length < 2) {
      hideAutocomplete();
      return;
    }

    // ⚡ 즉시: 캐시 + 즐겨찾기에서 먼저 검색 (API 호출 없이 순간 표시)
    const cached = ChloeAPI.searchCache ? ChloeAPI.searchCache(query) : [];
    const favs = ChloeData.getFavorites ? ChloeData.getFavorites() : [];
    const favMatched = favs.filter(f => f.FOOD_NM_KR && f.FOOD_NM_KR.includes(query));
    const instant = [...favMatched.map(f => ({ ...f, _fromFav: true })), ...cached];
    const unique = instant.filter((item, idx, arr) =>
      arr.findIndex(a => a.FOOD_NM_KR === item.FOOD_NM_KR) === idx
    ).slice(0, 5);

    if (unique.length > 0) {
      renderAutocomplete(unique); // 즉시 보여주기
    } else {
      hideAutocomplete(); // 캐시에 없으면 아무것도 안 보여줌
    }

    // 사용자의 요청에 따라 타이핑 시 자동 API 검색 제거
    // (엔터키 또는 검색 버튼 클릭 시에만 검색됨)
  });

  // ───────────────────────────────────────────────────────
  // ⏎ 명시적 검색 (isExplicit = true)
  // 　엔터키 또는 검색 버튼 클릭 시에만 히스토리에 저장—이게 점리!
  // ───────────────────────────────────────────────────────
  searchBtn?.addEventListener('click', () => {
    const query = searchInput.value.trim();
    const hasImage = !!appState.currentBase64Image;
    if (!query && !hasImage) return;
    
    clearTimeout(debounceTimer); // 디바운스 취소 (중복 호출 방지)
    performSearch(query, true);  // 명시적 검색 → 히스토리 저장 O
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      const hasImage = !!appState.currentBase64Image;
      if (!query && !hasImage) return;
      
      clearTimeout(debounceTimer); // 디바운스 취소
      performSearch(query, true);  // 명시적 검색 → 히스토리 저장 O
    }
  });

  // 검색창 바깥 클릭 시 자동완성 닫기
  document.addEventListener('click', function(e) {
    if (!document.getElementById('search-wrapper')?.contains(e.target)) {
      hideAutocomplete();
    }
  });
}

/**
 * 식약처 API 검색 실행 + Gemini AI 폴백 분기
 *
 * @param {string}  query      - 검색어
 * @param {boolean} isExplicit - true: 엔터/버튼 오의 명시적 검색 (히스토리 저장 O)
 *                               false: 타이핑 디바운스 자동 검색 (히스토리 저장 X)
 *
 * ⚠️ 버그 수정 이력 (2026-07-14):
 *   기존: isExplicit 구분 없이 디바운스 발동 시에도 AI 폴백이 히스토리 저장 → 중간 타이핑값 누적
 *   수정: isExplicit=true일 때만 히스토리 저장
 */
async function performSearch(query, isExplicit = false) {
  const hasImage = !!appState.currentBase64Image;

  if (!query && !hasImage) return;

  // ── 1단계: 식약처 공공 API 호출 ──────────────────────────
  showLoading(true, hasImage ? '📷 사진의 영양 성분을 분석 중입니다...' : '공공 데이터베이스 검색 중...');
  hideAutocomplete();

  let publicResults = [];
  
  // 이미지가 첨부되었다면 공공 DB는 무시하고 무조건 AI 분석으로 직행
  if (!hasImage) {
    try {
      const rawResults = await ChloeAPI.searchFood(query);
      publicResults = rawResults.map(ChloeAPI.normalizeNutrition);
    } catch (e) {
      console.warn('공공 API 오류, AI 폴백으로 전환:', e.message);
    }

    // ── 2단계: 공공 API 결과가 있으면 자동완성 표시 후 종료 ──
    if (publicResults.length > 0) {
      renderAutocomplete(publicResults);
      showLoading(false);
      return;
    }
  }

  // ── 3단계: 결과 없음 (또는 사진 첨부) → AI 폴백
  // isExplicit = false(타이핑 중):
  // 이미지가 있든 없든, 타이핑 중(isExplicit=false)이면 AI 호출을 막습니다. (쿼터 초과 방지)
  if (!isExplicit) {
    showLoading(false);
    return;
  }

  // ── 4단계: 명시적 검색일 때만 AI 폴백 실행 ──────────────────
  showLoading(true, '✨ 클로이가 ' + (hasImage ? '사진을 읽고 ' : '') + '영양 데이터를 추정 중입니다...');

  try {
    const profile = ChloeData.getUserProfile();
    const aiNutrition = await ChloeGemini.callGeminiForFood(query || "이 사진 속 음식", profile.goals, appState.currentBase64Image);

    // ✅ 명시적 검색일 때만 히스토리 저장!
    if (query) {
      ChloeData.saveSearchHistory(query);
      renderRecentSearches();
      document.getElementById('search-input').value = query;
    }

    // 사진이 있었다면 분석 후 폼 초기화
    if (hasImage) {
      appState.currentBase64Image = null;
      const imageUpload = document.getElementById('image-upload');
      const imagePreviewContainer = document.getElementById('image-preview-container');
      if (imageUpload) imageUpload.value = '';
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      if (!query) document.getElementById('search-input').value = '';
    }

    selectFoodFromAI(aiNutrition);

  } catch (aiError) {
    console.error('❌ AI 폴백도 실패:', aiError.message);
    showToast(`클로이가 이 음식을 모르겠어요 😅 (이유: ${aiError.message})`, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * 자동완성 리스트 렌더링
 */
function renderAutocomplete(items) {
  const list = document.getElementById('autocomplete-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    const icon = item._fromFav ? '⭐' : '🍽️';
    el.innerHTML = `
      <span style="font-size:18px">${icon}</span>
      <span class="food-name">${item.FOOD_NM_KR}</span>
      <span class="food-cal">${item.AMT_NUM1}kcal</span>
      <button class="basket-add-btn" style="margin-left:auto; padding:2px 8px; font-size:11px; border-radius:4px; border:1px solid var(--primary-color); color:var(--primary-color); background:transparent; cursor:pointer;" onclick="event.stopPropagation(); addToBasket(${JSON.stringify(item).replace(/"/g, '&quot;')})">+담기</button>
    `;
    
    // 음식 선택 시 피드백 표시
    el.addEventListener('click', () => {
      selectFood(item);
      document.getElementById('search-input').value = item.FOOD_NM_KR;
      hideAutocomplete();
      ChloeData.saveSearchHistory(item.FOOD_NM_KR);
      renderRecentSearches();
    });
    
    list.appendChild(el);
  });
  
  list.classList.add('visible');
}

/**
 * 공공 API 결과 선택 → 기존 피드백 패널 표시
 */
function selectFood(nutrition) {
  appState.selectedFood = nutrition;
  const profile = ChloeData.getUserProfile();
  const feedback = ChloeFeedback.generateFeedback(nutrition, profile.goals);

  // AI 뱃지 숨기기 (공공 데이터는 AI 아니므로)
  toggleAIBadge(false);

  renderFeedbackPanel(nutrition, feedback);

  // 피드백 패널로 스크롤
  setTimeout(() => {
    document.getElementById('feedback-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/**
 * AI 폴백 결과 선택 → AI 전용 피드백 패널 표시
 * 공공 API와 동일한 UI 구조를 쓰되, AI 뱃지 + AI 피드백 텍스트 추가
 */
function selectFoodFromAI(aiNutrition) {
  appState.selectedFood = aiNutrition;
  const profile = ChloeData.getUserProfile();

  // ✨ AI 전용: 기존 피드백 로직 대신 AI가 만든 피드백 텍스트 사용
  // 단, 스티커 자동 부여는 기존 로직 그대로 활용
  const feedback = ChloeFeedback.generateFeedback(aiNutrition, profile.goals);

  // AI 뱃지 보이기
  toggleAIBadge(true);

  // 공통 패널 렌더링
  renderFeedbackPanel(aiNutrition, feedback);

  // AI 피드백 텍스트로 덮어쓰기 (클로이가 직접 쓴 멘트)
  if (aiNutrition._aiFeedback) {
    const msgsEl = document.getElementById('feedback-messages');
    if (msgsEl) {
      // 당류 수준에 따라 심각도 색상 결정
      const sugar = aiNutrition.AMT_NUM7;
      const severityClass = sugar > 25 ? 'feedback-danger'
                          : sugar > 10 ? 'feedback-warning'
                          : 'feedback-good';
      const msgType = sugar > 25 ? 'danger' : sugar > 10 ? 'warning' : 'good';

      msgsEl.className = `feedback-box ${severityClass}`;
      msgsEl.innerHTML = `
        <div class="feedback-msg msg-${msgType}">
          <span class="msg-icon">🤖</span>
          <span>${aiNutrition._aiFeedback}</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--gray-400);text-align:right">
          📐 제공량: ${aiNutrition._servingSize}
        </div>
      `;
    }
  }

  // 피드백 패널로 스크롤
  setTimeout(() => {
    document.getElementById('feedback-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/**
 * AI 뱃지 표시/숨김 토글
 * @param {boolean} show - true면 보이기, false면 숨기기
 */
function toggleAIBadge(show) {
  const badge = document.getElementById('ai-analysis-badge');
  if (badge) badge.style.display = show ? 'flex' : 'none';
  // 영양 데이터 안내 문구도 AI 추정치임을 알림
  const disclaimer = document.getElementById('ai-disclaimer');
  if (disclaimer) disclaimer.style.display = show ? 'block' : 'none';
}

/**
 * 피드백 패널 렌더링 (영양 정보 + 클로이 코멘트)
 * 공공 API와 AI 폴백 모두 이 함수를 통해 렌더링됨
 */
function renderFeedbackPanel(nutrition, feedback) {
  const panel = document.getElementById('feedback-panel');
  if (!panel) return;

  const sugarCubes = Math.round(nutrition.AMT_NUM7 / 4);
  const mood = ChloeFeedback.getChloeMood(feedback.severity);

  // 영양 정보 업데이트
  setEl('nut-calories', nutrition.AMT_NUM1);
  setEl('nut-protein', nutrition.AMT_NUM3);
  setEl('nut-fat', nutrition.AMT_NUM4);
  setEl('nut-sugar', nutrition.AMT_NUM7);
  setEl('nut-sodium', nutrition.AMT_NUM13);
  setEl('food-title', nutrition.FOOD_NM_KR);
  setEl('sugar-cubes-text', sugarCubes > 0 ? `각설탕 ${sugarCubes}개 분량` : '당류 없음');

  // 클로이 기분 이모지 업데이트
  setEl('chloe-mood-emoji', mood);

  // 스티커 렌더링 (AI 폴백도 자동 스티커 부여)
  const stickersEl = document.getElementById('feedback-stickers');
  if (stickersEl) {
    stickersEl.innerHTML = feedback.stickers.map(s =>
      `<span class="sticker-badge">${s.emoji} ${s.label}</span>`
    ).join('');
  }

  // 피드백 메시지들 렌더링 (AI 폴백에서는 selectFoodFromAI가 덮어씀)
  const msgsEl = document.getElementById('feedback-messages');
  if (msgsEl) {
    msgsEl.innerHTML = feedback.messages.map(msg =>
      `<div class="feedback-msg msg-${msg.type}">
        <span class="msg-icon">${msg.icon}</span>
        <span>${msg.text}</span>
      </div>`
    ).join('');
    msgsEl.className = `feedback-box ${ChloeFeedback.getSeverityClass(feedback.severity)}`;
  }

  // 💬 채팅 내역 초기화 및 첫 메시지 세팅
  appState.chatHistory = [];
  const chatMessagesEl = document.getElementById('chloe-chat-messages');
  if (chatMessagesEl) {
    chatMessagesEl.innerHTML = `
      <div class="chat-bubble chloe">
        무엇이든 물어보세요! 영양소나 대체 음식에 대해 친절하게 알려드릴게요. 💁‍♀️
      </div>
    `;
  }
  const chatInput = document.getElementById('chloe-chat-input');
  if (chatInput) chatInput.value = '';

  // 패널 보이기
  panel.classList.add('visible');
}

/**
 * 최근 검색어 태그 렌더링
 */
function renderRecentSearches() {
  const history = ChloeData.getSearchHistory();
  const container = document.getElementById('recent-searches');
  if (!container) return;
  
  if (history.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  const tagsEl = container.querySelector('.tags-row');
  if (tagsEl) {
    tagsEl.innerHTML = history.map(keyword =>
      `<div style="display:inline-flex; align-items:center; position:relative; margin-right:8px; margin-bottom:8px;">
         <button class="tag-btn" onclick="quickSearch('${keyword}')" style="padding-right:24px;">🔍 ${keyword}</button>
         <button onclick="deleteRecentSearch('${keyword}', event)" style="position:absolute; right:6px; background:none; border:none; font-size:12px; color:var(--coral); cursor:pointer; padding:2px; display:flex; align-items:center; justify-content:center;">✕</button>
       </div>`
    ).join('');
  }
}

/**
 * 최근 검색어 개별 삭제 핸들러 (전역)
 */
window.deleteRecentSearch = function(keyword, event) {
  event.stopPropagation();
  ChloeData.deleteSearchHistory(keyword);
  renderRecentSearches();
};

/**
 * 빠른 검색 (최근 검색어 태그 클릭 시)
 */
function quickSearch(keyword) {
  document.getElementById('search-input').value = keyword;
  performSearch(keyword, true); // 태그 클릭은 명시적 검색
}

/**
 * 기록하기 버튼 클릭 처리
 */
function saveCurrentMeal() {
  if (!appState.selectedFood) return;
  
  const profile = ChloeData.getUserProfile();
  const feedback = ChloeFeedback.generateFeedback(appState.selectedFood, profile.goals);
  
  // 사진 데이터 가져오기
  const photoInput = document.getElementById('photo-input');
  const photoPreview = document.getElementById('photo-preview');
  const memoInput = document.getElementById('meal-memo');
  const mealTypeSelect = document.getElementById('meal-type-select'); // 식사 종류 추가
  const quantityInput = document.getElementById('meal-quantity'); // ⚖️ 수량(배수)
  
  // 수량 계산
  const qty = quantityInput ? parseFloat(quantityInput.value) || 1 : 1;
  const scaledFood = { ...appState.selectedFood };
  
  if (qty !== 1) {
    scaledFood.AMT_NUM1 = Math.round(scaledFood.AMT_NUM1 * qty * 10) / 10;
    scaledFood.AMT_NUM3 = Math.round(scaledFood.AMT_NUM3 * qty * 10) / 10;
    scaledFood.AMT_NUM4 = Math.round(scaledFood.AMT_NUM4 * qty * 10) / 10;
    scaledFood.AMT_NUM7 = Math.round(scaledFood.AMT_NUM7 * qty * 10) / 10;
    scaledFood.AMT_NUM13 = Math.round(scaledFood.AMT_NUM13 * qty * 10) / 10;
    scaledFood.FOOD_NM_KR = `${scaledFood.FOOD_NM_KR} (x${qty})`;
  }
  
  const mealData = {
    ...scaledFood,
    meal_type: mealTypeSelect ? mealTypeSelect.value : '식사',
    photo_base64: (photoPreview?.src && photoPreview.src !== window.location.href) 
      ? photoPreview.src 
      : null,
    note: memoInput?.value || ''
  };
  
  const result = ChloeData.addMealEntry(
    getTodayStr(),
    mealData,
    feedback.stickers
  );
  
  if (result.success) {
    showToast('🎉 먹기록 저장 완료!', 'success');
    
    // 입력 초기화
    appState.selectedFood = null;
    document.getElementById('search-input').value = '';
    document.getElementById('feedback-panel')?.classList.remove('visible');
    if (memoInput) memoInput.value = '';
    if (photoPreview) {
      photoPreview.src = '';
      photoPreview.style.display = 'none';
    }
    const placeholder = document.querySelector('.photo-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    
    // 통계 탭 갱신
    renderHomeTab();
  } else {
    showToast('저장에 실패했어요. 다시 시도해주세요.', 'error');
  }
}

// ============================================================
// 📖 먹기록 탭 초기화 및 렌더링
// ============================================================
function initDiaryTab() {
  // 보기 모드 토글 버튼
  document.getElementById('view-list-btn')?.addEventListener('click', () => {
    appState.diaryViewMode = 'list';
    updateDiaryViewBtns();
    renderDiaryContent();
  });
  
  document.getElementById('view-grid-btn')?.addEventListener('click', () => {
    appState.diaryViewMode = 'grid';
    updateDiaryViewBtns();
    renderDiaryContent();
  });
  
  // 캘린더 이전/다음 달 버튼
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    appState.calendarMonth--;
    if (appState.calendarMonth < 0) {
      appState.calendarMonth = 11;
      appState.calendarYear--;
    }
    renderCalendar();
  });
  
  document.getElementById('cal-next')?.addEventListener('click', () => {
    appState.calendarMonth++;
    if (appState.calendarMonth > 11) {
      appState.calendarMonth = 0;
      appState.calendarYear++;
    }
    renderCalendar();
  });
  
  renderCalendar();
  renderDiaryContent();
  initDiaryDragAndDrop(); // 드래그 앤 드롭 초기화
}

/**
 * 다이어리 드래그 앤 드롭 이벤트 설정
 */
function initDiaryDragAndDrop() {
  const container = document.getElementById('diary-content');
  if (!container) return;

  let draggedItem = null;

  container.addEventListener('dragstart', function(e) {
    const target = e.target.closest('.diary-list-item, .diary-card');
    if (target) {
      draggedItem = target;
      target.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  container.addEventListener('dragover', function(e) {
    e.preventDefault(); // 드롭 허용
    e.dataTransfer.dropEffect = 'move';
    const targetItem = e.target.closest('.diary-list-item, .diary-card');
    if (targetItem && targetItem !== draggedItem) {
      const rect = targetItem.getBoundingClientRect();
      // 세로 방향 (목록 뷰)
      if (appState.diaryViewMode === 'list') {
        const offset = e.clientY - rect.top;
        if (offset > rect.height / 2) {
          targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
        } else {
          targetItem.parentNode.insertBefore(draggedItem, targetItem);
        }
      } 
      // 가로 방향 (그리드 뷰)
      else {
        const offset = e.clientX - rect.left;
        if (offset > rect.width / 2) {
          targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
        } else {
          targetItem.parentNode.insertBefore(draggedItem, targetItem);
        }
      }
    }
  });

  container.addEventListener('dragend', function(e) {
    if (draggedItem) {
      draggedItem.style.opacity = '1';
      draggedItem = null;
      
      // 새 순서 추출
      const items = container.querySelectorAll('.diary-list-item, .diary-card');
      const newOrderIds = Array.from(items).map(el => el.getAttribute('data-id')).filter(Boolean);
      
      if (newOrderIds.length > 0) {
        ChloeData.updateMealOrder(appState.selectedCalDate, newOrderIds);
        showToast('식단 순서가 변경되었습니다.', 'success');
      }
    }
  });
}

function renderDiaryTab() {
  renderCalendar();
  renderDiaryContent();
}

function updateDiaryViewBtns() {
  document.getElementById('view-list-btn')?.classList.toggle('active', appState.diaryViewMode === 'list');
  document.getElementById('view-grid-btn')?.classList.toggle('active', appState.diaryViewMode === 'grid');
}

/**
 * 미니 캘린더 렌더링
 */
function renderCalendar() {
  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const monthEl = document.getElementById('cal-month');
  if (monthEl) monthEl.textContent = `${appState.calendarYear}년 ${monthNames[appState.calendarMonth]}`;
  
  const grid = document.getElementById('calendar-days');
  if (!grid) return;
  
  const diaryEntries = ChloeData.getDiaryEntries();
  const recordDates = new Set(diaryEntries.map(e => e.date));
  
  // 1일이 무슨 요일인지 계산
  const firstDay = new Date(appState.calendarYear, appState.calendarMonth, 1).getDay();
  // 이번 달 마지막 날짜
  const lastDate = new Date(appState.calendarYear, appState.calendarMonth + 1, 0).getDate();
  
  const todayStr = getTodayStr();
  grid.innerHTML = '';
  
  // 앞쪽 빈 칸 채우기 (1일 전까지)
  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += '<div></div>';
  }
  
  // 날짜 채우기
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${appState.calendarYear}-${String(appState.calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const hasRecord = recordDates.has(dateStr);
    const isSelected = dateStr === appState.selectedCalDate;
    
    const dayEl = document.createElement('div');
    dayEl.className = `cal-day ${isToday ? 'today' : ''} ${hasRecord ? 'has-record' : ''} ${isSelected ? 'selected' : ''}`;
    dayEl.textContent = d;
    dayEl.onclick = () => {
      appState.selectedCalDate = dateStr;
      renderCalendar();
      renderDiaryContent();
    };
    grid.appendChild(dayEl);
  }
}

/**
 * 선택된 날짜의 식단 목록 렌더링 (리스트 or 그리드 모드)
 */
function renderDiaryContent() {
  const container = document.getElementById('diary-content');
  const summaryEl = document.getElementById('diary-daily-summary');
  if (!container) return;
  
  const dayEntry = ChloeData.getDiaryByDate(appState.selectedCalDate);
  
  if (!dayEntry || dayEntry.meals.length === 0) {
    if (summaryEl) summaryEl.style.display = 'none';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <h3>이 날의 기록이 없어요</h3>
        <p>검색 탭에서 오늘 먹은 음식을<br>기록해보세요!</p>
      </div>`;
    return;
  }
  
  const dateLabel = document.getElementById('diary-date-label');
  if (dateLabel) dateLabel.textContent = appState.selectedCalDate.replace(/-/g, '.');
  
  if (summaryEl) {
    summaryEl.style.display = 'grid';
    const profile = ChloeData.getUserProfile();
    const targets = profile.nutrition_targets || { calories: 1750, protein: 100, fat: 70, sugar: 25 };
    const totals = dayEntry.daily_totals || { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 };
    
    const renderValue = (current, target) => {
      return `${current || 0} <span style="font-size:14px; color:var(--gray-400); font-weight:500;">/ ${target}</span>`;
    };
    
    const elCalories = document.getElementById('diary-today-calories');
    const elProtein = document.getElementById('diary-today-protein');
    const elFat = document.getElementById('diary-today-fat');
    const elSugar = document.getElementById('diary-today-sugar');
    
    if (elCalories) elCalories.innerHTML = renderValue(totals.calories, targets.calories);
    if (elProtein) elProtein.innerHTML = renderValue(totals.protein, targets.protein);
    if (elFat) elFat.innerHTML = renderValue(totals.fat, targets.fat);
    if (elSugar) elSugar.innerHTML = renderValue(totals.sugar, targets.sugar);
    
    const sugarItemEl = document.getElementById('diary-summary-sugar-item');
    if (sugarItemEl) sugarItemEl.classList.toggle('danger-value', totals.sugar >= 25);
  }
  
  if (appState.diaryViewMode === 'list') {
    container.innerHTML = dayEntry.meals.map(meal => `
      <div class="diary-list-item" draggable="true" data-id="${meal.meal_id}" style="cursor: grab;">
        <div class="diary-list-img">
          ${meal.photo_base64 
            ? `<img src="${meal.photo_base64}" style="width:52px;height:52px;object-fit:cover;border-radius:6px">`
            : '🍽️'}
        </div>
        <div class="diary-list-info">
          <h4><span style="color: var(--primary-color); font-size: 13px; margin-right: 4px;">[${meal.meal_type || '식사'}]</span>${meal.food_name}</h4>
          <div class="nutrient-pills">
            <span class="nutrient-pill">🔥 ${meal.api_data.AMT_NUM1}kcal</span>
            <span class="nutrient-pill">💪 단백질 ${meal.api_data.AMT_NUM3}g</span>
            <span class="nutrient-pill sugar-pill">🍬 당류 ${meal.api_data.AMT_NUM7}g</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px">
            ${meal.stickers.map(s => `<span title="${s.label}">${s.emoji}</span>`).join('')}
          </div>
        </div>
        <button class="diary-delete-btn" onclick="deleteMeal('${appState.selectedCalDate}','${meal.meal_id}')">✕</button>
      </div>
    `).join('');
  } else {
    // 그리드 모드
    container.innerHTML = `<div class="diary-grid">${dayEntry.meals.map(meal => `
      <div class="diary-card" draggable="true" data-id="${meal.meal_id}" style="cursor: grab;">
        <div class="diary-card-img">
          ${meal.photo_base64 
            ? `<img src="${meal.photo_base64}" style="width:100%;height:120px;object-fit:cover;">`
            : '🍽️'}
        </div>
        <div class="diary-card-body">
          <div class="diary-card-date">${meal.logged_at.slice(0,10)} · ${meal.meal_type || '식사'}</div>
          <div class="diary-card-food">${meal.food_name}</div>
          <div class="diary-card-stickers">${meal.stickers.map(s=>`<span class="diary-sticker">${s.emoji}</span>`).join('')}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }
}

/**
 * 식단 기록 삭제
 */
function deleteMeal(dateStr, mealId) {
  if (confirm('이 기록을 삭제할까요?')) {
    ChloeData.deleteMealEntry(dateStr, mealId);
    renderDiaryContent();
    renderCalendar();
    renderHomeTab();
    showToast('기록을 삭제했어요.', '');
  }
}

// ============================================================
// 📊 통계 탭 초기화 및 렌더링
// ============================================================
function initStatsTab() { /* 초기화는 렌더링 시 처리 */ }

function renderStatsTab() {
  const profile = ChloeData.getUserProfile();
  const entries = ChloeData.getDiaryEntries();
  
  // 최근 7일 데이터 계산
  const last7Days = getLast7Days();
  const weekEntries = last7Days.map(d => ChloeData.getDiaryByDate(d) || { date: d, meals: [], daily_totals: { calories:0, protein:0, fat:0, sugar:0, sodium:0 } });
  
  const avgSugar = weekEntries.reduce((s, e) => s + e.daily_totals.sugar, 0) / 7;
  const avgProtein = weekEntries.reduce((s, e) => s + e.daily_totals.protein, 0) / 7;
  const avgCalories = weekEntries.reduce((s, e) => s + e.daily_totals.calories, 0) / 7;
  
  // 평균 수치 표시
  setEl('avg-sugar', avgSugar.toFixed(1));
  setEl('avg-sugar-bar', avgSugar.toFixed(1));
  setEl('avg-protein', avgProtein.toFixed(1));
  setEl('avg-protein-bar', avgProtein.toFixed(1));
  setEl('avg-calories', Math.round(avgCalories));
  setEl('avg-cal-bar', Math.round(avgCalories));
  
  // 당류 진행 바 (하루 권장 50g 기준)
  updateStatBar('sugar-bar', avgSugar, 50, true);
  // 단백질 진행 바 (하루 목표 60g 기준)
  updateStatBar('protein-bar', avgProtein, 60, false);
  // 칼로리 진행 바 (하루 목표 2000kcal 기준)
  updateStatBar('calories-bar', avgCalories, 2000, false);
  
  // 주간 스티커 갤러리 렌더링
  renderWeeklyStickers(last7Days, weekEntries);
}

/**
 * 최근 7일 날짜 배열 반환
 */
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return days;
}

/**
 * 통계 진행 바 업데이트
 * @param {string} barId - 진행 바 요소 ID
 * @param {number} value - 현재 값
 * @param {number} max - 최대 값
 * @param {boolean} isDanger - true면 초과 시 위험 스타일
 */
function updateStatBar(barId, value, max, isDanger) {
  const fill = document.getElementById(barId);
  if (!fill) return;
  const pct = Math.min((value / max) * 100, 100);
  fill.style.width = `${pct}%`;
  fill.classList.toggle('danger-fill', isDanger && value > max * 0.7);
}

/**
 * 주간 스티커 갤러리 렌더링
 */
function renderWeeklyStickers(days, entries) {
  const dayLabels = ['일','월','화','수','목','금','토'];
  const container = document.getElementById('weekly-stickers');
  if (!container) return;
  
  container.innerHTML = days.map((dateStr, i) => {
    const entry = entries[i];
    const d = new Date(dateStr);
    const dayLabel = dayLabels[d.getDay()];
    const topSticker = entry.meals.length > 0 
      ? (entry.meals[0]?.stickers[0]?.emoji || '📝') 
      : '○';
    const hasSticker = entry.meals.length > 0;
    
    return `
      <div class="sticker-day ${hasSticker ? 'has-sticker' : ''}">
        <div class="day-label">${dayLabel}</div>
        <div class="day-sticker">${hasSticker ? topSticker : ''}</div>
        <div style="font-size:9px;color:var(--gray-400)">${d.getDate()}일</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// 📷 사진 업로드 처리
// ============================================================
function initPhotoUpload() {
  const photoInput = document.getElementById('photo-input');
  const uploadArea = document.getElementById('photo-upload-area');
  const preview = document.getElementById('photo-preview');
  const placeholder = document.querySelector('.photo-placeholder');
  
  uploadArea?.addEventListener('click', () => photoInput?.click());
  
  photoInput?.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    
    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('사진 크기는 5MB 이하만 가능해요!', 'error');
      return;
    }
    
    // FileReader: 파일을 Base64 문자열로 읽기
    const reader = new FileReader();
    reader.onload = function(e) {
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      uploadArea?.classList.add('has-photo');
    };
    reader.readAsDataURL(file); // Base64로 읽기
  });
  
  // 드래그앤드롭
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--mint-primary)';
  });
  
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      photoInput.files = e.dataTransfer.files;
      photoInput.dispatchEvent(new Event('change'));
    }
  });
}

// ============================================================
// 🔔 토스트 알림 표시
// ============================================================
function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type ? `toast-${type}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  // 2.5초 후 자동으로 사라짐
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================================
// 🛠️ 유틸리티 함수들
// ============================================================

/** 요소의 텍스트 내용을 설정 */
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** 자동완성 드롭다운 숨기기 */
function hideAutocomplete() {
  document.getElementById('autocomplete-list')?.classList.remove('visible');
}

/**
 * 로딩 상태 표시/숨기기
 * @param {boolean} show - true면 보이기
 * @param {string} message - 로딩 중 보여줄 메시지 (기본값: 클로이가 영양 데이터 찾는 중...)
 */
function showLoading(show, message = '클로이가 영양 데이터 찾는 중...') {
  const loadingEl = document.getElementById('search-loading');
  const msgEl = loadingEl?.querySelector('.loading-message');
  
  // UI 비활성화용 요소들
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const imageUpload = document.getElementById('image-upload');
  const photoBtn = document.querySelector('.photo-btn');
  
  if (show) {
    if (msgEl) msgEl.textContent = message;
    if (loadingEl) loadingEl.style.display = 'flex';
    
    // 로딩 중 입력 방지
    if (searchInput) searchInput.disabled = true;
    if (searchBtn) searchBtn.disabled = true;
    if (imageUpload) imageUpload.disabled = true;
    if (photoBtn) photoBtn.style.pointerEvents = 'none';
  } else {
    if (loadingEl) loadingEl.style.display = 'none';
    
    // 입력창 다시 활성화
    if (searchInput) searchInput.disabled = false;
    if (searchBtn) searchBtn.disabled = false;
    if (imageUpload) imageUpload.disabled = false;
    if (photoBtn) photoBtn.style.pointerEvents = 'auto';
  }
}

// 전역으로 노출 (HTML onclick 속성에서 호출하기 위해)
window.saveCurrentMeal = saveCurrentMeal;
window.deleteMeal = deleteMeal;
window.quickSearch = quickSearch;
window.initPhotoUpload = initPhotoUpload;
window.addToBasket = addToBasket;
window.removeFromBasket = removeFromBasket;
window.saveBasket = saveBasket;

// ============================================================
// 🛒 식단 바스켓 - 여러 음식을 한번에 담아서 기록
// ============================================================

/**
 * 음식을 바스켓에 담기
 * @param {Object} food - 음식 데이터
 */
function addToBasket(food) {
  // 이미 담겨있으면 스킵
  if (appState.basket.find(b => b.FOOD_NM_KR === food.FOOD_NM_KR)) {
    showToast(`"${food.FOOD_NM_KR}"은 이미 바스켓에 있어요!`, 'info');
    return;
  }
  appState.basket.push({ ...food, qty: 1 });
  renderBasket();
  showToast(`🛒 "${food.FOOD_NM_KR}" 바스켓에 담았습니다!`, 'success');
}

/**
 * 바스켓에서 음식 제거
 * @param {number} idx - 제거할 인덱스
 */
function removeFromBasket(idx) {
  appState.basket.splice(idx, 1);
  renderBasket();
}

/**
 * 바스켓 UI 렌더링
 */
function renderBasket() {
  let basketEl = document.getElementById('meal-basket');

  // 바스켓 UI가 없으면 동적으로 생성
  if (!basketEl) {
    const feedbackPanel = document.getElementById('feedback-panel');
    if (!feedbackPanel) return;

    basketEl = document.createElement('div');
    basketEl.id = 'meal-basket';
    basketEl.style.cssText = 'background:var(--white); border-radius:12px; padding:16px; margin-bottom:12px; border:2px dashed var(--primary-color);';
    feedbackPanel.insertBefore(basketEl, feedbackPanel.firstChild);
  }

  if (appState.basket.length === 0) {
    basketEl.style.display = 'none';
    return;
  }

  basketEl.style.display = 'block';

  const totalCal = appState.basket.reduce((sum, b) => sum + (b.AMT_NUM1 || 0) * (b.qty || 1), 0).toFixed(0);
  const totalProtein = appState.basket.reduce((sum, b) => sum + (b.AMT_NUM3 || 0) * (b.qty || 1), 0).toFixed(1);

  basketEl.innerHTML = `
    <div style="font-weight:700; color:var(--primary-color); margin-bottom:10px;">
      🛒 식단 바스켓 (${appState.basket.length}개) · 합계 ${totalCal}kcal · 단백질 ${totalProtein}g
    </div>
    <div id="basket-items">
      ${appState.basket.map((b, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--gray-100);">
          <span style="font-size:13px;">${b.FOOD_NM_KR}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" value="${b.qty}" min="0.5" step="0.5"
              style="width:50px; padding:4px; border-radius:6px; border:1px solid var(--gray-200); text-align:center; font-size:12px;"
              onchange="appState.basket[${idx}].qty = parseFloat(this.value) || 1; renderBasket();">
            <span style="font-size:11px; color:var(--gray-500);">${((b.AMT_NUM1 || 0) * (b.qty || 1)).toFixed(0)}kcal</span>
            <button onclick="removeFromBasket(${idx})" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px;">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
    <button onclick="saveBasket()" class="btn-primary" style="width:100%; margin-top:12px;">
      📝 ${appState.basket.length}가지 식단 한번에 기록하기
    </button>
    <button onclick="appState.basket=[]; renderBasket();" class="btn-secondary" style="width:100%; margin-top:6px; font-size:12px;">
      🗑️ 바스켓 비우기
    </button>
  `;
}

/**
 * 바스켓 전체를 한번에 먹기록에 저장
 */
function saveBasket() {
  if (appState.basket.length === 0) return;

  const mealType = document.getElementById('meal-type-select')?.value || '식사';
  const date = appState.selectedCalDate || getTodayStr();
  let saved = 0;

  appState.basket.forEach(food => {
    const qty = food.qty || 1;
    const mealEntry = {
      foodName: food.FOOD_NM_KR,
      calories: Math.round((food.AMT_NUM1 || 0) * qty),
      protein:  Math.round((food.AMT_NUM3 || 0) * qty * 10) / 10,
      fat:      Math.round((food.AMT_NUM4 || 0) * qty * 10) / 10,
      sugar:    Math.round((food.AMT_NUM7 || 0) * qty * 10) / 10,
      sodium:   Math.round((food.AMT_NUM13 || 0) * qty),
      mealType: mealType,
      quantity: qty,
      timestamp: new Date().toISOString(),
      memo: ''
    };
    ChloeData.addMeal(date, mealEntry);
    saved++;
  });

  showToast(`✅ ${saved}가지 식단이 먹기록에 저장되었습니다!`, 'success');
  appState.basket = [];
  renderBasket();
  renderHomeTab();
  document.getElementById('search-input').value = '';
}
