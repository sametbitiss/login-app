class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Geçersiz veri gönderildi', details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Oturum açmanız gerekmektedir') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Bu işlem için yetkiniz bulunmamaktadır') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'İstenen kaynak bulunamadı') {
    super(message, 404);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
};
