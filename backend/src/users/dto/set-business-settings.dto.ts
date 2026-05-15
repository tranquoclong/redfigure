import { IsBoolean } from 'class-validator';

export class SetBusinessSettingsDto {
  @IsBoolean()
  enabled!: boolean;
}
