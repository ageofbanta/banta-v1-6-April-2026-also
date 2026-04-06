import { supabase } from './supabase';

export type CommentItem = {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
};

export type PostItem = {
  id: string;
  stationId: string;
  author: string;
  text: string;
  topic?: string;
  createdAt: number;
  likes: number;
  sharedFromPostId?: string;
  sharedFromStationId?: string;
  comments: CommentItem[];
};

export type NotificationItem = {
  id: string;
  type: 'reply' | 'follow' | 'like';
  toUser: string;
  fromUser: string;
  postId?: string;
  commentId?: string;
  text: string;
  createdAt: number;
  read: boolean;
};

export type IdentityMode = 'local' | 'supabase';

export type AuthIdentityState = {
  mode: IdentityMode;
  userId: string | null;
  author: string;
};

export const STATION_NAMES: Record<string, string> = {
  sen: 'SEN',
  abc774: 'ABC 774',
  triplej: 'Triple J',
  '3aw': '3AW',
};

export const DEFAULT_TEST_IDENTITIES = [
  'Peter T',
  'Peter from Windsor',
  'Peter from Windsor too',
  'Peter from Windsor too too',
  'Mick D',
  'Nina K',
  'Jayden',
  'Anna W',
];

const POSTS_KEY = 'banta_posts';
const AUTHOR_KEY = 'feedloop_author';
const FOLLOWS_KEY = 'banta_follows';
const NOTIFICATIONS_KEY = 'banta_notifications';
const TEST_IDENTITIES_KEY = 'banta_test_identities';
const SUPABASE_AUTHOR_KEY = 'banta_supabase_author';

const DEFAULT_FOLLOW_GRAPH: Record<string, string[]> = {
  'Peter T': ['Mick D', 'Nina K', 'Anna W'],
  'Peter from Windsor': ['Anna W', 'Peter T'],
  'Peter from Windsor too': ['Jayden', 'Mick D'],
  'Peter from Windsor too too': ['Peter from Windsor', 'Jayden'],
  'Mick D': ['Peter T'],
  'Nina K': ['Mick D', 'Peter T'],
  Jayden: ['Nina K'],
  'Anna W': ['Peter T'],
};

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getTestIdentities(): string[] {
  if (typeof window === 'undefined') return DEFAULT_TEST_IDENTITIES;

  const existing = safeJsonParse<string[]>(
    localStorage.getItem(TEST_IDENTITIES_KEY),
    []
  ).filter(Boolean);

  if (existing.length > 0) return existing;

  localStorage.setItem(
    TEST_IDENTITIES_KEY,
    JSON.stringify(DEFAULT_TEST_IDENTITIES)
  );
  return DEFAULT_TEST_IDENTITIES;
}

export function saveTestIdentities(names: string[]) {
  if (typeof window === 'undefined') return;

  const cleaned = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean))
  );

  localStorage.setItem(TEST_IDENTITIES_KEY, JSON.stringify(cleaned));
}

function ensureDefaultFollows() {
  if (typeof window === 'undefined') return;

  const existing = safeJsonParse<Record<string, string[]>>(
    localStorage.getItem(FOLLOWS_KEY),
    {}
  );

  let changed = false;
  const next: Record<string, string[]> = { ...existing };

  for (const [user, defaults] of Object.entries(DEFAULT_FOLLOW_GRAPH)) {
    if (!Array.isArray(next[user])) {
      next[user] = [...defaults];
      changed = true;
      continue;
    }

    const cleanedExisting = next[user]
      .map((name) => String(name).trim())
      .filter(Boolean)
      .filter((name) => name !== user);

    const deduped = Array.from(new Set(cleanedExisting));

    if (deduped.length !== next[user].length) {
      next[user] = deduped;
      changed = true;
    }
  }

  if (changed) {
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(next));
  }
}

export function ensureDefaultIdentity() {
  if (typeof window === 'undefined') return;

  getTestIdentities();
  ensureDefaultFollows();

  const current = localStorage.getItem(AUTHOR_KEY)?.trim();
  if (!current) {
    localStorage.setItem(AUTHOR_KEY, 'Peter T');
  }
}

export function getCurrentAuthor(): string {
  if (typeof window === 'undefined') return 'Peter T';

  ensureDefaultIdentity();

  const name = localStorage.getItem(AUTHOR_KEY)?.trim();
  return name || 'Peter T';
}

