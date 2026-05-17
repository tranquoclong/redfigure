import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface NewsletterConfirmEmailProps {
  confirmUrl: string;
}

export function NewsletterConfirmEmail({
  confirmUrl,
}: NewsletterConfirmEmailProps) {
  return (
    <EmailLayout preview="Xác nhận đăng ký nhận bản tin RedFigure.">
      <Text style={heading}>Xác nhận đăng ký nhận bản tin</Text>
      <Text style={paragraph}>
        Đã nhận được yêu cầu đăng ký nhận bản tin RedFigure từ email của bạn. Để
        bắt đầu nhận thông tin về các sản phẩm mới, chương trình khuyến mãi độc
        quyền và các đợt phát hành từ các studio yêu thích của bạn, vui lòng xác
        nhận bằng cách nhấp vào nút dưới đây:
      </Text>
      <Section style={buttonSection}>
        <Button style={button} href={confirmUrl}>
          Xác nhận đăng ký
        </Button>
      </Section>
      <Text style={paragraph}>
        Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này — sẽ không
        có gì được gửi nếu không có xác nhận từ bạn.
      </Text>
      <Text style={fineprint}>
        Link này sẽ hết hạn sau 7 ngày. Nếu quá hạn, bạn có thể đăng ký lại
        email của mình.
      </Text>
    </EmailLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 16px',
};

const paragraph: React.CSSProperties = {
  fontSize: '16px',
  color: '#525f7f',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const buttonSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button: React.CSSProperties = {
  backgroundColor: '#e0a526',
  color: '#1a1a2e',
  fontWeight: 'bold',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '16px',
};

const fineprint: React.CSSProperties = {
  fontSize: '13px',
  color: '#8898aa',
  lineHeight: '20px',
  margin: '24px 0 0',
};
