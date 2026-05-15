import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnswerProductQuestionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  answer!: string;
}
