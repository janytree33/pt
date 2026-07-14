/**
 * ============================================================
 * app.js - ?대줈????硫붿씤 濡쒖쭅
 * ============================================================
 * ?뱦 ??븷: 紐⑤뱺 ??쓽 UI ?대깽??泥섎━, ?붾㈃ ?꾪솚, ?곗씠???곌껐
 * 
 * ???뚯씪? data.js, api.js, feedback.js瑜?紐⑤몢 議고빀?댁꽌
 * ?ㅼ젣 ?붾㈃??蹂댁뿬二쇰뒗 '珥앷큵 媛먮룆' ??븷???⑸땲??
 * ============================================================
 */

// ============================================================
// ?뙋 ?꾩뿭 ?곹깭 (???꾩껜?먯꽌 怨듭쑀?섎뒗 ?곗씠??
// ============================================================
let appState = {
  currentTab: 'home',           // ?꾩옱 ?쒖꽦?붾맂 ??  selectedFood: null,           // 寃?됱뿉???좏깮???뚯떇
  searchResults: [],            // 寃??寃곌낵 紐⑸줉
  currentDate: new Date(),      // 罹섎┛???꾩옱 ?좎쭨
  selectedCalDate: getTodayStr(), // ?좏깮???좎쭨
  diaryViewMode: 'list',        // 'list' | 'grid' - 癒밴린濡?蹂닿린 紐⑤뱶
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  currentBase64Image: null,     // 泥⑤????ъ쭊 (Base64)
  chatHistory: []               // ?대줈?댁???????댁뿭
};

// ?ㅻ뒛 ?좎쭨瑜?'YYYY-MM-DD' ?뺤떇?쇰줈 諛섑솚
function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

// ============================================================
// ????珥덇린??(?섏씠吏媛 濡쒕뱶?섎㈃ 媛??癒쇱? ?ㅽ뻾)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('?룍截??대줈???몃젅?대꼫 ???쒖옉!');
  
  initGoalToggles();   // 紐⑺몴 ?좉? 珥덇린??  initSearchTab();     // 寃????珥덇린??  initDiaryTab();      // 癒밴린濡???珥덇린??  initStatsTab();      // ?듦퀎 ??珥덇린??  initNavigation();    // ?섎떒 ?ㅻ퉬寃뚯씠??珥덇린??  initChloeChat();
  initAuth();
  renderFavorites();
  attachFavoriteButton();     // ?뮠 ?꾩냽 ???(Chat) ?대깽??珥덇린??  
  renderHomeTab();     // ?????붾㈃ 洹몃━湲?});

// ============================================================
// ?뮠 ?꾩냽 ???(Chat) 珥덇린??// ============================================================
function initChloeChat() {
  const chatInput = document.getElementById('chloe-chat-input');
  const chatSendBtn = document.getElementById('chloe-chat-send-btn');
  const chatMessagesEl = document.getElementById('chloe-chat-messages');

  if (!chatInput || !chatSendBtn || !chatMessagesEl) return;

  const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text || !appState.selectedFood) return;

    // 1. ?좎? 硫붿떆吏 ?뚮뜑留?    chatMessagesEl.insertAdjacentHTML('beforeend', `<div class="chat-bubble user">${text}</div>`);
    chatInput.value = '';
    chatSendBtn.disabled = true;
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // 2. 濡쒕뵫 ?좊땲硫붿씠???뚮뜑留?    const loadingId = 'loading-' + Date.now();
    chatMessagesEl.insertAdjacentHTML('beforeend', `
      <div id="${loadingId}" class="chat-bubble chloe loading">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
    `);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // 3. API ?몄텧
    const profile = ChloeData.getUserProfile();
    const responseText = await ChloeGemini.askChloeChat(
      appState.selectedFood,
      profile.goals,
      appState.chatHistory,
      text
    );

    // 4. ???湲곕줉 ???    appState.chatHistory.push({ role: 'user', text });
    appState.chatHistory.push({ role: 'model', text: responseText });

    // 5. 濡쒕뵫 吏?곌퀬 ?듬? ?뚮뜑留?    const loadingEl = document.getElementById(loadingId);
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
// ?벑 ???ㅻ퉬寃뚯씠??珥덇린??// ============================================================

// ============================================================
// 🔐 Auth & Favorites Logic
// ============================================================
async function initAuth() {
  const modal = document.getElementById('login-modal');
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');
  const btnLogin = document.getElementById('btn-login');
  const btnSignup = document.getElementById('btn-signup');

  // Check session
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
    alert('가입 성공! 로그인해주세요.');
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
    btn.innerHTML = ⭐  + f.FOOD_NM_KR;
    btn.onclick = () => {
      appState.selectedFood = f;
      renderFeedbackPanel(f, {severity:0, messages:['즐겨찾기에서 불러왔습니다!']});
    };
    favList.appendChild(btn);
  });
}

// Add Add-to-favorites button to feedback panel dynamically
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
  // ?섎떒 ?ㅻ퉬寃뚯씠??踰꾪듉?ㅼ쓣 紐⑤몢 李얠븘??  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      // ?대┃?????대쫫 媛?몄삤湲?(data-tab ?띿꽦)
      const targetTab = this.dataset.tab;
      switchTab(targetTab);
    });
  });
}

