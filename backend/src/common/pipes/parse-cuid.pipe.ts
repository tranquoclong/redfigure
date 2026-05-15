import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {

  private readonly CUID_REGEX = /^c[a-z0-9]{20,29}$/;

  transform(value: string): string {
    if (!this.CUID_REGEX.test(value)) {
      throw new NotFoundException('Resource not found');
    }
    return value;
  }
}
