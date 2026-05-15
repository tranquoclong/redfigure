import { ArgumentsHost } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test', method: 'POST' }),
      }),
    } as any;
  });

  it('should return 409 for unique constraint violation (P2002)', () => {
    const exception = {
      code: 'P2002',
      meta: { target: ['email'] },
    };

    filter.catch(exception as any, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        statusCode: 409,
        message: 'Unique constraint violation on: email',
      },
    });
  });

  it('should return 404 for record not found (P2025)', () => {
    const exception = {
      code: 'P2025',
      meta: { cause: 'Record to update not found' },
    };

    filter.catch(exception as any, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        statusCode: 404,
        message: 'Record not found',
      },
    });
  });

  it('should return 400 for foreign key constraint (P2003)', () => {
    const exception = {
      code: 'P2003',
      meta: { field_name: 'categoryId' },
    };

    filter.catch(exception as any, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        statusCode: 400,
        message: 'Related record not found for: categoryId',
      },
    });
  });

  it('should return 500 for unknown Prisma errors', () => {
    const exception = { code: 'P9999' };

    filter.catch(exception as any, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});
