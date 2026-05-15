import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MatchedAttribute {
  attributeValueId: string;
  attributeName: string;
  value: string;
  confidence: 'exact' | 'fuzzy';
  aiOriginal?: string;
}

export interface UnmatchedAttribute {
  attributeName: string;
  value: string;
  confidence: 'new';
}

export interface MatchResult {
  matched: MatchedAttribute[];
  unmatched: UnmatchedAttribute[];
}

export function normalizeValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/oes$/i, 'ao')
    .replace(/aes$/i, 'ao')
    .replace(/eis$/i, 'el')
    .replace(/(?<=[a-z])s$/i, '');
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

@Injectable()
export class AttributeMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async matchAttributes(
    aiAttributes: Record<string, string[]>,
  ): Promise<MatchResult> {
    const matched: MatchedAttribute[] = [];
    const unmatched: UnmatchedAttribute[] = [];

    const dbAttributes = await this.prisma.attribute.findMany({
      where: { deletedAt: null },
      include: { values: { where: { deletedAt: null } } },
    });

    for (const [aiAttrName, aiValues] of Object.entries(aiAttributes)) {

      const normalizedAttrName = normalizeValue(aiAttrName);
      const dbAttr = dbAttributes.find(
        (a) =>
          a.name === aiAttrName ||
          a.slug === normalizedAttrName ||
          normalizeValue(a.name) === normalizedAttrName,
      );

      if (!dbAttr) continue;

      for (const aiValue of aiValues) {
        const normalizedAi = normalizeValue(aiValue);

        const exactMatch = dbAttr.values.find(
          (v) => normalizeValue(v.value) === normalizedAi,
        );
        if (exactMatch) {
          matched.push({
            attributeValueId: exactMatch.id,
            attributeName: dbAttr.name,
            value: exactMatch.value,
            confidence: 'exact',
          });
          continue;
        }

        let bestFuzzy: {
          value: (typeof dbAttr.values)[0];
          distance: number;
        } | null = null;
        for (const dbVal of dbAttr.values) {
          const normalizedDb = normalizeValue(dbVal.value);
          const distance = levenshteinDistance(normalizedAi, normalizedDb);
          const threshold = normalizedDb.length >= 6 ? 2 : 1;
          if (distance <= threshold && distance > 0) {
            if (!bestFuzzy || distance < bestFuzzy.distance) {
              bestFuzzy = { value: dbVal, distance };
            }
          }
        }
        if (bestFuzzy) {
          matched.push({
            attributeValueId: bestFuzzy.value.id,
            attributeName: dbAttr.name,
            value: bestFuzzy.value.value,
            confidence: 'fuzzy',
            aiOriginal: aiValue,
          });
          continue;
        }

        const containsMatch = dbAttr.values.find((v) => {
          const normalizedDb = normalizeValue(v.value);
          return (
            normalizedAi.includes(normalizedDb) ||
            normalizedDb.includes(normalizedAi)
          );
        });
        if (containsMatch) {
          matched.push({
            attributeValueId: containsMatch.id,
            attributeName: dbAttr.name,
            value: containsMatch.value,
            confidence: 'fuzzy',
            aiOriginal: aiValue,
          });
          continue;
        }

        unmatched.push({
          attributeName: dbAttr.name,
          value: aiValue,
          confidence: 'new',
        });
      }
    }

    return { matched, unmatched };
  }
}
