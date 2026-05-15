import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface LoginCodeEmailProps {
  name: string;
  code: string;
  purpose: 'LOGIN' | 'CLAIM';
}

export function LoginCodeEmail({ name, code, purpose }: LoginCodeEmailProps) {
  const isLogin = purpose === 'LOGIN';
  const heading = isLogin
    ? 'Your login code'
    : 'Activate your RedFigure account';
  const intro = isLogin
    ? `Hello, ${name}! Use the code below to access your account — no password needed.`
    : `Hello, ${name}! Use the code below to activate your account and view your orders.`;

  return (
    <EmailLayout
      preview={isLogin ? 'Your login code' : 'Activate your account'}
    >
      <Text style={headingStyle}>{heading}</Text>
      <Text style={paragraph}>{intro}</Text>

      <Section style={codeSection}>
        <Text style={codeText}>{code}</Text>
      </Section>

      <Text style={warningText}>
        This code expires in <strong>10 minutes</strong> and is valid for a
        single use.
      </Text>

      <Section style={alertSection}>
        <Text style={alertTitle}>Warning</Text>
        <Text style={alertText}>
          RedFigure <strong>never</strong> asks for this code by phone, Zalo, or
          any other channel. If someone asks for it, do not share it — it's a
          scam. If you didn't request it, ignore this email; your account is
          secure.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const headingStyle: React.CSSProperties = {
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

const codeSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '32px 0',
  padding: '24px',
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  borderLeft: '4px solid #e0a526',
};

const codeText: React.CSSProperties = {
  fontSize: '40px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  color: '#1a1a2e',
  margin: '0',
  fontFamily: 'monospace',
};

const warningText: React.CSSProperties = {
  fontSize: '14px',
  color: '#8898aa',
  lineHeight: '22px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
};

const alertSection: React.CSSProperties = {
  backgroundColor: '#fff3cd',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0 0',
  borderLeft: '4px solid #ffc107',
};

const alertTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#856404',
  margin: '0 0 4px',
};

const alertText: React.CSSProperties = {
  fontSize: '13px',
  color: '#856404',
  lineHeight: '20px',
  margin: '0',
};
