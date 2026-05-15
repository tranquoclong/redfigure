import { IsNumber, Max, Min } from 'class-validator';

export class UpdateCommissionRuleDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;
}
