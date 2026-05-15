import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
} from '@react-email/components';

interface LayoutProps {
  children: React.ReactNode;
  preview?: string;
}

const STORE_NAME = 'RedFigure';
const STORE_URL = process.env.FRONTEND_URL ?? 'https://redfigure.com';

export function EmailLayout({ children, preview }: LayoutProps) {
  return (
    <Html lang="vi-VN">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={logoText}>{STORE_NAME}</Text>
          </Section>

          <Section style={contentStyle}>{children}</Section>

          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={footerText}>
              © {new Date().getFullYear()} {STORE_NAME}. All rights reserved.
            </Text>
            <Text style={footerText}>
              You received this email because you have an account in our store.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  padding: '24px',
  textAlign: 'center' as const,
};

const logoText: React.CSSProperties = {
  color: '#e0a526',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
};

const contentStyle: React.CSSProperties = {
  padding: '32px 24px',
};

const hrStyle: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '0',
};

const footerStyle: React.CSSProperties = {
  padding: '16px 24px',
};

const footerText: React.CSSProperties = {
  color: '#8898aa',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '4px 0',
};
