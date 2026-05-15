import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeCaption } from '../common/utils/sanitize-caption';

export interface IncomingPreset {
  id?: string;
  name: string;
  text: string;
}

@Injectable()
export class MediaCaptionPresetService {
  constructor(private readonly prisma: PrismaService) { }

  async list() {
    return this.prisma.mediaCaptionPreset.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        text: true,
        order: true,
      },
    });
  }

  async syncFromArray(incoming: IncomingPreset[]) {

    const seen = new Set<string>();
    const clean: IncomingPreset[] = [];
    for (const item of incoming) {
      const name = (item?.name ?? '').trim();
      const text = sanitizeCaption(item?.text ?? '');
      if (!name || !text || seen.has(name)) continue;
      seen.add(name);
      clean.push({ id: item?.id, name, text });
    }

    if (clean.length === 0) {
      throw new BadRequestException(
        'At least 1 preset is required. To remove multiple, edit the list.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.mediaCaptionPreset.findMany({
          select: { id: true },
        });
        const existingIds = new Set(existing.map((e) => e.id));
        const incomingIds = new Set(
          clean.map((i) => i.id).filter((id): id is string => !!id),
        );

        const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
        if (toDelete.length > 0) {
          await tx.mediaCaptionPreset.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        const results = [];
        for (let idx = 0; idx < clean.length; idx++) {
          const p = clean[idx];
          if (p.id && existingIds.has(p.id)) {
            const updated = await tx.mediaCaptionPreset.update({
              where: { id: p.id },
              data: { name: p.name, text: p.text, order: idx },
            });
            results.push(updated);
          } else {
            const created = await tx.mediaCaptionPreset.create({
              data: { name: p.name, text: p.text, order: idx },
            });
            results.push(created);
          }
        }

        return results.map((r) => ({
          id: r.id,
          name: r.name,
          text: r.text,
          order: r.order,
        }));
      });
    } catch (err) {

      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Duplicate preset name — each preset needs a unique name.',
        );
      }
      throw err;
    }
  }
}
