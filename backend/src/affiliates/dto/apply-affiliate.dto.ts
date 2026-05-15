import { Equals, IsBoolean } from 'class-validator';

export class ApplyAffiliateDto {
  @IsBoolean()
  @Equals(true, { message: 'acceptedTerms must be true' })
  acceptedTerms!: true;
}
