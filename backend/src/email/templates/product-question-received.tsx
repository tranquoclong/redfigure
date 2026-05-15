import * as React from 'react';
import { Text, Section, Hr, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface ProductQuestionReceivedEmailProps {
  productName: string;
  productAdminUrl: string;
  askerName: string;
  askerEmail: string;
  question: string;
  ipAddress?: string;
}

export function ProductQuestionReceivedEmail({
  productName,
  productAdminUrl,
  askerName,
  askerEmail,
  question,
  ipAddress,
}: ProductQuestionReceivedEmailProps) {
  return (
    <EmailLayout preview={`New product question about ${productName}`}>
      <Text style={heading}>New product question</Text>

      <Section style={metaSection}>
        <Text style={label}>Product</Text>
        <Text style={value}>{productName}</Text>
        <Text style={label}>From</Text>
        <Text style={value}>
          {askerName} ({askerEmail})
        </Text>
      </Section>

      <Hr style={hrStyle} />

      <Text style={label}>Question</Text>
      <Section style={messageBox}>
        <Text style={messageText}>{question}</Text>
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={productAdminUrl}>
          Respond in admin
        </Button>
      </Section>

      {ipAddress && (
        <>
          <Hr style={hrStyle} />
          <Section>
            <Text style={forensicLabel}>Forensic</Text>
            <Text style={forensicValue}>IP: {ipAddress}</Text>
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
const metaSection: React.CSSProperties = { margin: '0 0 16px' };
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
const messageBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderLeft: '3px solid #b829ff',
  padding: '14px 16px',
  borderRadius: '4px',
  margin: '4px 0 16px',
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
const buttonSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
};
const button: React.CSSProperties = {
  backgroundColor: '#b829ff',
  color: '#ffffff',
  fontWeight: 'bold',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '15px',
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
};
