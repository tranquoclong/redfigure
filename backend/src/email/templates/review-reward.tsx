import * as React from 'react';
import { Text, Section, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface ReviewRewardEmailProps {
  customerName: string;
  productName: string;
  couponCode: string;
  discountPercent: number;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://redfigure.com';

export function ReviewRewardEmail({
  customerName,
  productName,
  couponCode,
  discountPercent,
}: ReviewRewardEmailProps) {
  return (
    <EmailLayout preview={`You got ${discountPercent}% discount!`}>
      <Text style={heading}>Thank you for your review!</Text>
      <Text style={paragraph}>
        Hello, {customerName}! Your review for the product{' '}
        <strong>{productName}</strong> has been approved.
      </Text>
      <Text style={paragraph}>
        As a thank you, here is a coupon for <strong>{discountPercent}%</strong>{' '}
        discount on your next purchase:
      </Text>

      <Section style={couponSection}>
        <Text style={couponCodeStyle}>{couponCode}</Text>
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/products`}>
          Use My Coupon
        </Button>
      </Section>

      <Text style={finePrint}>
        The coupon is valid for a single use and cannot be combined with other
        promotions.
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

const couponSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
  backgroundColor: '#1a1a2e',
  borderRadius: '8px',
  padding: '20px',
};

const couponCodeStyle: React.CSSProperties = {
  color: '#e0a526',
  fontSize: '28px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  letterSpacing: '2px',
  margin: '0',
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

const finePrint: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  lineHeight: '18px',
  margin: '16px 0 0',
};
