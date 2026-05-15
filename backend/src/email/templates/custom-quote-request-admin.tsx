import * as React from 'react';
import { Text, Section, Hr, Button, Link } from '@react-email/components';
import { EmailLayout } from './layout';

interface CustomQuoteRequestAdminEmailProps {
  quoteNumber: string;
  quoteAdminUrl: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  description: string;
  externalLinks: string[];
}

export function CustomQuoteRequestAdminEmail({
  quoteNumber,
  quoteAdminUrl,
  customerName,
  customerEmail,
  customerPhone,
  description,
  externalLinks,
}: CustomQuoteRequestAdminEmailProps) {
  return (
    <EmailLayout preview={`New custom quote request ${quoteNumber}`}>
      <Text style={heading}>New custom quote request</Text>

      <Section style={metaSection}>
        <Text style={label}>Order number</Text>
        <Text style={value}>{quoteNumber}</Text>
        <Text style={label}>Client</Text>
        <Text style={value}>
          {customerName} ({customerEmail})
        </Text>
        {customerPhone && (
          <>
            <Text style={label}>Phone number</Text>
            <Text style={value}>{customerPhone}</Text>
          </>
        )}
      </Section>

      <Hr style={hrStyle} />

      <Text style={label}>Description</Text>
      <Section style={messageBox}>
        <Text style={messageText}>{description}</Text>
      </Section>

      {externalLinks.length > 0 && (
        <>
          <Text style={label}>External links</Text>
          <Section style={linksBox}>
            {externalLinks.map((url) => (
              <Text key={url} style={linkItem}>
                <Link href={url} style={linkStyle}>
                  {url}
                </Link>
              </Text>
            ))}
          </Section>
        </>
      )}

      <Section style={buttonSection}>
        <Button style={button} href={quoteAdminUrl}>
          View order
        </Button>
      </Section>
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
const linksBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  padding: '10px 14px',
  borderRadius: '4px',
  margin: '4px 0 16px',
};
const linkItem: React.CSSProperties = {
  fontSize: '13px',
  margin: '4px 0',
  wordBreak: 'break-all' as const,
};
const linkStyle: React.CSSProperties = {
  color: '#b829ff',
  textDecoration: 'underline',
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
