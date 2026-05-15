import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test', method: 'GET' }),
      }),
    } as any;
  });

  it('should format HttpException into standard error response', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        statusCode: 404,
        message: 'Not Found',
      },
    });
  });

  it('should include validation details when available', () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: ['email must be an email', 'name is required'],
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        statusCode: 400,
        message: 'Validation failed',
        details: ['email must be an email', 'name is required'],
      },
    });
  });

  it('should handle unknown exceptions as 500', () => {
    const exception = new Error('Something broke');

    filter.catch(exception as any, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        statusCode: 500,
        message: 'Internal server error',
      },
    });
  });
});
