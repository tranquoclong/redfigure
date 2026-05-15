import * as React from 'react';
import { Text, Section, Hr, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface ProductQuestionAnsweredEmailProps {
  askerName: string;
  productName: string;
  productPublicUrl: string;
  question: string;
  answer: string;
}

export function ProductQuestionAnsweredEmail({
  askerName,
  productName,
  productPublicUrl,
  question,
  answer,
}: ProductQuestionAnsweredEmailProps) {
  return (
    <EmailLayout
      preview={`Your question about ${productName} has been answered`}
    >
      <Text style={heading}>Hello, {askerName}!</Text>
      <Text style={paragraph}>
        We answered your question about <strong>{productName}</strong>. See the
        answer below:
      </Text>

      <Text style={label}>Your question</Text>
      <Section style={questionBox}>
        <Text style={questionText}>{question}</Text>
      </Section>

      <Text style={label}>Answer from Red Figure</Text>
      <Section style={answerBox}>
        <Text style={answerText}>{answer}</Text>
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={productPublicUrl}>
          View on product page
        </Button>
      </Section>

      <Hr style={hrStyle} />
      <Text style={footer}>
        Questions? Reply to this email — the redfigure.com team reads
        everything.
      </Text>
    </EmailLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 12px',
};
const paragraph: React.CSSProperties = {
  fontSize: '15px',
  color: '#525f7f',
  lineHeight: '22px',
  margin: '0 0 20px',
};
const label: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '16px 0 4px',
  fontWeight: 'bold',
};
const questionBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderLeft: '3px solid #8898aa',
  padding: '12px 16px',
  borderRadius: '4px',
  margin: '4px 0 8px',
};
const questionText: React.CSSProperties = {
  fontSize: '14px',
  color: '#525f7f',
  lineHeight: '21px',
  whiteSpace: 'pre-wrap' as const,
  margin: '0',
  fontStyle: 'italic',
};
const answerBox: React.CSSProperties = {
  backgroundColor: '#fef5ff',
  borderLeft: '3px solid #b829ff',
  padding: '14px 16px',
  borderRadius: '4px',
  margin: '4px 0 16px',
};
const answerText: React.CSSProperties = {
  fontSize: '15px',
  color: '#1a1a2e',
  lineHeight: '22px',
  whiteSpace: 'pre-wrap' as const,
  margin: '0',
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
const hrStyle: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '16px 0',
};
const footer: React.CSSProperties = {
  fontSize: '13px',
  color: '#8898aa',
  margin: '8px 0 0',
};
