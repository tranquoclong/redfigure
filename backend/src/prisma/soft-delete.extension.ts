import { Prisma } from '@prisma/client';

export const SOFT_DELETE_MODELS = [
  'attribute',
  'attributeValue',
  'productVariation',
] as const;

type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

const SOFT_DELETE_MODELS_PASCAL = new Set<string>(
  SOFT_DELETE_MODELS.map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
);

type RelationInfo = {
  field: string;
  target: string;
  isSoftDelete: boolean;
  isList: boolean;
};

function buildRelationMaps(): {
  all: Map<string, RelationInfo[]>;
  softOnly: Map<string, Array<{ field: string; target: SoftDeleteModel }>>;
} {
  const all = new Map<string, RelationInfo[]>();
  const softOnly = new Map<
    string,
    Array<{ field: string; target: SoftDeleteModel }>
  >();

  const dmmf = (
    Prisma as unknown as { dmmf?: { datamodel: { models: any[] } } }
  ).dmmf;
  if (!dmmf?.datamodel?.models) return { all, softOnly };

  for (const model of dmmf.datamodel.models) {
    const allRelations: RelationInfo[] = [];
    const softRelations: Array<{ field: string; target: SoftDeleteModel }> = [];
    for (const field of model.fields) {
      if (field.kind !== 'object') continue;
      const targetPascal = field.type;
      const targetCamel =
        targetPascal.charAt(0).toLowerCase() + targetPascal.slice(1);
      const isSD = SOFT_DELETE_MODELS.includes(targetCamel as SoftDeleteModel);
      allRelations.push({
        field: field.name,
        target: targetPascal,
        isSoftDelete: isSD,
        isList: field.isList === true,
      });

      if (isSD && field.isList === true) {
        softRelations.push({
          field: field.name,
          target: targetCamel as SoftDeleteModel,
        });
      }
    }
    if (allRelations.length > 0) all.set(model.name, allRelations);
    if (softRelations.length > 0) softOnly.set(model.name, softRelations);
  }
  return { all, softOnly };
}

const { all: ALL_RELATIONS, softOnly: RELATION_MAP } = buildRelationMaps();

function injectSoftDeleteFilter<T extends { where?: Record<string, unknown> }>(
  args: T,
): T {
  const where = (args.where ?? {}) as Record<string, unknown>;

  if (where.deletedAt !== undefined) return args;
  return {
    ...args,
    where: { ...where, deletedAt: null },
  } as T;
}

const MAX_RECURSION_DEPTH = 10;

export class SoftDeleteRecursionLimitError extends Error {
  constructor(modelName: string, depth: number) {
    super(
      `Query depth ${depth} exceeded the maximum (${MAX_RECURSION_DEPTH}) in ${modelName}. ` +
      `Possible ReDoS / event-loop blocker. Reduce nested include/select.`,
    );
    this.name = 'SoftDeleteRecursionLimitError';
  }
}