/**
 * ???꾪솚 ?⑥닔
 * @param {string} tabName - 'home' | 'search' | 'diary' | 'stats'
 */
function switchTab(tabName) {
  appState.currentTab = tabName;
  
  // 紐⑤뱺 ??鍮꾪솢?깊솕
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // ?좏깮?????쒖꽦??  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  // ??퀎 ?곗씠???덈줈怨좎묠
  if (tabName === 'home') renderHomeTab();
  if (tabName === 'diary') renderDiaryTab();
  if (tabName === 'stats') renderStatsTab();
}

// ============================================================
// ?룧 ?????뚮뜑留?// ============================================================
function renderHomeTab() {
  const profile = ChloeData.getUserProfile();
  renderDailySummary(profile);
  updateSparta(profile);
}

/**
 * ?ㅻ뒛???곸뼇 ?붿빟 移대뱶 ?낅뜲?댄듃
 */
function renderDailySummary(profile) {
  const todayStr = getTodayStr();
  const todayDiary = ChloeData.getDiaryByDate(todayStr);
  const totals = todayDiary?.daily_totals || { calories: 0, protein: 0, fat: 0, sugar: 0, sodium: 0 };
  
  const targets = profile.nutrition_targets || { calories: 1750, protein: 100, fat: 70, sugar: 25 };
  
  // 臾댁“嫄??밸쪟 25g ?댁긽?대㈃ 寃쎄퀬 (怨좉컼???붿껌)
  const sugarDanger = totals.sugar >= 25;
  
  // 紐⑺몴移??鍮?HTML ?앹꽦 ?⑥닔
  const renderValue = (current, target) => {
    return `${current || 0} <span style="font-size:14px; color:var(--gray-400); font-weight:500;">/ ${target}</span>`;
  };
  
  // setEl ???innerHTML ?ъ슜
  const elCalories = document.getElementById('today-calories');
  const elProtein = document.getElementById('today-protein');
  const elFat = document.getElementById('today-fat');
  const elSugar = document.getElementById('today-sugar');
  
  if (elCalories) elCalories.innerHTML = renderValue(totals.calories, targets.calories);
  if (elProtein) elProtein.innerHTML = renderValue(totals.protein, targets.protein);
  if (elFat) elFat.innerHTML = renderValue(totals.fat, targets.fat);
  if (elSugar) elSugar.innerHTML = renderValue(totals.sugar, targets.sugar);
  
  // ?밸쪟 珥덇낵硫?鍮④컙??媛뺤“
  const sugarEl = document.getElementById('summary-sugar-item');
  if (sugarEl) {
    sugarEl.classList.toggle('danger-value', sugarDanger);
  }
}

// ============================================================
// ?럾截?紐⑺몴 ?좉? 珥덇린??諛??대깽??// ============================================================
function initGoalToggles() {
  const profile = ChloeData.getUserProfile();
  
  // ??λ맂 媛믪쑝濡??좉? 珥덇린 ?곹깭 ?ㅼ젙
  setToggle('toggle-fasting', profile.goals.intermittent_fasting);
  setToggle('toggle-sugar', profile.goals.sugar_detox);
  setToggle('toggle-protein', profile.goals.protein_boost);
  
  // 媛??좉????대깽??由ъ뒪???곌껐
  addToggleListener('toggle-fasting', 'intermittent_fasting');
  addToggleListener('toggle-sugar', 'sugar_detox');
  addToggleListener('toggle-protein', 'protein_boost');
  
  // ?ㅽ뙆瑜댄? ?곹깭 ?낅뜲?댄듃
  updateSparta(profile);
}

/**
 * ?좉? ?곹깭 ?쒓컖?곸쑝濡??ㅼ젙
 */
function setToggle(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = value;
}

/**
 * ?좉? ?대깽??由ъ뒪??異붽?
 */
function addToggleListener(id, goalKey) {
  const el = document.getElementById(id);
  if (!el) return;
  
  el.addEventListener('change', function() {
    // 濡쒖뺄?ㅽ넗由ъ? ?낅뜲?댄듃
    ChloeData.updateGoal(goalKey, this.checked);
    
    // ?ㅽ뙆瑜댄? 紐⑤뱶 泥댄겕
    const profile = ChloeData.getUserProfile();
    updateSparta(profile);
    
    // ?????붿빟 媛깆떊
    renderDailySummary(profile);
    
    // ?좎뒪??硫붿떆吏 ?쒖떆
    if (this.checked) {
      const names = {
        'intermittent_fasting': '??媛꾪뿉???⑥떇',
        'sugar_detox': '?뜫 ?덇? ?뷀넚??,
        'protein_boost': '?뮞 ?앷렐?앷렐'
      };
      showToast(`${names[goalKey]} 紐⑤뱶 ON!`, 'success');
    }
  });
}

/**
 * ?ㅽ뙆瑜댄? 紐⑤뱶 UI ?낅뜲?댄듃
 */
