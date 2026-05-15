import * as React from 'react';
import { Text, Section, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
}

export function PasswordResetEmail({
  name,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Password reset">
      <Text style={heading}>Reset Password</Text>
      <Text style={paragraph}>
        Hello, {name}! We received a request to reset the password for your
        account.
      </Text>
      <Section style={buttonSection}>
        <Button style={button} href={resetUrl}>
          Reset My Password
        </Button>
      </Section>
      <Text style={warningText}>
        This link expires in <strong>1 hour</strong>. If you did not request
        this reset, please ignore this email.
      </Text>
      <Section style={urlSection}>
        <Text style={urlLabel}>
          Or copy and paste this link into your browser:
        </Text>
        <Text style={urlText}>{resetUrl}</Text>
      </Section>
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

const warningText: React.CSSProperties = {
  fontSize: '14px',
  color: '#8898aa',
  lineHeight: '22px',
  margin: '0 0 16px',
};

const urlSection: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
};

const urlLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0 0 4px',
};

const urlText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525f7f',
  wordBreak: 'break-all' as const,
  margin: '0',
};