export function setCurrentAuthor(name: string) {
  if (typeof window === 'undefined') return;

  const trimmed = name.trim() || 'Peter T';
  localStorage.setItem(AUTHOR_KEY, trimmed);

  const identities = getTestIdentities();
  if (!identities.includes(trimmed)) {
    saveTestIdentities([trimmed, ...identities]);
  }
}

export function getSupabasePreferredAuthor(): string {
  if (typeof window === 'undefined') return 'Peter T';

  const stored = localStorage.getItem(SUPABASE_AUTHOR_KEY)?.trim();
  return stored || getCurrentAuthor();
}

export function setSupabasePreferredAuthor(name: string) {
  if (typeof window === 'undefined') return;

  const trimmed = name.trim() || 'Peter T';
  localStorage.setItem(SUPABASE_AUTHOR_KEY, trimmed);

  const identities = getTestIdentities();
  if (!identities.includes(trimmed)) {
    saveTestIdentities([trimmed, ...identities]);
  }
}

export async function getSupabaseUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) return null;
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

export async function ensureSupabaseAnonymousAuth(): Promise<string | null> {
  try {
    const existingUserId = await getSupabaseUserId();
    if (existingUserId) return existingUserId;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn(
        'Supabase anonymous sign-in failed. Falling back to local identity.',
        error.message
      );
      return null;
    }

    return data.user?.id || null;
  } catch (error) {
    console.warn(
      'Supabase anonymous sign-in failed. Falling back to local identity.',
      error
    );
    return null;
  }
}

export async function upsertSupabaseProfileDisplayName(
  displayName: string
): Promise<boolean> {
  const userId = await getSupabaseUserId();
  if (!userId) return false;

  const cleaned = displayName.trim() || 'Anonymous';

  try {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: cleaned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.warn('Failed to upsert Supabase profile display name.', error);
      return false;
    }

    localStorage.setItem(SUPABASE_AUTHOR_KEY, cleaned);

    const identities = getTestIdentities();
    if (!identities.includes(cleaned)) {
      saveTestIdentities([cleaned, ...identities]);
    }

    return true;
  } catch (error) {
    console.warn('Failed to upsert Supabase profile display name.', error);
    return false;
  }
}

export async function getSupabaseProfileDisplayName(): Promise<string | null> {
  const userId = await getSupabaseUserId();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load Supabase profile display name.', error);
      return null;
    }

    const displayName =
      typeof data?.display_name === 'string' ? data.display_name.trim() : '';

    return displayName || null;
  } catch (error) {
    console.warn('Failed to load Supabase profile display name.', error);
    return null;
  }
}

export async function syncSupabasePreferredAuthor(): Promise<string> {
  const existing = await getSupabaseProfileDisplayName();

  if (existing) {
    setSupabasePreferredAuthor(existing);
    return existing;
  }

  const fallback = getSupabasePreferredAuthor();
  await upsertSupabaseProfileDisplayName(fallback);
  return fallback;
}

export async function setBackendAwareAuthor(name: string): Promise<string> {
  const cleaned = name.trim() || 'Peter T';

  setCurrentAuthor(cleaned);
  setSupabasePreferredAuthor(cleaned);

  const userId = await getSupabaseUserId();
  if (userId) {
    await upsertSupabaseProfileDisplayName(cleaned);
  }

  return cleaned;
}

export async function getAuthIdentityState(): Promise<AuthIdentityState> {
  const userId = await getSupabaseUserId();

  if (userId) {
    const syncedAuthor = await syncSupabasePreferredAuthor();

    return {
      mode: 'supabase',
      userId,
      author: syncedAuthor,
    };
  }

  return {
    mode: 'local',
    userId: null,
    author: getCurrentAuthor(),
  };
}

export async function initialiseBackendIdentity(): Promise<AuthIdentityState> {
  const userId = await ensureSupabaseAnonymousAuth();

  if (userId) {
    const syncedAuthor = await syncSupabasePreferredAuthor();

    return {
      mode: 'supabase',
      userId,
      author: syncedAuthor,
    };
  }

  return {
    mode: 'local',
    userId: null,
    author: getCurrentAuthor(),
  };
}

/**
 * If no posts exist → seed demo data ONCE
 */
