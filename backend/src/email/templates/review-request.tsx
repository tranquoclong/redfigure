import * as React from 'react';
import { Text, Section, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface ReviewRequestEmailProps {
  customerName: string;
  reviewUrl: string;
  discountPercent: number;
  discountLabel?: string;
  couponValidityDays: number;
}

export function ReviewRequestEmail({
  customerName,
  reviewUrl,
  discountPercent,
  discountLabel,
  couponValidityDays,
}: ReviewRequestEmailProps) {
  const rewardLabel = discountLabel ?? `${discountPercent}%`;
  return (
    <EmailLayout
      preview={`Đánh giá đơn hàng và nhận mã giảm giá ${rewardLabel}`}
    >
      <Text style={heading}>Đánh giá trải nghiệm của bạn?</Text>
      <Text style={paragraph}>
        Chào {customerName}! Đơn hàng của bạn đã đến. Hãy cho chúng tôi biết suy
        nghĩ của bạn — ý kiến của bạn giúp đỡ những khách hàng khác và chúng tôi
        cải thiện bản thân hơn và hơn nữa.
      </Text>
      <Text style={paragraph}>
        Khi gửi đánh giá trên trang dưới đây, bạn sẽ nhận được một mã giảm giá{' '}
        <strong>{rewardLabel}</strong> cho lần mua tiếp theo, có giá trị trong{' '}
        <strong>{couponValidityDays} ngày</strong>.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={reviewUrl}>
          Đánh giá đơn hàng
        </Button>
      </Section>

      <Text style={finePrint}>
        Mã giảm giá chỉ dành riêng cho bạn và chỉ được tạo sau khi bạn gửi đánh
        giá qua liên kết này. Việc này sẽ mất khoảng 2 phút.
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
  margin: '28px 0',
};

const button: React.CSSProperties = {
  backgroundColor: '#e0a526',
  color: '#1a1a2e',
  fontWeight: 'bold',
  padding: '14px 28px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '16px',
};

const finePrint: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  lineHeight: '18px',
  margin: '20px 0 0',
};
