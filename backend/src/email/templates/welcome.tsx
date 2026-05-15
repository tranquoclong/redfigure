import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface WelcomeEmailProps {
  name: string;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://redfigure.com';

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Welcome to RedFigure, ${name}!`}>
      <Text style={heading}>Welcome, {name}!</Text>
      <Text style={paragraph}>
        Your account has been created successfully. Now you can explore our
        exclusive catalog of 3D miniatures, track your orders, and much more.
      </Text>
      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/products`}>
          Explore Catalog
        </Button>
      </Section>
      <Text style={paragraph}>
        If you have any questions, please reply to this email and we will be
        happy to help.
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
