import * as React from 'react';
import { Text, Section, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface ReviewReminderEmailProps {
  customerName: string;
  reviewUrl: string;
  discountPercent: number;
  discountLabel?: string;
  couponValidityDays: number;
}

export function ReviewReminderEmail({
  customerName,
  reviewUrl,
  discountPercent,
  discountLabel,
  couponValidityDays,
}: ReviewReminderEmailProps) {
  const rewardLabel = discountLabel ?? `${discountPercent}%`;
  return (
    <EmailLayout preview={`Reminder: ${rewardLabel} discount awaits you`}>
      <Text style={heading}>There's still time to get your coupon!</Text>
      <Text style={paragraph}>
        Hi, {customerName}! We saw that you haven't submitted your review yet.
        It only takes 2 minutes and the coupon will arrive in your email
        immediately.
      </Text>
      <Text style={paragraph}>
        Remember: you get <strong>{rewardLabel}</strong> discount to use in the
        next <strong>{couponValidityDays} days</strong>.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={reviewUrl}>
          Submit review
        </Button>
      </Section>

      <Text style={finePrint}>
        If you've already submitted your review, you can ignore this email. The
        coupon will arrive by email as soon as the review is registered.
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
