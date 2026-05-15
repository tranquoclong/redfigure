import * as React from 'react';
import { Text, Section, Hr } from '@react-email/components';
import { EmailLayout } from './layout';

interface ContactEmailProps {
  name: string;
  email: string;
  message: string;
  ipAddress?: string;
  userAgent?: string;
}

export function ContactEmail({
  name,
  email,
  message,
  ipAddress,
  userAgent,
}: ContactEmailProps) {
  return (
    <EmailLayout preview={`New contact message from ${name}`}>
      <Text style={heading}>New contact message</Text>

      <Section style={metaSection}>
        <Text style={label}>From</Text>
        <Text style={value}>{name}</Text>
        <Text style={label}>Email</Text>
        <Text style={value}>
          <a href={`mailto:${email}`} style={link}>
            {email}
          </a>
        </Text>
      </Section>

      <Hr style={hrStyle} />

      <Text style={label}>Message</Text>
      <Section style={messageBox}>
        <Text style={messageText}>{message}</Text>
      </Section>

      {(ipAddress || userAgent) && (
        <>
          <Hr style={hrStyle} />
          <Section style={forensicSection}>
            <Text style={forensicLabel}>Technical information</Text>
            {ipAddress && <Text style={forensicValue}>IP: {ipAddress}</Text>}
            {userAgent && (
              <Text style={forensicValue}>User-Agent: {userAgent}</Text>
            )}
          </Section>
        </>
      )}
    </EmailLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 20px',
};

const metaSection: React.CSSProperties = {
  margin: '0 0 16px',
};

const label: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '12px 0 4px',
  fontWeight: 'bold',
};

const value: React.CSSProperties = {
  fontSize: '15px',
  color: '#1a1a2e',
  margin: '0 0 8px',
};

const link: React.CSSProperties = {
  color: '#b829ff',
  textDecoration: 'underline',
};

const messageBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderLeft: '3px solid #b829ff',
  padding: '14px 16px',
  borderRadius: '4px',
  margin: '4px 0 8px',
};

const messageText: React.CSSProperties = {
  fontSize: '15px',
  color: '#1a1a2e',
  lineHeight: '22px',
  whiteSpace: 'pre-wrap' as const,
  margin: '0',
};

const hrStyle: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '16px 0',
};

const forensicSection: React.CSSProperties = {
  margin: '8px 0 0',
};

const forensicLabel: React.CSSProperties = {
  fontSize: '11px',
  color: '#8898aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 6px',
  fontWeight: 'bold',
};

const forensicValue: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
  margin: '2px 0',
  wordBreak: 'break-all' as const,
};