function injectNestedSoftDeleteFilter<T extends Record<string, unknown>>(
  args: T,
  modelName: string,
  depth = 0,
): T {
  if (depth >= MAX_RECURSION_DEPTH) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[softDeleteExtension] recursion depth ${depth} >= ${MAX_RECURSION_DEPTH} ` +
        `in ${modelName} - aborting query (fail-closed)`,
      );
    }

    throw new SoftDeleteRecursionLimitError(modelName, depth);
  }

  const includeOrSelect =
    (args.include as Record<string, unknown> | undefined) ??
    (args.select as Record<string, unknown> | undefined);
  if (!includeOrSelect) return args;

  const allRelations = ALL_RELATIONS.get(modelName);
  if (!allRelations || allRelations.length === 0) return args;

  const cloned = { ...args };
  const isInclude = 'include' in args && args.include !== undefined;
  const cloneKey = isInclude ? 'include' : 'select';
  const clonedIncludeOrSelect: Record<string, unknown> = {
    ...(includeOrSelect as Record<string, unknown>),
  };
  (cloned as Record<string, unknown>)[cloneKey] = clonedIncludeOrSelect;

  for (const { field, target, isSoftDelete, isList } of allRelations) {
    const sub = clonedIncludeOrSelect[field];
    if (sub === undefined || sub === false) continue;

    if (sub === true) {

      if (isSoftDelete && isList) {
        clonedIncludeOrSelect[field] = { where: { deletedAt: null } };
      }
      continue;
    }

    if (typeof sub !== 'object' || sub === null) continue;

    let injected: Record<string, unknown> = sub as Record<string, unknown>;
    if (isSoftDelete && isList) {
      injected = injectSoftDeleteFilter(
        injected as { where?: Record<string, unknown> },
      );
    }

    injected = injectNestedSoftDeleteFilter(injected, target, depth + 1);
    clonedIncludeOrSelect[field] = injected;
  }

  return cloned;
}

function injectNestedOnly<T extends Record<string, unknown>>(
  args: T,
  modelName: string,
): T {
  return injectNestedSoftDeleteFilter(args, modelName);
}

export const softDeleteExtension = Prisma.defineExtension((client) => {
  const queryOverrides: Record<string, Record<string, unknown>> = {};

  for (const model of SOFT_DELETE_MODELS) {
    const pascal = model.charAt(0).toUpperCase() + model.slice(1);
    queryOverrides[model] = {

      async findUnique({ args }: { args: any }) {
        const injected = injectNestedSoftDeleteFilter(
          injectSoftDeleteFilter(args),
          pascal,
        );
        return (client as any)[model].findFirst(injected);
      },
      async findUniqueOrThrow({ args }: { args: any }) {
        const injected = injectNestedSoftDeleteFilter(
          injectSoftDeleteFilter(args),
          pascal,
        );
        return (client as any)[model].findFirstOrThrow(injected);
      },
      async findFirst({ args, query }: { args: any; query: any }) {
        return query(
          injectNestedSoftDeleteFilter(injectSoftDeleteFilter(args), pascal),
        );
      },
      async findFirstOrThrow({ args, query }: { args: any; query: any }) {
        return query(
          injectNestedSoftDeleteFilter(injectSoftDeleteFilter(args), pascal),
        );
      },
      async findMany({ args, query }: { args: any; query: any }) {
        return query(
          injectNestedSoftDeleteFilter(injectSoftDeleteFilter(args), pascal),
        );
      },
      async count({ args, query }: { args: any; query: any }) {
        return query(injectSoftDeleteFilter(args));
      },
      async aggregate({ args, query }: { args: any; query: any }) {
        return query(injectSoftDeleteFilter(args));
      },
    };
  }

  queryOverrides['$allModels'] = {
    async findUnique(this: any, { model, args, query }: any) {
      if (SOFT_DELETE_MODELS_PASCAL.has(model)) return query(args);
      return query(injectNestedOnly(args, model));
    },
    async findUniqueOrThrow(this: any, { model, args, query }: any) {
      if (SOFT_DELETE_MODELS_PASCAL.has(model)) return query(args);
      return query(injectNestedOnly(args, model));
    },
    async findFirst(this: any, { model, args, query }: any) {
      if (SOFT_DELETE_MODELS_PASCAL.has(model)) return query(args);
      return query(injectNestedOnly(args, model));
    },
    async findFirstOrThrow(this: any, { model, args, query }: any) {
      if (SOFT_DELETE_MODELS_PASCAL.has(model)) return query(args);
      return query(injectNestedOnly(args, model));
    },
    async findMany(this: any, { model, args, query }: any) {
      if (SOFT_DELETE_MODELS_PASCAL.has(model)) return query(args);
      return query(injectNestedOnly(args, model));
    },
  };

  return client.$extends({
    name: 'softDelete',
    query: queryOverrides as never,
  });
});

export const __testing = {
  injectSoftDeleteFilter,
  injectNestedSoftDeleteFilter,
  RELATION_MAP,
};
