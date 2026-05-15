import { IsUUID } from 'class-validator';

export class MergeCartDto {
  @IsUUID(4)
  sessionId!: string;
}
