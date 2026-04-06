export type TopicPostLike = {
  id: string;
  stationId: string;
  context?: string;
  createdAt: number;
};

export type TopicGroup<T extends TopicPostLike = TopicPostLike> = {
  key: string;
  primaryLabel: string;
  normalizedPrimaryLabel: string;
  variants: string[];
  posts: T[];
  postCount: number;
  latestCreatedAt: number;
  tokens: string[];
};

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'at',
  'by',
  'with',
  'from',
  'after',
  'before',
  'about',
  'over',
  'under',
  'into',
  'out',
  'up',
  'down',
  'off',
  'is',
  'was',
  'are',
  'were',
  'be',
  'been',
  'being',
  'it',
  'this',
  'that',
  'these',
  'those',
  'as',
  'but',
  'if',
  'than',
  'then',
  'story',
  'issue',
  'reaction',
  'take',
  'moment',
]);

export function normalizeTopic(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMeaningfulWords(value: string): string[] {
  const normalized = normalizeTopic(value);
  if (!normalized) return [];

  return normalized
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

export function topicsMatch(a: string, b: string): boolean {
  const normalizedA = normalizeTopic(a);
  const normalizedB = normalizeTopic(b);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return true;
  }

  const wordsA = getMeaningfulWords(normalizedA);
  const wordsB = getMeaningfulWords(normalizedB);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let overlap = 0;
  for (const word of Array.from(setA)) {
    if (setB.has(word)) overlap += 1;
  }

  if (overlap === 0) return false;

  const minSize = Math.min(setA.size, setB.size);

  if (minSize === 1) {
    return overlap === 1;
  }

  if (minSize === 2) {
    return overlap >= 2;
  }

  return overlap >= 2;
}

function getTopicLabelScore(label: string, posts: TopicPostLike[]) {
  const normalized = normalizeTopic(label);
  const exactMatches = posts.filter(
    (post) => normalizeTopic(post.context ?? '') === normalized
  ).length;
  const latestCreatedAt = Math.max(...posts.map((post) => post.createdAt));
  const lengthPenalty = label.length;

  return {
    exactMatches,
    latestCreatedAt,
    lengthPenalty,
  };
}

function choosePrimaryLabel<T extends TopicPostLike>(posts: T[]): string {
  const labels = Array.from(
    new Set(
      posts
        .map((post) => (post.context ?? '').trim())
        .filter((value) => value.length > 0)
    )
  );

  if (labels.length === 0) return '';

  return [...labels].sort((a, b) => {
    const scoreA = getTopicLabelScore(a, posts);
    const scoreB = getTopicLabelScore(b, posts);

    if (scoreB.exactMatches !== scoreA.exactMatches) {
      return scoreB.exactMatches - scoreA.exactMatches;
    }

    if (scoreB.latestCreatedAt !== scoreA.latestCreatedAt) {
      return scoreB.latestCreatedAt - scoreA.latestCreatedAt;
    }

    if (scoreA.lengthPenalty !== scoreB.lengthPenalty) {
      return scoreA.lengthPenalty - scoreB.lengthPenalty;
    }

    return a.localeCompare(b);
  })[0];
}

export function buildTopicGroups<T extends TopicPostLike>(
  posts: T[],
  options?: {
    stationId?: string;
  }
): TopicGroup<T>[] {
  const filtered = posts
    .filter((post) => {
      if (options?.stationId && post.stationId !== options.stationId) {
        return false;
      }

      return (post.context ?? '').trim().length > 0;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const groups: Array<{
    posts: T[];
  }> = [];

  for (const post of filtered) {
    const topic = (post.context ?? '').trim();
    if (!topic) continue;

    const existingGroup = groups.find((group) =>
      group.posts.some((groupPost) =>
        topicsMatch(groupPost.context ?? '', topic)
      )
    );

    if (existingGroup) {
      existingGroup.posts.push(post);
    } else {
      groups.push({ posts: [post] });
    }
  }

  return groups
    .map((group, index) => {
      const primaryLabel = choosePrimaryLabel(group.posts);
      const variants = Array.from(
        new Set(
          group.posts
            .map((post) => (post.context ?? '').trim())
            .filter((value) => value.length > 0)
        )
      ).sort((a, b) => {
        const exactA = group.posts.filter(
          (post) => normalizeTopic(post.context ?? '') === normalizeTopic(a)
        ).length;
        const exactB = group.posts.filter(
          (post) => normalizeTopic(post.context ?? '') === normalizeTopic(b)
        ).length;

        if (exactB !== exactA) return exactB - exactA;
        return a.localeCompare(b);
      });

      const latestCreatedAt = Math.max(
        ...group.posts.map((post) => post.createdAt)
      );

      return {
        key: `${normalizeTopic(primaryLabel)}-${index}`,
        primaryLabel,
        normalizedPrimaryLabel: normalizeTopic(primaryLabel),
        variants,
        posts: [...group.posts].sort((a, b) => b.createdAt - a.createdAt),
        postCount: group.posts.length,
        latestCreatedAt,
        tokens: getMeaningfulWords(primaryLabel),
      };
    })
    .sort((a, b) => {
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return b.latestCreatedAt - a.latestCreatedAt;
    });
}

export function findTopicGroupByTopic<T extends TopicPostLike>(
  posts: T[],
  topic: string,
  options?: {
    stationId?: string;
  }
): TopicGroup<T> | null {
  const groups = buildTopicGroups(posts, options);

  const direct = groups.find(
    (group) =>
      topicsMatch(group.primaryLabel, topic) ||
      group.variants.some((variant) => topicsMatch(variant, topic))
  );

  return direct ?? null;
}

export function getCanonicalTopicLabel<T extends TopicPostLike>(
  posts: T[],
  topic: string,
  options?: {
    stationId?: string;
  }
): string {
  const group = findTopicGroupByTopic(posts, topic, options);
  return group?.primaryLabel ?? topic.trim();
}

export function getRecentTopicsForStation<T extends TopicPostLike>(
  posts: T[],
  stationId: string,
  limit: number = 5
): string[] {
  return buildTopicGroups(posts, { stationId })
    .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt)
    .slice(0, limit)
    .map((group) => group.primaryLabel);
}

export function getRelatedTopics<T extends TopicPostLike>(
  posts: T[],
  topic: string,
  limit: number = 5
): string[] {
  const currentGroup = findTopicGroupByTopic(posts, topic);
  if (!currentGroup) return [];

  const groups = buildTopicGroups(posts);

  return groups
    .filter(
      (group) => !topicsMatch(group.primaryLabel, currentGroup.primaryLabel)
    )
    .map((group) => {
      const sharedWords = group.tokens.filter((token) =>
        currentGroup.tokens.includes(token)
      ).length;

      return {
        label: group.primaryLabel,
        sharedWords,
        postCount: group.postCount,
        latestCreatedAt: group.latestCreatedAt,
      };
    })
    .filter((item) => item.sharedWords > 0)
    .sort((a, b) => {
      if (b.sharedWords !== a.sharedWords) return b.sharedWords - a.sharedWords;
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return b.latestCreatedAt - a.latestCreatedAt;
    })
    .slice(0, limit)
    .map((item) => item.label);
}
