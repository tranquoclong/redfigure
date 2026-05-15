import { IsBoolean } from 'class-validator';

export class ToggleCacheDto {
  @IsBoolean()
  disabled!: boolean;
}
