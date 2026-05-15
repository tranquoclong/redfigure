import { render } from '@react-email/render';
import { WelcomeEmail } from './welcome';
import { PasswordResetEmail } from './password-reset';
import { ReviewRewardEmail } from './review-reward';
import { ContactEmail } from './contact';

describe('Email Templates', () => {
  describe('WelcomeEmail', () => {
    it('should render with user name', async () => {
      const html = await render(WelcomeEmail({ name: 'John Doe' }));
      expect(html).toContain('John Doe');
    });

    it('should contain welcome message', async () => {
      const html = await render(WelcomeEmail({ name: 'Maria' }));
      expect(html).toContain('Welcome');
    });

    it('should contain link to store', async () => {
      const html = await render(WelcomeEmail({ name: 'Carlos' }));
      expect(html).toContain('href=');
    });
  });

  describe('PasswordResetEmail', () => {
    const props = {
      name: 'Carlos',
      resetUrl: 'https://redfigure.com/reset-password?token=abc123',
    };

    it('should render reset link', async () => {
      const html = await render(PasswordResetEmail(props));
      expect(html).toContain(
        'https://redfigure.com/reset-password?token=abc123',
      );
    });

    it('should contain expiry warning', async () => {
      const html = await render(PasswordResetEmail(props));
      expect(html).toContain('1 hora');
    });

    it('should render user name', async () => {
      const html = await render(PasswordResetEmail(props));
      expect(html).toContain('Carlos');
    });
  });

  describe('ReviewRewardEmail', () => {
    const props = {
      customerName: 'Maria',
      productName: 'Miniature Ancient Dragon',
      couponCode: 'REVIEW-ABC123',
      discountPercent: 5,
    };

    it('should render coupon code', async () => {
      const html = await render(ReviewRewardEmail(props));
      expect(html).toContain('REVIEW-ABC123');
    });

    it('should render discount percentage', async () => {
      const html = await render(ReviewRewardEmail(props));

      expect(html).toMatch(/5[^0-9]*%/);
    });

    it('should render product name', async () => {
      const html = await render(ReviewRewardEmail(props));
      expect(html).toContain('Miniature Ancient Dragon');
    });

    it('should render customer name', async () => {
      const html = await render(ReviewRewardEmail(props));
      expect(html).toContain('Maria');
    });
  });

  describe('ContactEmail', () => {
    const props = {
      name: 'Ana Costa',
      email: 'ana@example.com',
      message: 'Hello, I have a question about the scales.',
    };

    it('should render sender name + email + message', async () => {
      const html = await render(ContactEmail(props));
      expect(html).toContain('Ana Costa');
      expect(html).toContain('ana@example.com');
      expect(html).toContain('Hello, I have a question about the scales.');
    });

    it('should escape HTML-injection attempts in message (XSS via text node)', async () => {
      const html = await render(
        ContactEmail({
          ...props,
          message: '<script>alert(1)</script><img src=x onerror=alert(1)>',
        }),
      );
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in name field', async () => {
      const html = await render(
        ContactEmail({ ...props, name: '<b>Fake</b>' }),
      );
      expect(html).not.toContain('<b>Fake</b>');
      expect(html).toContain('&lt;b&gt;');
    });

    it('should include forensic info (IP + UA) when provided', async () => {
      const html = await render(
        ContactEmail({
          ...props,
          ipAddress: '203.0.113.5',
          userAgent: 'Mozilla/5.0',
        }),
      );
      expect(html).toContain('203.0.113.5');
      expect(html).toContain('Mozilla/5.0');
    });

    it('should omit forensic section when IP + UA absent', async () => {
      const html = await render(ContactEmail(props));
      expect(html).not.toContain('Technical Information');
    });
  });
});
