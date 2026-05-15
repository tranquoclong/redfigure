import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface AffiliatePaymentReceivedEmailProps {
  name: string;
  amount: number;
  note?: string;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://redfigure.com';

export function AffiliatePaymentReceivedEmail({
  name,
  amount,
  note,
}: AffiliatePaymentReceivedEmailProps) {
  return (
    <EmailLayout
      preview={`We received your payment: ${amount.toFixed(2).replace('.', ',')}VND`}
    >
      <Text style={heading}>Payment recorded, {name}!</Text>
      <Text style={paragraph}>
        We recorded the payment below in your affiliate statement.
      </Text>
      <Section style={highlightBox}>
        <Text style={label}>Received amount</Text>
        <Text style={amountText}>{amount.toFixed(2).replace('.', ',')}VND</Text>
        {note && (
          <>
            <Text style={label}>Note</Text>
            <Text style={paragraph}>{note}</Text>
          </>
        )}
      </Section>
      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/my-account/affiliate`}>
          View my affiliate account
        </Button>
      </Section>
      <Text style={smallText}>
        This amount was debited from your balance in the statement. If you have
        any questions or disagreements, please contact support.
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
  color: '#22c55e',
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
