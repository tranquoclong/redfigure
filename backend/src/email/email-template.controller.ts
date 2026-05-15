import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailTemplateService } from './email-template.service';
import { EmailService } from './email.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  UpdateEmailTemplateDto,
  SendTestEmailDto,
} from './dto/email-template.dto';

@Controller('api/v1/email-templates')
export class EmailTemplateController {
  constructor(
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: EmailService,
  ) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return { data: await this.emailTemplateService.findAll() };
  }

  @Roles('ADMIN')
  @Get(':id')
  async findById(@Param('id') id: string) {
    return { data: await this.emailTemplateService.findByType(id) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateEmailTemplateDto) {
    return { data: await this.emailTemplateService.update(id, body) };
  }

  @Roles('ADMIN')
  @Post(':id/test')

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async sendTest(@Param('id') id: string, @Body() body: SendTestEmailDto) {

    const template = await this.emailTemplateService.findByType(id);
    const subject = body.subject ?? template.subject;
    const htmlBody = body.htmlBody ?? template.htmlBody;

    const sampleData = this.emailTemplateService.getSampleData(template.type);
    const rendered = this.emailTemplateService.renderTemplate(
      { subject, htmlBody },
      sampleData,
    );

    await this.emailService.sendMail({
      to: body.email,
      subject: `[TESTE] ${rendered.subject}`,
      html: rendered.html,
    });

    return { data: { success: true, sentTo: body.email } };
  }
}