export function loadPosts(): PostItem[] {
  if (typeof window === 'undefined') return [];

  ensureDefaultIdentity();

  const raw = safeJsonParse<any[]>(localStorage.getItem(POSTS_KEY), []);

  if (raw.length > 0) {
    return raw.map(normalisePost);
  }

  const now = Date.now();

  const demoPosts: PostItem[] = [
    {
      id: 'p1',
      stationId: 'sen',
      author: 'Mick D',
      text: 'That last quarter was unreal. Best game all season.',
      topic: 'AFL Finals',
      createdAt: now - 1000 * 60 * 30,
      likes: 4,
      comments: [
        {
          id: 'c1',
          postId: 'p1',
          parentId: null,
          author: 'Nina K',
          text: 'Unreal pressure at the end 🔥',
          createdAt: now - 1000 * 60 * 25,
          likes: 2,
        },
        {
          id: 'c2',
          postId: 'p1',
          parentId: 'c1',
          author: 'Jayden',
          text: 'That tackle changed everything',
          createdAt: now - 1000 * 60 * 20,
          likes: 1,
        },
      ],
    },
    {
      id: 'p2',
      stationId: 'abc774',
      author: 'Anna W',
      text: 'Cost of living is getting ridiculous now.',
      topic: 'Economy',
      createdAt: now - 1000 * 60 * 60,
      likes: 3,
      comments: [
        {
          id: 'c3',
          postId: 'p2',
          parentId: null,
          author: 'Peter T',
          text: 'Groceries alone are insane',
          createdAt: now - 1000 * 60 * 50,
          likes: 2,
        },
      ],
    },
    {
      id: 'p3',
      stationId: 'triplej',
      author: 'Jayden',
      text: 'New track they just played is 🔥',
      topic: 'Music',
      createdAt: now - 1000 * 60 * 10,
      likes: 5,
      comments: [],
    },
    {
      id: 'p4',
      stationId: '3aw',
      author: 'Peter from Windsor',
      text: 'Talkback is always better when callers get to the point faster.',
      topic: 'Talkback',
      createdAt: now - 1000 * 60 * 40,
      likes: 2,
      comments: [
        {
          id: 'c4',
          postId: 'p4',
          parentId: null,
          author: 'Peter from Windsor too',
          text: 'Agreed. Less wind-up, more actual opinion.',
          createdAt: now - 1000 * 60 * 34,
          likes: 1,
        },
        {
          id: 'c5',
          postId: 'p4',
          parentId: 'c4',
          author: 'Peter from Windsor too too',
          text: 'And fewer life stories before the point.',
          createdAt: now - 1000 * 60 * 31,
          likes: 1,
        },
      ],
    },
  ];

  localStorage.setItem(POSTS_KEY, JSON.stringify(demoPosts));
  ensureDefaultFollows();

  return demoPosts;
}

function normalisePost(post: any): PostItem {
  return {
    id: String(post.id),
    stationId: String(post.stationId || 'sen'),
    author: String(post.author || 'Peter T'),
    text: String(post.text || ''),
    topic: typeof post.topic === 'string' ? post.topic : '',
    createdAt: Number(post.createdAt || Date.now()),
    likes: typeof post.likes === 'number' ? post.likes : 0,
    sharedFromPostId:
      typeof post.sharedFromPostId === 'string'
        ? post.sharedFromPostId
        : undefined,
    sharedFromStationId:
      typeof post.sharedFromStationId === 'string'
        ? post.sharedFromStationId
        : undefined,
    comments: Array.isArray(post.comments)
      ? post.comments.map((comment: any) => ({
          id: String(comment.id),
          postId: String(comment.postId || post.id),
          parentId:
            comment.parentId === null || typeof comment.parentId === 'string'
              ? comment.parentId
              : null,
          author: String(comment.author || 'Peter T'),
          text: String(comment.text || ''),
          createdAt: Number(comment.createdAt || Date.now()),
          likes: typeof comment.likes === 'number' ? comment.likes : 0,
        }))
      : [],
  };
}

export async function loadSupabasePosts(): Promise<PostItem[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to load Supabase posts.', error);
      return [];
    }

    if (!Array.isArray(data)) return [];

    return data.map(
      (row: any): PostItem => ({
        id: String(row.id),
        stationId: String(row.station_id || 'sen'),
        author: String(row.author_name || 'Anonymous'),
        text: String(row.body || ''),
        topic: typeof row.topic === 'string' ? row.topic : '',
        createdAt: Number(row.created_at || Date.now()),
        likes: typeof row.likes_count === 'number' ? row.likes_count : 0,
        comments: [],
      })
    );
  } catch (error) {
    console.warn('Failed to load Supabase posts.', error);
    return [];
  }
}

export function savePosts(posts: PostItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

export function loadFollows(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};

  ensureDefaultFollows();

  return safeJsonParse<Record<string, string[]>>(
    localStorage.getItem(FOLLOWS_KEY),
    {}
  );
}