function updateSparta(profile) {
  const isSparta = profile.sparta_mode ||
    (profile.goals.intermittent_fasting && profile.goals.sugar_detox && profile.goals.protein_boost);
  
  // ?ㅽ뙆瑜댄? ?뚮┝ 諛곕꼫 ?쒖떆/?④?
  const spartaAlert = document.getElementById('sparta-alert');
  if (spartaAlert) spartaAlert.classList.toggle('visible', isSparta);
  
  // ?ㅻ뜑???ㅽ뙆瑜댄? 諛곗? ?쒖떆/?④?
  const spartaBadge = document.getElementById('sparta-badge');
  if (spartaBadge) spartaBadge.style.display = isSparta ? 'inline-flex' : 'none';
}

// ============================================================
// ?뵇 寃????珥덇린??// ============================================================
function initSearchTab() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  
  if (!searchInput) return;
  
  // 理쒓렐 寃?됱뼱 遺덈윭?ㅺ린
  renderRecentSearches();

  // ?벜 ?ъ쭊 泥⑤? ?대깽??泥섎━
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
          
          // ?ъ쭊??泥⑤??섏뿀?쇰?濡?寃??踰꾪듉???꾨Ⅴ?꾨줉 ?좊룄 (?먮룞 寃????젣)
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

  // ?뱥 ?대┰蹂대뱶 ?대?吏 遺숈뿬?ｊ린(Ctrl+V) 吏??  document.addEventListener('paste', function(e) {
    // ??씠 'search'???뚮쭔 ?숈옉?섎룄濡??쒗븳 (?좏깮 ?ы빆?댁?留??덉쟾??
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
          showToast('???대?吏媛 ?대┰蹂대뱶?먯꽌 泥⑤??섏뿀?듬땲??', 'success');
        };
        reader.readAsDataURL(file);
        break; // 泥?踰덉㎏ ?대?吏留?泥섎━
      }
    }
  });

  // ???????????????????????????????????????????????????????
  // ????댄븨 ?먮룞?꾩꽦 (isExplicit = false)
  // ?臾몄옄 ?낅젰 ?쒕쭏??500ms ?붾컮?댁뒪濡?API ?몄텧
  // ??좑툘 ??寃쎈줈??寃?됱뼱 ??????? (?덉뒪?좊━ 以묐났 ???諛⑹?)
  // ???????????????????????????????????????????????????????
  let debounceTimer;
  searchInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    const query = this.value.trim();

    if (query.length < 2) {
      hideAutocomplete();
      return;
    }

    // ?붾컮?댁뒪: 500ms ?댄썑 ?먮룞?꾩꽦 ?꾩슜 寃??(isExplicit = false ???덉뒪?좊━ 誘몄???
    debounceTimer = setTimeout(() => {
      performSearch(query, false);
    }, 500);
  });

  // ???????????????????????????????????????????????????????
  // ??紐낆떆??寃??(isExplicit = true)
  // ??뷀꽣???먮뒗 寃??踰꾪듉 ?대┃ ?쒖뿉留??덉뒪?좊━????β붿씠寃??먮━!
  // ???????????????????????????????????????????????????????
  searchBtn?.addEventListener('click', () => {
    const query = searchInput.value.trim();
    const hasImage = !!appState.currentBase64Image;
    if (!query && !hasImage) return;
    
    clearTimeout(debounceTimer); // ?붾컮?댁뒪 痍⑥냼 (以묐났 ?몄텧 諛⑹?)
    performSearch(query, true);  // 紐낆떆??寃?????덉뒪?좊━ ???O
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      const hasImage = !!appState.currentBase64Image;
      if (!query && !hasImage) return;
      
      clearTimeout(debounceTimer); // ?붾컮?댁뒪 痍⑥냼
      performSearch(query, true);  // 紐낆떆??寃?????덉뒪?좊━ ???O
    }
  });

  // 寃?됱갹 諛붽묑 ?대┃ ???먮룞?꾩꽦 ?リ린
  document.addEventListener('click', function(e) {
    if (!document.getElementById('search-wrapper')?.contains(e.target)) {
      hideAutocomplete();
    }
  });
}

/**
 * ?앹빟泥?API 寃???ㅽ뻾 + Gemini AI ?대갚 遺꾧린
 *
 * @param {string}  query      - 寃?됱뼱
 * @param {boolean} isExplicit - true: ?뷀꽣/踰꾪듉 ?ㅼ쓽 紐낆떆??寃??(?덉뒪?좊━ ???O)
 *                               false: ??댄븨 ?붾컮?댁뒪 ?먮룞 寃??(?덉뒪?좊━ ???X)
 *
 * ?좑툘 踰꾧렇 ?섏젙 ?대젰 (2026-07-14):
 *   湲곗〈: isExplicit 援щ텇 ?놁씠 ?붾컮?댁뒪 諛쒕룞 ?쒖뿉??AI ?대갚???덉뒪?좊━ ?????以묎컙 ??댄븨媛??꾩쟻
 *   ?섏젙: isExplicit=true???뚮쭔 ?덉뒪?좊━ ??? */
