import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface AffiliateWelcomeEmailProps {
  name: string;
  publicId: number;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://redfigure.com';

export function AffiliateWelcomeEmail({
  name,
  publicId,
}: AffiliateWelcomeEmailProps) {
  const referralLink = `${STORE_URL}/?ref=${publicId}`;

  return (
    <EmailLayout preview={`You're in RedFigure's affiliate program, ${name}!`}>
      <Text style={heading}>Welcome to the affiliate program, {name}!</Text>
      <Text style={paragraph}>
        Your affiliate account has been successfully created. Your unique
        tracking code is <strong>#{publicId}</strong>. Share the link below and
        earn commission on the sales you bring.
      </Text>
      <Section style={linkBox}>
        <Text style={linkText}>{referralLink}</Text>
      </Section>
      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/my-account/affiliate`}>
          View my affiliate account
        </Button>
      </Section>
      <Text style={paragraph}>
        You can track visits, conversions, commissions, and request payments
        (starting from 100.000VND) in your panel. The standard commission is 5%
        of the value of the items sold, adjustable by product/tag/category.
      </Text>
      <Text style={smallText}>
        Read the <a href={`${STORE_URL}/terms-affiliate`}>program terms</a> to
        understand the complete payment rules.
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

const smallText: React.CSSProperties = {
  fontSize: '13px',
  color: '#8898aa',
  lineHeight: '20px',
  margin: '24px 0 0',
};

const linkBox: React.CSSProperties = {
  background: '#f6f9fc',
  border: '1px solid #e1e8ef',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
};

const linkText: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#1a1a2e',
  margin: 0,
  wordBreak: 'break-all' as const,
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
