import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface AffiliatePaymentRequestAdminEmailProps {
  affiliatePublicId: number;
  affiliateName: string;
  amount: number;
  requestId: string;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://redfigure.com';

export function AffiliatePaymentRequestAdminEmail({
  affiliatePublicId,
  affiliateName,
  amount,
  requestId,
}: AffiliatePaymentRequestAdminEmailProps) {
  return (
    <EmailLayout
      preview={`New payment request: affiliate #${affiliatePublicId}`}
    >
      <Text style={heading}>New payment request</Text>
      <Text style={paragraph}>
        The affiliate{' '}
        <strong>
          #{affiliatePublicId} — {affiliateName}
        </strong>{' '}
        is requesting payment.
      </Text>
      <Section style={highlightBox}>
        <Text style={label}>Amount requested</Text>
        <Text style={amountText}>
          {amount.toFixed(2).replace('.', ',')} VND
        </Text>
        <Text style={label}>Request ID</Text>
        <Text style={mono}>{requestId}</Text>
      </Section>
      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/admin/affiliate/payments`}>
          Process payment in admin panel
        </Button>
      </Section>
      <Text style={smallText}>
        You can record the full or partial payment in the panel. The affiliate's
        balance will be automatically debited from the statement.
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
const label: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  color: '#8898aa',
  letterSpacing: '0.5px',
  margin: '8px 0 2px',
};
const amountText: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#e0a526',
  margin: '0 0 12px',
};
const mono: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '13px',
  color: '#1a1a2e',
  margin: '0 0 12px',
};
const highlightBox: React.CSSProperties = {
  background: '#f6f9fc',
  border: '1px solid #e1e8ef',
  borderRadius: '6px',
  padding: '16px',
  margin: '16px 0',
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
