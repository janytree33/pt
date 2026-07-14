-- 001_create_tables.sql
-- 사용자별 데이터 분리 및 암호화 저장을 위한 Supabase 스키마

-- 1. 프로필 (다이어트 목표 설정)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL, -- JSON 문자열을 AES로 암호화하여 저장
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 일일 먹기록 요약 (Diaries)
CREATE TABLE public.diaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_str VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date_str)
);

-- 3. 즐겨찾기 (자주 먹는 메뉴)
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) 설정: 오직 자신(user_id)의 데이터만 읽고 쓸 수 있음
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Diaries Policies
CREATE POLICY "Users can view own diaries" ON public.diaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own diaries" ON public.diaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own diaries" ON public.diaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own diaries" ON public.diaries FOR DELETE USING (auth.uid() = user_id);

-- Favorites Policies
CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);