export function saveFollows(follows: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows));
}

export function isFollowing(follower: string, target: string): boolean {
  const follows = loadFollows();
  return (follows[follower] || []).includes(target);
}

export function toggleFollow(follower: string, target: string) {
  const follows = loadFollows();
  const list = new Set(
    (follows[follower] || []).filter((name) => name !== follower)
  );
  if (list.has(target)) list.delete(target);
  else list.add(target);
  follows[follower] = Array.from(list);
  saveFollows(follows);
}

export function getFollowersCount(user: string): number {
  const follows = loadFollows();
  return Object.values(follows).filter((l) => l.includes(user)).length;
}

export function getFollowingCount(user: string): number {
  const follows = loadFollows();
  return (follows[user] || []).length;
}

export function loadNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  const raw = safeJsonParse<any[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
  return raw.map((item) => ({
    id: String(item.id),
    type:
      item.type === 'follow'
        ? 'follow'
        : item.type === 'like'
        ? 'like'
        : 'reply',
    toUser: String(item.toUser || ''),
    fromUser: String(item.fromUser || 'Peter T'),
    postId: typeof item.postId === 'string' ? item.postId : undefined,
    commentId: typeof item.commentId === 'string' ? item.commentId : undefined,
    text: String(item.text || ''),
    createdAt: Number(item.createdAt || Date.now()),
    read: Boolean(item.read),
  }));
}

export function saveNotifications(items: NotificationItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
}

export function addNotification(
  item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>
) {
  if (typeof window === 'undefined') return;
  if (!item.toUser || !item.fromUser) return;
  if (item.toUser === item.fromUser) return;

  const notifications = loadNotifications();

  const duplicate = notifications.find(
    (n) =>
      n.type === item.type &&
      n.toUser === item.toUser &&
      n.fromUser === item.fromUser &&
      n.postId === item.postId &&
      n.commentId === item.commentId &&
      n.text === item.text
  );

  if (duplicate) return;

  notifications.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    read: false,
    ...item,
  });

  saveNotifications(notifications.slice(0, 200));
}

export function getNotificationsForUser(user: string): NotificationItem[] {
  return loadNotifications()
    .filter((n) => n.toUser === user)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getUnreadNotificationCount(user: string): number {
  return getNotificationsForUser(user).filter((n) => !n.read).length;
}

export function markNotificationsRead(user: string) {
  const notifications = loadNotifications();
  saveNotifications(
    notifications.map((n) => (n.toUser === user ? { ...n, read: true } : n))
  );
}

export function getCommentCount(post: PostItem): number {
  return post.comments?.length || 0;
}

export function getPostScore(post: PostItem): number {
  const ageHours = Math.max(
    1,
    (Date.now() - post.createdAt) / (1000 * 60 * 60)
  );
  return (post.likes || 0) * 3 + getCommentCount(post) * 4 + 8 / ageHours;
}

export function sortPosts(
  posts: PostItem[],
  mode: 'smart' | 'newest' | 'top'
): PostItem[] {
  const copy = [...posts];

  if (mode === 'newest') return copy.sort((a, b) => b.createdAt - a.createdAt);

  if (mode === 'top') {
    return copy.sort((a, b) => {
      const aScore = (a.likes || 0) * 3 + getCommentCount(a) * 2;
      const bScore = (b.likes || 0) * 3 + getCommentCount(b) * 2;
      return bScore !== aScore ? bScore - aScore : b.createdAt - a.createdAt;
    });
  }

  return copy.sort(
    (a, b) => getPostScore(b) - getPostScore(a) || b.createdAt - a.createdAt
  );
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function getUserStats(author: string) {
  const posts = loadPosts();
  const userPosts = posts.filter((p) => p.author === author);
  const replies = posts
    .flatMap((p) => p.comments)
    .filter((c) => c.author === author);

  return {
    posts: userPosts.length,
    replies: replies.length,
    likesReceived:
      userPosts.reduce((s, p) => s + (p.likes || 0), 0) +
      replies.reduce((s, c) => s + (c.likes || 0), 0),
    followers: getFollowersCount(author),
    following: getFollowingCount(author),
  };
}

export function buildReplyTargetUser(post: PostItem, parentId: string | null) {
  if (!parentId) return { toUser: post.author || null, parentText: post.text };
  const parent = post.comments.find((c) => c.id === parentId);
  return {
    toUser: parent?.author || null,
    parentText: parent?.text || post.text,
  };
}