async function performSearch(query, isExplicit = false) {
  const hasImage = !!appState.currentBase64Image;

  if (!query && !hasImage) return;

  // ?? 1?④퀎: ?앹빟泥?怨듦났 API ?몄텧 ??????????????????????????
  showLoading(true, hasImage ? '?벜 ?ъ쭊???곸뼇 ?깅텇??遺꾩꽍 以묒엯?덈떎...' : '怨듦났 ?곗씠?곕쿋?댁뒪 寃??以?..');
  hideAutocomplete();

  let publicResults = [];
  
  // ?대?吏媛 泥⑤??섏뿀?ㅻ㈃ 怨듦났 DB??臾댁떆?섍퀬 臾댁“嫄?AI 遺꾩꽍?쇰줈 吏곹뻾
  if (!hasImage) {
    try {
      const rawResults = await ChloeAPI.searchFood(query);
      publicResults = rawResults.map(ChloeAPI.normalizeNutrition);
    } catch (e) {
      console.warn('怨듦났 API ?ㅻ쪟, AI ?대갚?쇰줈 ?꾪솚:', e.message);
    }

    // ?? 2?④퀎: 怨듦났 API 寃곌낵媛 ?덉쑝硫??먮룞?꾩꽦 ?쒖떆 ??醫낅즺 ??
    if (publicResults.length > 0) {
      renderAutocomplete(publicResults);
      showLoading(false);
      return;
    }
  }

  // ?? 3?④퀎: 寃곌낵 ?놁쓬 (?먮뒗 ?ъ쭊 泥⑤?) ??AI ?대갚
  // isExplicit = false(??댄븨 以?:
  // ?대?吏媛 ?덈뱺 ?녿뱺, ??댄븨 以?isExplicit=false)?대㈃ AI ?몄텧??留됱뒿?덈떎. (荑쇳꽣 珥덇낵 諛⑹?)
  if (!isExplicit) {
    showLoading(false);
    return;
  }

  // ?? 4?④퀎: 紐낆떆??寃?됱씪 ?뚮쭔 AI ?대갚 ?ㅽ뻾 ??????????????????
  showLoading(true, '???대줈?닿? ' + (hasImage ? '?ъ쭊???쎄퀬 ' : '') + '?곸뼇 ?곗씠?곕? 異붿젙 以묒엯?덈떎...');

  try {
    const profile = ChloeData.getUserProfile();
    const aiNutrition = await ChloeGemini.callGeminiForFood(query || "???ъ쭊 ???뚯떇", profile.goals, appState.currentBase64Image);

    // ??紐낆떆??寃?됱씪 ?뚮쭔 ?덉뒪?좊━ ???
    if (query) {
      ChloeData.saveSearchHistory(query);
      renderRecentSearches();
      document.getElementById('search-input').value = query;
    }

    // ?ъ쭊???덉뿀?ㅻ㈃ 遺꾩꽍 ????珥덇린??    if (hasImage) {
      appState.currentBase64Image = null;
      const imageUpload = document.getElementById('image-upload');
      const imagePreviewContainer = document.getElementById('image-preview-container');
      if (imageUpload) imageUpload.value = '';
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      if (!query) document.getElementById('search-input').value = '';
    }

    selectFoodFromAI(aiNutrition);

  } catch (aiError) {
    console.error('??AI ?대갚???ㅽ뙣:', aiError.message);
    showToast(`?대줈?닿? ???뚯떇??紐⑤Ⅴ寃좎뼱???쁾 (?댁쑀: ${aiError.message})`, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * ?먮룞?꾩꽦 由ъ뒪???뚮뜑留? */
function renderAutocomplete(items) {
  const list = document.getElementById('autocomplete-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.innerHTML = `
      <span style="font-size:18px">?띂截?/span>
      <span class="food-name">${item.FOOD_NM_KR}</span>
      <span class="food-cal">${item.AMT_NUM1}kcal</span>
    `;
    
    // ?뚯떇 ?좏깮 ???쇰뱶諛??쒖떆
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
 * 怨듦났 API 寃곌낵 ?좏깮 ??湲곗〈 ?쇰뱶諛??⑤꼸 ?쒖떆
 */
function selectFood(nutrition) {
  appState.selectedFood = nutrition;
  const profile = ChloeData.getUserProfile();
  const feedback = ChloeFeedback.generateFeedback(nutrition, profile.goals);

  // AI 諭껋? ?④린湲?(怨듦났 ?곗씠?곕뒗 AI ?꾨땲誘濡?
  toggleAIBadge(false);

  renderFeedbackPanel(nutrition, feedback);

  // ?쇰뱶諛??⑤꼸濡??ㅽ겕濡?  setTimeout(() => {
    document.getElementById('feedback-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/**
 * AI ?대갚 寃곌낵 ?좏깮 ??AI ?꾩슜 ?쇰뱶諛??⑤꼸 ?쒖떆
 * 怨듦났 API? ?숈씪??UI 援ъ“瑜??곕릺, AI 諭껋? + AI ?쇰뱶諛??띿뒪??異붽?
 */
function selectFoodFromAI(aiNutrition) {
  appState.selectedFood = aiNutrition;
  const profile = ChloeData.getUserProfile();

  // ??AI ?꾩슜: 湲곗〈 ?쇰뱶諛?濡쒖쭅 ???AI媛 留뚮뱺 ?쇰뱶諛??띿뒪???ъ슜
  // ?? ?ㅽ떚而??먮룞 遺?щ뒗 湲곗〈 濡쒖쭅 洹몃?濡??쒖슜
  const feedback = ChloeFeedback.generateFeedback(aiNutrition, profile.goals);

  // AI 諭껋? 蹂댁씠湲?  toggleAIBadge(true);

  // 怨듯넻 ?⑤꼸 ?뚮뜑留?  renderFeedbackPanel(aiNutrition, feedback);

  // AI ?쇰뱶諛??띿뒪?몃줈 ??뼱?곌린 (?대줈?닿? 吏곸젒 ??硫섑듃)
  if (aiNutrition._aiFeedback) {
    const msgsEl = document.getElementById('feedback-messages');
    if (msgsEl) {
      // ?밸쪟 ?섏????곕씪 ?ш컖???됱긽 寃곗젙
      const sugar = aiNutrition.AMT_NUM7;
      const severityClass = sugar > 25 ? 'feedback-danger'
                          : sugar > 10 ? 'feedback-warning'
                          : 'feedback-good';
      const msgType = sugar > 25 ? 'danger' : sugar > 10 ? 'warning' : 'good';

      msgsEl.className = `feedback-box ${severityClass}`;
      msgsEl.innerHTML = `
        <div class="feedback-msg msg-${msgType}">
          <span class="msg-icon">?쨼</span>
          <span>${aiNutrition._aiFeedback}</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--gray-400);text-align:right">
          ?뱪 ?쒓났?? ${aiNutrition._servingSize}
        </div>
      `;
    }
  }

  // ?쇰뱶諛??⑤꼸濡??ㅽ겕濡?  setTimeout(() => {
    document.getElementById('feedback-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/**
 * AI 諭껋? ?쒖떆/?④? ?좉?
 * @param {boolean} show - true硫?蹂댁씠湲? false硫??④린湲? */
function toggleAIBadge(show) {
  const badge = document.getElementById('ai-analysis-badge');
  if (badge) badge.style.display = show ? 'flex' : 'none';
  // ?곸뼇 ?곗씠???덈궡 臾멸뎄??AI 異붿젙移섏엫???뚮┝
  const disclaimer = document.getElementById('ai-disclaimer');
  if (disclaimer) disclaimer.style.display = show ? 'block' : 'none';
}

/**
 * ?쇰뱶諛??⑤꼸 ?뚮뜑留?(?곸뼇 ?뺣낫 + ?대줈??肄붾찘??
 * 怨듦났 API? AI ?대갚 紐⑤몢 ???⑥닔瑜??듯빐 ?뚮뜑留곷맖
 */
function renderFeedbackPanel(nutrition, feedback) {
  const panel = document.getElementById('feedback-panel');
  if (!panel) return;

  const sugarCubes = Math.round(nutrition.AMT_NUM7 / 4);
  const mood = ChloeFeedback.getChloeMood(feedback.severity);

  // ?곸뼇 ?뺣낫 ?낅뜲?댄듃
  setEl('nut-calories', nutrition.AMT_NUM1);
  setEl('nut-protein', nutrition.AMT_NUM3);
  setEl('nut-fat', nutrition.AMT_NUM4);
  setEl('nut-sugar', nutrition.AMT_NUM7);
  setEl('nut-sodium', nutrition.AMT_NUM13);
  setEl('food-title', nutrition.FOOD_NM_KR);
  setEl('sugar-cubes-text', sugarCubes > 0 ? `媛곸꽕??${sugarCubes}媛?遺꾨웾` : '?밸쪟 ?놁쓬');

  // ?대줈??湲곕텇 ?대え吏 ?낅뜲?댄듃
  setEl('chloe-mood-emoji', mood);

  // ?ㅽ떚而??뚮뜑留?(AI ?대갚???먮룞 ?ㅽ떚而?遺??
  const stickersEl = document.getElementById('feedback-stickers');
  if (stickersEl) {
    stickersEl.innerHTML = feedback.stickers.map(s =>
      `<span class="sticker-badge">${s.emoji} ${s.label}</span>`
    ).join('');
  }

  // ?쇰뱶諛?硫붿떆吏???뚮뜑留?(AI ?대갚?먯꽌??selectFoodFromAI媛 ??뼱?)
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

  // ?뮠 梨꾪똿 ?댁뿭 珥덇린??諛?泥?硫붿떆吏 ?명똿
  appState.chatHistory = [];
  const chatMessagesEl = document.getElementById('chloe-chat-messages');
  if (chatMessagesEl) {
    chatMessagesEl.innerHTML = `
      <div class="chat-bubble chloe">
        臾댁뾿?대뱺 臾쇱뼱蹂댁꽭?? ?곸뼇?뚮굹 ?泥??뚯떇?????移쒖젅?섍쾶 ?뚮젮?쒕┫寃뚯슂. ?뭲?띯?截?      </div>
    `;
  }
  const chatInput = document.getElementById('chloe-chat-input');
  if (chatInput) chatInput.value = '';

  // ?⑤꼸 蹂댁씠湲?  panel.classList.add('visible');
}

/**
 * 理쒓렐 寃?됱뼱 ?쒓렇 ?뚮뜑留? */
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
         <button class="tag-btn" onclick="quickSearch('${keyword}')" style="padding-right:24px;">?뵇 ${keyword}</button>
         <button onclick="deleteRecentSearch('${keyword}', event)" style="position:absolute; right:6px; background:none; border:none; font-size:12px; color:var(--coral); cursor:pointer; padding:2px; display:flex; align-items:center; justify-content:center;">??/button>
       </div>`
    ).join('');
  }
}

