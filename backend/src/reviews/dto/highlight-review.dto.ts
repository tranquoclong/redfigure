import { IsBoolean } from 'class-validator';

export class HighlightReviewDto {
  @IsBoolean()
  isHighlighted!: boolean;
}
