import * as React from 'react';
import { Text, Section, Hr, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface QuoteItemLine {
  name: string;
  unitPrice: number;
}

interface CustomQuoteSentCustomerEmailProps {
  customerName: string;
  quoteNumber: string;
  quoteUrl: string;
  items: QuoteItemLine[];
  expiresAtFormatted: string;
}

export function CustomQuoteSentCustomerEmail({
  customerName,
  quoteNumber,
  quoteUrl,
  items,
  expiresAtFormatted,
}: CustomQuoteSentCustomerEmailProps) {
  const total = items.reduce((sum, i) => sum + i.unitPrice, 0);
  return (
    <EmailLayout preview={`Your custom quote ${quoteNumber} is ready`}>
      <Text style={heading}>Hello, {customerName}!</Text>
      <Text style={paragraph}>
        Your quote <strong>{quoteNumber}</strong> is ready. Here's a summary of
        the items we've prepared for you:
      </Text>

      <Section style={itemsBox}>
        {items.map((it, idx) => (
          <Section key={idx} style={itemRow}>
            <Text style={itemName}>{it.name}</Text>
            <Text style={itemPrice}>{formatCurrency(it.unitPrice)}VND</Text>
          </Section>
        ))}
        <Hr style={hrStyleInside} />
        <Section style={itemRow}>
          <Text style={totalLabel}>Subtotal</Text>
          <Text style={totalValue}>{formatCurrency(total)} VND</Text>
        </Section>
      </Section>

      <Text style={paragraph}>
        Click the link below to view details, select which items you want to
        accept, and finalize the purchase on our website. You can also add
        regular store products to the same order.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={quoteUrl}>
          View my quote
        </Button>
      </Section>

      <Section style={warningBox}>
        <Text style={warningText}>
          ⏰ This quote is valid until <strong>{expiresAtFormatted}</strong>.
          After this date, the prices may change.
        </Text>
      </Section>

      <Hr style={hrStyle} />
      <Text style={footnote}>
        Quote items are one-time sales and are exclusively for you. They do not
        become available in the store catalog.
      </Text>
    </EmailLayout>
  );
}

function formatCurrency(v: number): string {
  return v.toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 16px',
};
const paragraph: React.CSSProperties = {
  fontSize: '15px',
  color: '#1a1a2e',
  lineHeight: '22px',
  margin: '12px 0',
};
const itemsBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  padding: '16px',
  borderRadius: '6px',
  margin: '20px 0',
};
const itemRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
};
const itemName: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a2e',
  margin: '0',
  flex: 1,
};
const itemPrice: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a2e',
  fontWeight: 'bold',
  margin: '0',
  whiteSpace: 'nowrap' as const,
};
const totalLabel: React.CSSProperties = {
  fontSize: '14px',
  color: '#8898aa',
  fontWeight: 'bold',
  margin: '0',
  flex: 1,
};
const totalValue: React.CSSProperties = {
  fontSize: '16px',
  color: '#b829ff',
  fontWeight: 'bold',
  margin: '0',
  whiteSpace: 'nowrap' as const,
};
const hrStyle: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};
const hrStyleInside: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '10px 0',
};
const buttonSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
};
const button: React.CSSProperties = {
  backgroundColor: '#b829ff',
  color: '#ffffff',
  fontWeight: 'bold',
  padding: '14px 28px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '16px',
};
const warningBox: React.CSSProperties = {
  backgroundColor: '#fff7e6',
  borderLeft: '3px solid #f5a623',
  padding: '12px 14px',
  borderRadius: '4px',
  margin: '16px 0',
};
const warningText: React.CSSProperties = {
  fontSize: '13px',
  color: '#7a4a00',
  margin: '0',
};
const footnote: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '16px 0',
};