/**
 * 理쒓렐 寃?됱뼱 媛쒕퀎 ??젣 ?몃뱾??(?꾩뿭)
 */
window.deleteRecentSearch = function(keyword, event) {
  event.stopPropagation();
  ChloeData.deleteSearchHistory(keyword);
  renderRecentSearches();
};

/**
 * 鍮좊Ⅸ 寃??(理쒓렐 寃?됱뼱 ?쒓렇 ?대┃ ??
 */
function quickSearch(keyword) {
  document.getElementById('search-input').value = keyword;
  performSearch(keyword, true); // ?쒓렇 ?대┃? 紐낆떆??寃??}

/**
 * 湲곕줉?섍린 踰꾪듉 ?대┃ 泥섎━
 */
function saveCurrentMeal() {
  if (!appState.selectedFood) return;
  
  const profile = ChloeData.getUserProfile();
  const feedback = ChloeFeedback.generateFeedback(appState.selectedFood, profile.goals);
  
  // ?ъ쭊 ?곗씠??媛?몄삤湲?  const photoInput = document.getElementById('photo-input');
  const photoPreview = document.getElementById('photo-preview');
  const memoInput = document.getElementById('meal-memo');
  const mealTypeSelect = document.getElementById('meal-type-select'); // ?앹궗 醫낅쪟 異붽?
  const quantityInput = document.getElementById('meal-quantity'); // ?뽳툘 ?섎웾(諛곗닔)
  
  // ?섎웾 怨꾩궛
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
    meal_type: mealTypeSelect ? mealTypeSelect.value : '?앹궗',
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
    showToast('?럦 癒밴린濡?????꾨즺!', 'success');
    
    // ?낅젰 珥덇린??    appState.selectedFood = null;
    document.getElementById('search-input').value = '';
    document.getElementById('feedback-panel')?.classList.remove('visible');
    if (memoInput) memoInput.value = '';
    if (photoPreview) {
      photoPreview.src = '';
      photoPreview.style.display = 'none';
    }
    const placeholder = document.querySelector('.photo-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    
    // ?듦퀎 ??媛깆떊
    renderHomeTab();
  } else {
    showToast('??μ뿉 ?ㅽ뙣?덉뼱?? ?ㅼ떆 ?쒕룄?댁＜?몄슂.', 'error');
  }
}

// ============================================================
// ?뱰 癒밴린濡???珥덇린??諛??뚮뜑留?// ============================================================
function initDiaryTab() {
  // 蹂닿린 紐⑤뱶 ?좉? 踰꾪듉
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
  
  // 罹섎┛???댁쟾/?ㅼ쓬 ??踰꾪듉
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
  initDiaryDragAndDrop(); // ?쒕옒洹????쒕∼ 珥덇린??}

/**
 * ?ㅼ씠?대━ ?쒕옒洹????쒕∼ ?대깽???ㅼ젙
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
    e.preventDefault(); // ?쒕∼ ?덉슜
    e.dataTransfer.dropEffect = 'move';
    const targetItem = e.target.closest('.diary-list-item, .diary-card');
    if (targetItem && targetItem !== draggedItem) {
      const rect = targetItem.getBoundingClientRect();
      // ?몃줈 諛⑺뼢 (紐⑸줉 酉?
      if (appState.diaryViewMode === 'list') {
        const offset = e.clientY - rect.top;
        if (offset > rect.height / 2) {
          targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
        } else {
          targetItem.parentNode.insertBefore(draggedItem, targetItem);
        }
      } 
      // 媛濡?諛⑺뼢 (洹몃━??酉?
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
      
      // ???쒖꽌 異붿텧
      const items = container.querySelectorAll('.diary-list-item, .diary-card');
      const newOrderIds = Array.from(items).map(el => el.getAttribute('data-id')).filter(Boolean);
      
      if (newOrderIds.length > 0) {
        ChloeData.updateMealOrder(appState.selectedCalDate, newOrderIds);
        showToast('?앸떒 ?쒖꽌媛 蹂寃쎈릺?덉뒿?덈떎.', 'success');
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
 * 誘몃땲 罹섎┛???뚮뜑留? */
function renderCalendar() {
  const monthNames = ['1??,'2??,'3??,'4??,'5??,'6??,'7??,'8??,'9??,'10??,'11??,'12??];
  const monthEl = document.getElementById('cal-month');
  if (monthEl) monthEl.textContent = `${appState.calendarYear}??${monthNames[appState.calendarMonth]}`;
  
  const grid = document.getElementById('calendar-days');
  if (!grid) return;
  
  const diaryEntries = ChloeData.getDiaryEntries();
  const recordDates = new Set(diaryEntries.map(e => e.date));
  
  // 1?쇱씠 臾댁뒯 ?붿씪?몄? 怨꾩궛
  const firstDay = new Date(appState.calendarYear, appState.calendarMonth, 1).getDay();
  // ?대쾲 ??留덉?留??좎쭨
  const lastDate = new Date(appState.calendarYear, appState.calendarMonth + 1, 0).getDate();
  
  const todayStr = getTodayStr();
  grid.innerHTML = '';
  
  // ?욎そ 鍮?移?梨꾩슦湲?(1???꾧퉴吏)
  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += '<div></div>';
  }
  
  // ?좎쭨 梨꾩슦湲?  for (let d = 1; d <= lastDate; d++) {
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
 * ?좏깮???좎쭨???앸떒 紐⑸줉 ?뚮뜑留?(由ъ뒪??or 洹몃━??紐⑤뱶)
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
        <div class="empty-icon">?띂截?/div>
        <h3>???좎쓽 湲곕줉???놁뼱??/h3>
        <p>寃????뿉???ㅻ뒛 癒뱀? ?뚯떇??br>湲곕줉?대낫?몄슂!</p>
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
            : '?띂截?}
        </div>
        <div class="diary-list-info">
          <h4><span style="color: var(--primary-color); font-size: 13px; margin-right: 4px;">[${meal.meal_type || '?앹궗'}]</span>${meal.food_name}</h4>
          <div class="nutrient-pills">
            <span class="nutrient-pill">?뵦 ${meal.api_data.AMT_NUM1}kcal</span>
            <span class="nutrient-pill">?뮞 ?⑤갚吏?${meal.api_data.AMT_NUM3}g</span>
            <span class="nutrient-pill">?쭏 吏諛?${meal.api_data.AMT_NUM4}g</span>
            <span class="nutrient-pill sugar-pill">?┫ ?밸쪟 ${meal.api_data.AMT_NUM7}g</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px">
            ${meal.stickers.map(s => `<span title="${s.label}">${s.emoji}</span>`).join('')}
          </div>
        </div>
        <button class="diary-delete-btn" onclick="deleteMeal('${appState.selectedCalDate}','${meal.meal_id}')">??/button>
      </div>
    `).join('');
  } else {
    // 洹몃━??紐⑤뱶
    container.innerHTML = `<div class="diary-grid">${dayEntry.meals.map(meal => `
      <div class="diary-card" draggable="true" data-id="${meal.meal_id}" style="cursor: grab;">
        <div class="diary-card-img">
          ${meal.photo_base64 
            ? `<img src="${meal.photo_base64}" style="width:100%;height:120px;object-fit:cover;">`
            : '?띂截?}
        </div>
        <div class="diary-card-body">
          <div class="diary-card-date">${meal.logged_at.slice(0,10)} 쨌 ${meal.meal_type || '?앹궗'}</div>
          <div class="diary-card-food">${meal.food_name}</div>
          <div class="diary-card-stickers">${meal.stickers.map(s=>`<span class="diary-sticker">${s.emoji}</span>`).join('')}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }
}

/**
 * ?앸떒 湲곕줉 ??젣
 */
function deleteMeal(dateStr, mealId) {
  if (confirm('??湲곕줉????젣?좉퉴??')) {
    ChloeData.deleteMealEntry(dateStr, mealId);
    renderDiaryContent();
    renderCalendar();
    renderHomeTab();
    showToast('湲곕줉????젣?덉뼱??', '');
  }
}

// ============================================================
// ?뱤 ?듦퀎 ??珥덇린??諛??뚮뜑留?// ============================================================
function initStatsTab() { /* 珥덇린?붾뒗 ?뚮뜑留???泥섎━ */ }

function renderStatsTab() {
  const profile = ChloeData.getUserProfile();
  const entries = ChloeData.getDiaryEntries();
  
  // 理쒓렐 7???곗씠??怨꾩궛
  const last7Days = getLast7Days();
  const weekEntries = last7Days.map(d => ChloeData.getDiaryByDate(d) || { date: d, meals: [], daily_totals: { calories:0, protein:0, fat:0, sugar:0, sodium:0 } });
  
  const avgSugar = weekEntries.reduce((s, e) => s + e.daily_totals.sugar, 0) / 7;
  const avgProtein = weekEntries.reduce((s, e) => s + e.daily_totals.protein, 0) / 7;
  const avgCalories = weekEntries.reduce((s, e) => s + e.daily_totals.calories, 0) / 7;
  
  // ?됯퇏 ?섏튂 ?쒖떆
  setEl('avg-sugar', avgSugar.toFixed(1));
  setEl('avg-sugar-bar', avgSugar.toFixed(1));
  setEl('avg-protein', avgProtein.toFixed(1));
  setEl('avg-protein-bar', avgProtein.toFixed(1));
  setEl('avg-calories', Math.round(avgCalories));
  setEl('avg-cal-bar', Math.round(avgCalories));
  
  // ?밸쪟 吏꾪뻾 諛?(?섎（ 沅뚯옣 50g 湲곗?)
  updateStatBar('sugar-bar', avgSugar, 50, true);
  // ?⑤갚吏?吏꾪뻾 諛?(?섎（ 紐⑺몴 60g 湲곗?)
  updateStatBar('protein-bar', avgProtein, 60, false);
  // 移쇰줈由?吏꾪뻾 諛?(?섎（ 紐⑺몴 2000kcal 湲곗?)
  updateStatBar('calories-bar', avgCalories, 2000, false);
  
  // 二쇨컙 ?ㅽ떚而?媛ㅻ윭由??뚮뜑留?  renderWeeklyStickers(last7Days, weekEntries);
}

/**
 * 理쒓렐 7???좎쭨 諛곗뿴 諛섑솚
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
 * ?듦퀎 吏꾪뻾 諛??낅뜲?댄듃
 * @param {string} barId - 吏꾪뻾 諛??붿냼 ID
 * @param {number} value - ?꾩옱 媛? * @param {number} max - 理쒕? 媛? * @param {boolean} isDanger - true硫?珥덇낵 ???꾪뿕 ?ㅽ??? */
function updateStatBar(barId, value, max, isDanger) {
  const fill = document.getElementById(barId);
  if (!fill) return;
  const pct = Math.min((value / max) * 100, 100);
  fill.style.width = `${pct}%`;
  fill.classList.toggle('danger-fill', isDanger && value > max * 0.7);
}

/**
 * 二쇨컙 ?ㅽ떚而?媛ㅻ윭由??뚮뜑留? */
function renderWeeklyStickers(days, entries) {
  const dayLabels = ['??,'??,'??,'??,'紐?,'湲?,'??];
  const container = document.getElementById('weekly-stickers');
  if (!container) return;
  
  container.innerHTML = days.map((dateStr, i) => {
    const entry = entries[i];
    const d = new Date(dateStr);
    const dayLabel = dayLabels[d.getDay()];
    const topSticker = entry.meals.length > 0 
      ? (entry.meals[0]?.stickers[0]?.emoji || '?뱷') 
      : '??;
    const hasSticker = entry.meals.length > 0;
    
    return `
      <div class="sticker-day ${hasSticker ? 'has-sticker' : ''}">
        <div class="day-label">${dayLabel}</div>
        <div class="day-sticker">${hasSticker ? topSticker : ''}</div>
        <div style="font-size:9px;color:var(--gray-400)">${d.getDate()}??/div>
      </div>
    `;
  }).join('');
}

// ============================================================
// ?벜 ?ъ쭊 ?낅줈??泥섎━
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
    
    // ?뚯씪 ?ш린 ?쒗븳 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('?ъ쭊 ?ш린??5MB ?댄븯留?媛?ν빐??', 'error');
      return;
    }
    
    // FileReader: ?뚯씪??Base64 臾몄옄?대줈 ?쎄린
    const reader = new FileReader();
    reader.onload = function(e) {
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      uploadArea?.classList.add('has-photo');
    };
    reader.readAsDataURL(file); // Base64濡??쎄린
  });
  
  // ?쒕옒洹몄븻?쒕∼
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
// ?뵒 ?좎뒪???뚮┝ ?쒖떆
// ============================================================
function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type ? `toast-${type}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  // 2.5珥????먮룞?쇰줈 ?щ씪吏?  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================================
// ?썱截??좏떥由ы떚 ?⑥닔??// ============================================================

/** ?붿냼???띿뒪???댁슜???ㅼ젙 */
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** ?먮룞?꾩꽦 ?쒕∼?ㅼ슫 ?④린湲?*/
function hideAutocomplete() {
  document.getElementById('autocomplete-list')?.classList.remove('visible');
}

/**
 * 濡쒕뵫 ?곹깭 ?쒖떆/?④린湲? * @param {boolean} show - true硫?蹂댁씠湲? * @param {string} message - 濡쒕뵫 以?蹂댁뿬以?硫붿떆吏 (湲곕낯媛? ?대줈?닿? ?곸뼇 ?곗씠??李얜뒗 以?..)
 */
function showLoading(show, message = '?대줈?닿? ?곸뼇 ?곗씠??李얜뒗 以?..') {
  const loadingEl = document.getElementById('search-loading');
  const msgEl = loadingEl?.querySelector('.loading-message');
  
  // UI 鍮꾪솢?깊솕???붿냼??  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const imageUpload = document.getElementById('image-upload');
  const photoBtn = document.querySelector('.photo-btn');
  
  if (show) {
    if (msgEl) msgEl.textContent = message;
    if (loadingEl) loadingEl.style.display = 'flex';
    
    // 濡쒕뵫 以??낅젰 諛⑹?
    if (searchInput) searchInput.disabled = true;
    if (searchBtn) searchBtn.disabled = true;
    if (imageUpload) imageUpload.disabled = true;
    if (photoBtn) photoBtn.style.pointerEvents = 'none';
  } else {
    if (loadingEl) loadingEl.style.display = 'none';
    
    // ?낅젰李??ㅼ떆 ?쒖꽦??    if (searchInput) searchInput.disabled = false;
    if (searchBtn) searchBtn.disabled = false;
    if (imageUpload) imageUpload.disabled = false;
    if (photoBtn) photoBtn.style.pointerEvents = 'auto';
  }
}

// ?꾩뿭?쇰줈 ?몄텧 (HTML onclick ?띿꽦?먯꽌 ?몄텧?섍린 ?꾪빐)
window.saveCurrentMeal = saveCurrentMeal;
window.deleteMeal = deleteMeal;
window.quickSearch = quickSearch;
window.initPhotoUpload = initPhotoUpload;


